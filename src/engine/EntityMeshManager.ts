import * as THREE from 'three';
import {
  isPrimitiveEntity,
  type Entity,
  type MaterialDef,
  type PrimitiveEntity,
} from '../domain';

interface EntityRecord {
  entityId: string;
  type: Entity['type'];
  parentId: string | null;
  root: THREE.Group;
  mesh?: THREE.Mesh;
  geometrySignature?: string;
  materialId?: string;
}

interface MaterialPair {
  solid: THREE.MeshStandardMaterial;
  doubleSided?: THREE.MeshStandardMaterial;
}

const HIGHLIGHT_COLOR = 0x4d5a49;

function getGeometrySignature(entity: PrimitiveEntity): string {
  switch (entity.type) {
    case 'box':
      return `box:${entity.geometry.width}:${entity.geometry.height}:${entity.geometry.depth}`;
    case 'cylinder':
      return `cylinder:${entity.geometry.radius}:${entity.geometry.height}:${entity.geometry.radialSegments ?? 32}`;
    case 'sphere':
      return `sphere:${entity.geometry.radius}:${entity.geometry.widthSegments ?? 32}:${entity.geometry.heightSegments ?? 24}`;
    case 'plane':
      return `plane:${entity.geometry.width}:${entity.geometry.depth}`;
  }
}

function buildPrimitiveGeometry(entity: PrimitiveEntity): {
  geometry: THREE.BufferGeometry;
  offsetY: number;
  rotationX: number;
} {
  switch (entity.type) {
    case 'box': {
      const { width, height, depth } = entity.geometry;
      return {
        geometry: new THREE.BoxGeometry(width, height, depth),
        offsetY: height / 2,
        rotationX: 0,
      };
    }
    case 'cylinder': {
      const { radius, height, radialSegments = 32 } = entity.geometry;
      return {
        geometry: new THREE.CylinderGeometry(
          radius,
          radius,
          height,
          radialSegments,
        ),
        offsetY: height / 2,
        rotationX: 0,
      };
    }
    case 'sphere': {
      const { radius, widthSegments = 32, heightSegments = 24 } =
        entity.geometry;
      return {
        geometry: new THREE.SphereGeometry(
          radius,
          widthSegments,
          heightSegments,
        ),
        offsetY: radius,
        rotationX: 0,
      };
    }
    case 'plane': {
      const { width, depth } = entity.geometry;
      return {
        geometry: new THREE.PlaneGeometry(width, depth),
        offsetY: 0,
        rotationX: -Math.PI / 2,
      };
    }
  }
}

export class EntityMeshManager {
  readonly entitiesRoot: THREE.Group;

  private readonly records = new Map<string, EntityRecord>();
  private readonly materials = new Map<string, MaterialPair>();
  private readonly fallbackMaterial: THREE.MeshStandardMaterial;
  private readonly fallbackDoubleSided: THREE.MeshStandardMaterial;

  private readonly highlightMaterial: THREE.LineBasicMaterial;
  private selectionHighlight: THREE.Object3D | null = null;
  private highlightedEntityId: string | null = null;
  private highlightedGeometrySignature: string | null = null;

  constructor(scene: THREE.Scene) {
    this.entitiesRoot = new THREE.Group();
    this.entitiesRoot.name = 'EntitiesRoot';
    scene.add(this.entitiesRoot);

    this.fallbackMaterial = new THREE.MeshStandardMaterial({
      color: '#c9a575',
      roughness: 0.55,
      metalness: 0,
    });
    this.fallbackDoubleSided = new THREE.MeshStandardMaterial({
      color: '#c9a575',
      roughness: 0.55,
      metalness: 0,
      side: THREE.DoubleSide,
    });
    this.highlightMaterial = new THREE.LineBasicMaterial({
      color: HIGHLIGHT_COLOR,
      transparent: true,
      opacity: 0.92,
      depthTest: false,
    });
  }

  sync(
    entities: readonly Entity[],
    materialDefs: readonly MaterialDef[],
    showAccessories: boolean,
    selectedId: string | null,
  ): void {
    this.syncMaterials(materialDefs);
    this.syncEntities(entities, showAccessories);
    this.syncSelectionHighlight(selectedId);
  }

  getEntityObject(entityId: string): THREE.Group | null {
    return this.records.get(entityId)?.root ?? null;
  }

  getPickableMeshes(): THREE.Mesh[] {
    const meshes: THREE.Mesh[] = [];
    for (const record of this.records.values()) {
      if (record.mesh && this.isObjectChainVisible(record.mesh)) {
        meshes.push(record.mesh);
      }
    }
    return meshes;
  }

