import * as THREE from 'three';
import { getEntityWorldAABB, getProjectWorldAABB } from '../domain';
import { useProjectStore } from '../store';
import { CameraRig } from './CameraRig';
import { DimensionsOverlay } from './DimensionsOverlay';
import { DragDropPlacement } from './DragDropPlacement';
import { EntityMeshManager } from './EntityMeshManager';
import { GizmoManager } from './GizmoManager';

export interface SceneMemoryStats {
  geometries: number;
  textures: number;
}

const SCENE_BG_COLOR = '#e9e7e1';
const FLOOR_COLOR = '#d8d4ca';
const FLOOR_Y = -0.008;
const GRID_Y = -0.002;
const GRID_SIZE = 12;

export class SceneController {
  readonly scene: THREE.Scene;
  readonly renderer: THREE.WebGLRenderer;
  readonly cameraRig: CameraRig;
  readonly meshManager: EntityMeshManager;
  readonly gizmoManager: GizmoManager;
  readonly dragDropPlacement: DragDropPlacement;
  readonly dimensionsOverlay: DimensionsOverlay;

  private readonly container: HTMLElement;
  private readonly floorMesh: THREE.Mesh;
  private gridHelper: THREE.GridHelper;
  private currentGridSpacing: number;
  private readonly axesHelper: THREE.AxesHelper;

  private readonly raycaster = new THREE.Raycaster();
  private readonly pointerNdc = new THREE.Vector2();
  private pointerDownPos: { x: number; y: number } | null = null;

  private readonly resizeObserver: ResizeObserver;
  private readonly unsubscribeStore: () => void;
  private rafId: number | null = null;
  private disposed = false;
  private lastCameraPresetSeq = 0;

