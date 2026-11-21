import * as THREE from 'three';
import {
  getQuickObjectPreset,
  roundClean,
  type QuickObjectPreset,
  type Vec3,
} from '../domain';

const FLOOR_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const MAX_FLOOR_EXTENT = 12;
const TOP_SURFACE_NORMAL_Y_THRESHOLD = 0.9;

function buildGhostGeometry(preset: QuickObjectPreset): {
  geometry: THREE.BufferGeometry;
  offsetY: number;
  rotationX: number;
} {
  switch (preset.type) {
    case 'box': {
      const g = preset.geometry as { width: number; height: number; depth: number };
      return {
        geometry: new THREE.BoxGeometry(g.width, g.height, g.depth),
        offsetY: g.height / 2,
        rotationX: 0,
      };
    }
    case 'cylinder': {
      const g = preset.geometry as {
        radius: number;
        height: number;
        radialSegments?: number;
      };
      return {
        geometry: new THREE.CylinderGeometry(
          g.radius,
          g.radius,
          g.height,
          g.radialSegments ?? 24,
        ),
        offsetY: g.height / 2,
        rotationX: 0,
      };
    }
    case 'sphere': {
      const g = preset.geometry as {
        radius: number;
        widthSegments?: number;
        heightSegments?: number;
      };
      return {
        geometry: new THREE.SphereGeometry(
          g.radius,
          g.widthSegments ?? 24,
          g.heightSegments ?? 18,
        ),
        offsetY: g.radius,
        rotationX: 0,
      };
    }
    case 'plane': {
      const g = preset.geometry as { width: number; depth: number };
      return {
        geometry: new THREE.PlaneGeometry(g.width, g.depth),
        offsetY: 0.002,
        rotationX: -Math.PI / 2,
      };
    }
  }
}

export class DragDropPlacement {
  private readonly ghostRoot: THREE.Group;
  private readonly ghostMaterial: THREE.MeshStandardMaterial;
  private readonly raycaster = new THREE.Raycaster();
  private readonly ndc = new THREE.Vector2();
  private readonly normalMatrix = new THREE.Matrix3();
  private readonly worldNormal = new THREE.Vector3();
  private readonly floorHit = new THREE.Vector3();

  private ghostMesh: THREE.Mesh | null = null;
  private activePresetId: string | null = null;

  constructor(scene: THREE.Scene) {
    this.ghostRoot = new THREE.Group();
    this.ghostRoot.name = 'DragDropGhost';
    this.ghostRoot.visible = false;
    scene.add(this.ghostRoot);

    this.ghostMaterial = new THREE.MeshStandardMaterial({
      color: '#4d5a49',
      roughness: 0.55,
      metalness: 0,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  }

  /**
   * Computes a landing position supporting both the floor (Y = 0) and
   * top horizontal surfaces (worldNormal.y > 0.9) of existing pieces.
   */
  computePlacementPosition(
    clientX: number,
    clientY: number,
    domElement: HTMLElement,
    camera: THREE.Camera,
    pickableMeshes: readonly THREE.Mesh[],
  ): Vec3 | null {
    const rect = domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;

    this.ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.ndc, camera);

    // 1. Prefer top horizontal faces of existing visible pieces
    if (pickableMeshes.length > 0) {
      const hits = this.raycaster.intersectObjects([...pickableMeshes], false);
      for (const hit of hits) {
        if (!hit.face) continue;
        this.normalMatrix.getNormalMatrix(hit.object.matrixWorld);
        this.worldNormal
          .copy(hit.face.normal)
          .applyMatrix3(this.normalMatrix)
          .normalize();
        if (this.worldNormal.y >= TOP_SURFACE_NORMAL_Y_THRESHOLD) {
          return [
            roundClean(hit.point.x, 3),
            roundClean(Math.max(0, hit.point.y), 3),
            roundClean(hit.point.z, 3),
          ];
        }
      }
    }

    // 2. Fallback to the floor plane (Y = 0)
    const hitFloor = this.raycaster.ray.intersectPlane(
      FLOOR_PLANE,
      this.floorHit,
    );
    if (!hitFloor) return null;

    const clampedX = Math.max(
      -MAX_FLOOR_EXTENT,
      Math.min(MAX_FLOOR_EXTENT, this.floorHit.x),
    );
    const clampedZ = Math.max(
      -MAX_FLOOR_EXTENT,
      Math.min(MAX_FLOOR_EXTENT, this.floorHit.z),
    );

    return [roundClean(clampedX, 3), 0, roundClean(clampedZ, 3)];
  }

  updatePreview(
    presetId: string,
    clientX: number,
    clientY: number,
    domElement: HTMLElement,
    camera: THREE.Camera,
    pickableMeshes: readonly THREE.Mesh[],
  ): Vec3 | null {
    const preset = getQuickObjectPreset(presetId);
    if (!preset) {
      this.clearPreview();
      return null;
    }

    const pos = this.computePlacementPosition(
      clientX,
      clientY,
      domElement,
      camera,
      pickableMeshes,
    );
    if (!pos) {
      this.ghostRoot.visible = false;
      return null;
    }

    if (this.activePresetId !== presetId || !this.ghostMesh) {
      this.disposeGhostMesh();
      const built = buildGhostGeometry(preset);
      const mesh = new THREE.Mesh(built.geometry, this.ghostMaterial);
      mesh.position.set(0, built.offsetY, 0);
      mesh.rotation.set(built.rotationX, 0, 0);
      mesh.renderOrder = 15;
      this.ghostRoot.add(mesh);
      this.ghostMesh = mesh;
      this.activePresetId = presetId;
    }

    this.ghostRoot.position.set(pos[0], pos[1], pos[2]);
    this.ghostRoot.visible = true;
    return pos;
  }

  commitDrop(
    clientX: number,
    clientY: number,
    domElement: HTMLElement,
    camera: THREE.Camera,
    pickableMeshes: readonly THREE.Mesh[],
  ): Vec3 | null {
    const pos = this.computePlacementPosition(
      clientX,
      clientY,
      domElement,
      camera,
      pickableMeshes,
    );
    this.clearPreview();
    return pos;
  }

  clearPreview(): void {
    this.ghostRoot.visible = false;
    this.disposeGhostMesh();
  }

  private disposeGhostMesh(): void {
    if (!this.ghostMesh) return;
    this.ghostMesh.removeFromParent();
    this.ghostMesh.geometry.dispose();
    this.ghostMesh = null;
    this.activePresetId = null;
  }

  dispose(): void {
    this.clearPreview();
    this.ghostMaterial.dispose();
    this.ghostRoot.removeFromParent();
  }
}