  pickEntityIdFromMesh(object: THREE.Object3D | null): string | null {
    let current: THREE.Object3D | null = object;
    while (current) {
      if (typeof current.userData?.entityId === 'string') {
        return current.userData.entityId;
      }
      current = current.parent;
    }
    return null;
  }

  private isObjectChainVisible(obj: THREE.Object3D): boolean {
    let current: THREE.Object3D | null = obj;
    while (current) {
      if (!current.visible) return false;
      current = current.parent;
    }
    return true;
  }

  private getMaterialForEntity(
    materialId: string,
    doubleSided: boolean,
  ): THREE.MeshStandardMaterial {
    const pair = this.materials.get(materialId);
    if (!pair) {
      return doubleSided ? this.fallbackDoubleSided : this.fallbackMaterial;
    }
    if (!doubleSided) {
      return pair.solid;
    }
    if (!pair.doubleSided) {
      pair.doubleSided = pair.solid.clone();
      pair.doubleSided.side = THREE.DoubleSide;
    }
    return pair.doubleSided;
  }

  private syncMaterials(materialDefs: readonly MaterialDef[]): void {
    const activeIds = new Set<string>();

    for (const def of materialDefs) {
      activeIds.add(def.id);
      let pair = this.materials.get(def.id);
      if (!pair) {
        pair = {
          solid: new THREE.MeshStandardMaterial({
            color: def.color,
            roughness: def.roughness,
            metalness: def.metalness,
          }),
        };
        this.materials.set(def.id, pair);
      } else {
        this.applyMaterialProps(pair.solid, def);
        if (pair.doubleSided) {
          this.applyMaterialProps(pair.doubleSided, def);
        }
      }
    }

    for (const [id, pair] of this.materials.entries()) {
      if (!activeIds.has(id)) {
        pair.solid.dispose();
        pair.doubleSided?.dispose();
        this.materials.delete(id);
      }
    }
  }

  private applyMaterialProps(
    mat: THREE.MeshStandardMaterial,
    def: MaterialDef,
  ): void {
    const nextColor = new THREE.Color(def.color);
    if (!mat.color.equals(nextColor)) {
      mat.color.copy(nextColor);
    }
    if (mat.roughness !== def.roughness) {
      mat.roughness = def.roughness;
    }
    if (mat.metalness !== def.metalness) {
      mat.metalness = def.metalness;
    }
  }

  private syncEntities(
    entities: readonly Entity[],
    showAccessories: boolean,
  ): void {
    const activeIds = new Set<string>();

    // Pass 1: create or update entity roots, geometries, transforms, materials & visibility
    for (const entity of entities) {
      activeIds.add(entity.id);
      let record = this.records.get(entity.id);

      // Recreate record if entity type ever changed
      if (record && record.type !== entity.type) {
        this.removeRecord(entity.id);
        record = undefined;
      }

      if (!record) {
        const root = new THREE.Group();
        root.name = entity.name;
        root.userData.entityId = entity.id;
        root.rotation.order = 'XYZ';

        record = {
          entityId: entity.id,
          type: entity.type,
          parentId: null,
          root,
        };

        if (isPrimitiveEntity(entity)) {
          const built = buildPrimitiveGeometry(entity);
          const doubleSided = entity.type === 'plane';
          const mat = this.getMaterialForEntity(entity.materialId, doubleSided);
          const mesh = new THREE.Mesh(built.geometry, mat);
          mesh.position.set(0, built.offsetY, 0);
          mesh.rotation.set(built.rotationX, 0, 0);
          mesh.castShadow = entity.type !== 'plane';
          mesh.receiveShadow = true;
          mesh.userData.entityId = entity.id;
          root.add(mesh);

          record.mesh = mesh;
          record.geometrySignature = getGeometrySignature(entity);
          record.materialId = entity.materialId;
        }

        this.entitiesRoot.add(root);
        this.records.set(entity.id, record);
      } else {
        record.root.name = entity.name;
        if (isPrimitiveEntity(entity) && record.mesh) {
          const nextSig = getGeometrySignature(entity);
          if (record.geometrySignature !== nextSig) {
            const oldGeometry = record.mesh.geometry;
            const built = buildPrimitiveGeometry(entity);
            record.mesh.geometry = built.geometry;
            record.mesh.position.set(0, built.offsetY, 0);
            record.mesh.rotation.set(built.rotationX, 0, 0);
            oldGeometry.dispose();
            record.geometrySignature = nextSig;
          }

          const doubleSided = entity.type === 'plane';
          const nextMat = this.getMaterialForEntity(
            entity.materialId,
            doubleSided,
          );
          if (record.mesh.material !== nextMat) {
            record.mesh.material = nextMat;
          }
          record.materialId = entity.materialId;
        }
      }

      const [px, py, pz] = entity.transform.position;
      record.root.position.set(px, py, pz);
      const [rx, ry, rz] = entity.transform.rotation;
      record.root.rotation.set(rx, ry, rz, 'XYZ');
      record.root.scale.set(1, 1, 1);

      record.root.visible =
        entity.visible && (showAccessories || entity.layer !== 'accessories');
    }

    // Pass 2: remove deleted entities cleanly with dispose()
    for (const id of [...this.records.keys()]) {
      if (!activeIds.has(id)) {
        this.removeRecord(id);
      }
    }

    // Pass 3: reconcile parent-child hierarchy incrementally
    for (const entity of entities) {
      const record = this.records.get(entity.id);
      if (!record) continue;

      const targetParentId =
        entity.parentId && this.records.has(entity.parentId)
          ? entity.parentId
          : null;

      if (record.parentId !== targetParentId) {
        const parentObj = targetParentId
          ? this.records.get(targetParentId)!.root
          : this.entitiesRoot;
        parentObj.add(record.root);
        record.parentId = targetParentId;
      }
    }
  }