  constructor(container: HTMLElement) {
    this.container = container;
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(SCENE_BG_COLOR);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    container.appendChild(this.renderer.domElement);

    this.cameraRig = new CameraRig(this.renderer.domElement, width / height);
    this.meshManager = new EntityMeshManager(this.scene);
    this.dragDropPlacement = new DragDropPlacement(this.scene);
    this.dimensionsOverlay = new DimensionsOverlay(this.scene);
    this.gizmoManager = new GizmoManager(
      this.scene,
      this.cameraRig.camera,
      this.renderer.domElement,
      {
        onDraggingChange: (dragging) => {
          this.cameraRig.setEnabled(!dragging);
          if (!dragging) {
            // Ensure final state & gizmo constraints re-sync cleanly
            this.syncFromStore();
          }
        },
        getEntityObject: (entityId) =>
          this.meshManager.getEntityObject(entityId),
      },
    );

    // Warm studio lighting matching the prototype
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xaaa08e, 2.0);
    this.scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 2.1);
    sunLight.position.set(-3.5, 7, 4.5);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(2048, 2048);
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 30;
    sunLight.shadow.camera.left = -6;
    sunLight.shadow.camera.right = 6;
    sunLight.shadow.camera.top = 6;
    sunLight.shadow.camera.bottom = -6;
    sunLight.shadow.bias = -0.0004;
    this.scene.add(sunLight);

    // Floor separated vertically from grid and Y=0 plane to eliminate z-fighting
    const floorGeo = new THREE.PlaneGeometry(200, 200);
    const floorMat = new THREE.MeshStandardMaterial({
      color: FLOOR_COLOR,
      roughness: 0.9,
      metalness: 0,
    });
    this.floorMesh = new THREE.Mesh(floorGeo, floorMat);
    this.floorMesh.rotation.x = -Math.PI / 2;
    this.floorMesh.position.y = FLOOR_Y;
    this.floorMesh.receiveShadow = true;
    this.scene.add(this.floorMesh);

    const initialState = useProjectStore.getState();
    this.currentGridSpacing = initialState.document.settings.gridSpacing;
    this.gridHelper = this.createGridHelper(this.currentGridSpacing);
    this.scene.add(this.gridHelper);

    this.axesHelper = new THREE.AxesHelper(0.6);
    this.axesHelper.position.y = 0.001;
    this.scene.add(this.axesHelper);

    // Initial sync with store
    this.lastCameraPresetSeq = initialState.cameraPresetRequest.seq;
    this.syncFromStore();

    // Incremental store subscription
    this.unsubscribeStore = useProjectStore.subscribe(() => {
      this.syncFromStore();
    });

    // Pointer selection listeners
    this.renderer.domElement.addEventListener(
      'pointerdown',
      this.handlePointerDown,
    );
    this.renderer.domElement.addEventListener(
      'pointerup',
      this.handlePointerUp,
    );

    // Container resize handling
    this.resizeObserver = new ResizeObserver(() => {
      this.handleResize();
    });
    this.resizeObserver.observe(container);

    this.startLoop();
  }

  getMemoryStats(): SceneMemoryStats {
    return {
      geometries: this.renderer.info.memory.geometries,
      textures: this.renderer.info.memory.textures,
    };
  }

  setOrbitEnabled(enabled: boolean): void {
    this.cameraRig.setEnabled(enabled);
  }

  updateDragPreview(presetId: string, clientX: number, clientY: number): void {
    if (this.disposed) return;
    this.dragDropPlacement.updatePreview(
      presetId,
      clientX,
      clientY,
      this.renderer.domElement,
      this.cameraRig.camera,
      this.meshManager.getPickableMeshes(),
    );
  }

  commitDragDrop(presetId: string, clientX: number, clientY: number): boolean {
    if (this.disposed) return false;
    const position = this.dragDropPlacement.commitDrop(
      clientX,
      clientY,
      this.renderer.domElement,
      this.cameraRig.camera,
      this.meshManager.getPickableMeshes(),
    );
    if (!position) return false;
    return (
      useProjectStore.getState().addQuickObject(presetId, { position }) !== null
    );
  }

  clearDragPreview(): void {
    if (this.disposed) return;
    this.dragDropPlacement.clearPreview();
  }

  private createGridHelper(spacing: number): THREE.GridHelper {
    const safeSpacing = Math.max(0.05, spacing);
    const divisions = Math.max(
      4,
      Math.min(200, Math.round(GRID_SIZE / safeSpacing)),
    );
    const grid = new THREE.GridHelper(GRID_SIZE, divisions, 0xbab4a8, 0xd0cbc1);
    grid.position.y = GRID_Y;
    const mat = grid.material as THREE.Material;
    mat.opacity = 0.35;
    mat.transparent = true;
    return grid;
  }

  private syncFromStore(): void {
    if (this.disposed) return;

    const state = useProjectStore.getState();
    const { document, selectedId, toolMode, cameraPresetRequest } = state;
    const { settings } = document;

    if (settings.gridSpacing !== this.currentGridSpacing) {
      this.disposeObject(this.gridHelper);
      this.gridHelper.removeFromParent();
      this.currentGridSpacing = settings.gridSpacing;
      this.gridHelper = this.createGridHelper(this.currentGridSpacing);
      this.scene.add(this.gridHelper);
    }

    this.gridHelper.visible = settings.showGrid;
    this.axesHelper.visible = settings.showAxes;

    if (!this.gizmoManager.isScalingDrag) {
      this.meshManager.sync(
        document.entities,
        document.materials,
        settings.showAccessories,
        selectedId,
      );
    }

    this.gizmoManager.sync(
      document.entities,
      selectedId,
      toolMode,
      settings.showAccessories,
    );

    const dimBounds = selectedId
      ? getEntityWorldAABB(selectedId, document.entities, {
          includeHidden: false,
          showAccessories: settings.showAccessories,
        })
      : getProjectWorldAABB(document.entities, {
          includeHidden: false,
          showAccessories: settings.showAccessories,
        });

    this.dimensionsOverlay.sync(
      settings.showDimensions,
      dimBounds,
      document.project.displayUnit,
    );

    if (cameraPresetRequest.seq !== this.lastCameraPresetSeq) {
      this.lastCameraPresetSeq = cameraPresetRequest.seq;
      const bounds = getProjectWorldAABB(document.entities, {
        includeHidden: false,
        showAccessories: settings.showAccessories,
      });
      this.cameraRig.goToPreset(cameraPresetRequest.preset, bounds, true);
    }
  }

  private handleResize(): void {
    if (this.disposed) return;
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.cameraRig.resize(width, height);
    this.renderer.setSize(width, height);
  }

  private readonly handlePointerDown = (event: PointerEvent) => {
    if (event.button !== 0 || this.gizmoManager.isDragging) return;
    this.pointerDownPos = { x: event.clientX, y: event.clientY };
  };

  private readonly handlePointerUp = (event: PointerEvent) => {
    if (event.button !== 0 || !this.pointerDownPos) return;

    const dx = event.clientX - this.pointerDownPos.x;
    const dy = event.clientY - this.pointerDownPos.y;
    this.pointerDownPos = null;

    // Ignore orbit drags and gizmo releases
    if (Math.hypot(dx, dy) > 5 || this.gizmoManager.wasJustDragged()) return;

    const rect = this.renderer.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    this.pointerNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNdc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointerNdc, this.cameraRig.camera);
    const pickable = this.meshManager.getPickableMeshes();
    const hits = this.raycaster.intersectObjects(pickable, false);

    if (hits.length > 0) {
      const entityId = this.meshManager.pickEntityIdFromMesh(hits[0].object);
      useProjectStore.getState().selectEntity(entityId);
    } else {
      useProjectStore.getState().selectEntity(null);
    }
  };

  private startLoop(): void {
    const tick = (now: number) => {
      if (this.disposed) return;
      this.rafId = requestAnimationFrame(tick);
      this.cameraRig.update(now);
      this.renderer.render(this.scene, this.cameraRig.camera);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private disposeObject(obj: THREE.Object3D): void {
    obj.traverse((child) => {
      if (
        child instanceof THREE.Mesh ||
        child instanceof THREE.Line ||
        child instanceof THREE.LineSegments
      ) {
        child.geometry.dispose();
        const materials = Array.isArray(child.material)
          ? child.material
          : [child.material];
        for (const mat of materials) {
          mat.dispose();
        }
      }
    });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    this.unsubscribeStore();
    this.resizeObserver.disconnect();
    this.renderer.domElement.removeEventListener(
      'pointerdown',
      this.handlePointerDown,
    );
    this.renderer.domElement.removeEventListener(
      'pointerup',
      this.handlePointerUp,
    );

    this.gizmoManager.dispose();
    this.dragDropPlacement.dispose();
    this.dimensionsOverlay.dispose();
    this.meshManager.dispose();
    this.cameraRig.dispose();

    this.disposeObject(this.floorMesh);
    this.disposeObject(this.gridHelper);
    this.axesHelper.dispose();

    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