  private syncSelectionHighlight(selectedId: string | null): void {
    if (!selectedId) {
      this.clearSelectionHighlight();
      return;
    }

    const record = this.records.get(selectedId);
    if (!record || !this.isObjectChainVisible(record.root)) {
      this.clearSelectionHighlight();
      return;
    }

    // Reuse existing outline for primitives when selection & geometry are unchanged
    if (
      record.mesh &&
      this.selectionHighlight &&
      this.highlightedEntityId === selectedId &&
      this.highlightedGeometrySignature === (record.geometrySignature ?? null)
    ) {
      return;
    }

    this.clearSelectionHighlight();

    if (record.mesh) {
      const edges = new THREE.EdgesGeometry(record.mesh.geometry, 24);
      const lines = new THREE.LineSegments(edges, this.highlightMaterial);
      lines.position.copy(record.mesh.position);
      lines.rotation.copy(record.mesh.rotation);
      lines.scale.setScalar(1.003);
      lines.renderOrder = 20;
      lines.userData.isSelectionHelper = true;
      record.root.add(lines);
      this.selectionHighlight = lines;
      this.highlightedEntityId = selectedId;
      this.highlightedGeometrySignature = record.geometrySignature ?? null;
    } else {
      // Group selection: draw crisp world-aligned Box3Helper around group descendants
      record.root.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(record.root);
      if (!box.isEmpty()) {
        const helper = new THREE.Box3Helper(box, new THREE.Color(HIGHLIGHT_COLOR));
        helper.renderOrder = 20;
        helper.userData.isSelectionHelper = true;
        this.entitiesRoot.add(helper);
        this.selectionHighlight = helper;
        this.highlightedEntityId = selectedId;
        this.highlightedGeometrySignature = null;
      }
    }
  }

  refreshSelectionHighlight(): void {
    const currentId = this.highlightedEntityId;
    this.highlightedGeometrySignature = null;
    this.syncSelectionHighlight(currentId);
  }

  private clearSelectionHighlight(): void {
    if (!this.selectionHighlight) return;
    this.selectionHighlight.removeFromParent();
    if (this.selectionHighlight instanceof THREE.LineSegments) {
      this.selectionHighlight.geometry.dispose();
    } else if (this.selectionHighlight instanceof THREE.Box3Helper) {
      this.selectionHighlight.dispose();
    }
    this.selectionHighlight = null;
    this.highlightedEntityId = null;
    this.highlightedGeometrySignature = null;
  }

  private removeRecord(id: string): void {
    const record = this.records.get(id);
    if (!record) return;

    if (this.highlightedEntityId === id) {
      this.clearSelectionHighlight();
    }

    if (record.mesh) {
      record.mesh.geometry.dispose();
    }
    record.root.removeFromParent();
    this.records.delete(id);
  }

  dispose(): void {
    this.clearSelectionHighlight();
    for (const id of [...this.records.keys()]) {
      this.removeRecord(id);
    }
    for (const pair of this.materials.values()) {
      pair.solid.dispose();
      pair.doubleSided?.dispose();
    }
    this.materials.clear();
    this.fallbackMaterial.dispose();
    this.fallbackDoubleSided.dispose();
    this.highlightMaterial.dispose();
    this.entitiesRoot.removeFromParent();
  }
}
