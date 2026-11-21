import * as THREE from 'three';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import {
  buildEntityMap,
  isEntityEffectivelyLocked,
  isEntityEffectivelyVisible,
  isGroupEntity,
  isPrimitiveEntity,
  roundClean,
  type Entity,
  type TransformToolMode,
  type Vec3,
} from '../domain';
import { useProjectStore } from '../store';

export interface GizmoManagerCallbacks {
  onDraggingChange: (dragging: boolean) => void;
  getEntityObject: (entityId: string) => THREE.Group | null;
}

export class GizmoManager {
  readonly controls: TransformControls;
  private readonly helper: THREE.Object3D;
  private readonly callbacks: GizmoManagerCallbacks;

  private attachedEntityId: string | null = null;
  private dragging = false;
  private dragEndedAt = 0;
  private activeScaleDrag = false;
  private lastScaleVec: Vec3 = [1, 1, 1];

  constructor(
    scene: THREE.Scene,
    camera: THREE.Camera,
    domElement: HTMLElement,
    callbacks: GizmoManagerCallbacks,
  ) {
    this.callbacks = callbacks;
    this.controls = new TransformControls(camera, domElement);
    this.controls.setSpace('local');
    this.controls.setSize(0.85);
    this.controls.setColors(0xc75442, 0x4d5a49, 0x3b6ea5, 0xd49b2a);

    this.helper = this.controls.getHelper();
    scene.add(this.helper);

    this.controls.addEventListener('dragging-changed', this.handleDraggingChanged);
    this.controls.addEventListener('objectChange', this.handleObjectChange);
  }

  get isDragging(): boolean {
    return this.dragging;
  }

  get isScalingDrag(): boolean {
    return this.dragging && this.activeScaleDrag;
  }

  wasJustDragged(windowMs = 180): boolean {
    return this.dragging || performance.now() - this.dragEndedAt < windowMs;
  }

  sync(
    entities: readonly Entity[],
    selectedId: string | null,
    toolMode: TransformToolMode,
    showAccessories: boolean,
  ): void {
    // Do not disturb TransformControls attachment while user is actively dragging
    if (this.dragging) return;

    if (!selectedId) {
      this.detach();
      return;
    }

    const entitiesById = buildEntityMap(entities);
    const entity = entitiesById.get(selectedId);
    if (
      !entity ||
      isEntityEffectivelyLocked(entity, entitiesById) ||
      !isEntityEffectivelyVisible(entity, entitiesById, showAccessories)
    ) {
      this.detach();
      return;
    }

    const targetObj = this.callbacks.getEntityObject(selectedId);
    if (!targetObj) {
      this.detach();
      return;
    }

    const effectiveMode: TransformToolMode =
      toolMode === 'scale' && isGroupEntity(entity) ? 'translate' : toolMode;

    if (this.controls.getMode() !== effectiveMode) {
      this.controls.setMode(effectiveMode);
    }

    // Restrict plane scaling to horizontal X/Z axes only
    const showY = !(effectiveMode === 'scale' && entity.type === 'plane');
    this.controls.showX = true;
    this.controls.showY = showY;
    this.controls.showZ = true;

    if (this.attachedEntityId !== selectedId || this.controls.object !== targetObj) {
      this.controls.attach(targetObj);
      this.attachedEntityId = selectedId;
    }
  }

  private detach(): void {
    if (this.attachedEntityId !== null || this.controls.object !== undefined) {
      this.controls.detach();
      this.attachedEntityId = null;
    }
  }

  private readonly handleDraggingChanged = (event: { value: unknown }) => {
    const isNowDragging = Boolean(event.value);
    const store = useProjectStore.getState();

    if (isNowDragging) {
      this.dragging = true;
      this.activeScaleDrag = this.controls.getMode() === 'scale';
      this.lastScaleVec = [1, 1, 1];
      store.beginTransaction();
      this.callbacks.onDraggingChange(true);
    } else {
      const entityId = this.attachedEntityId;
      const obj = this.controls.object;

      if (this.activeScaleDrag && entityId && obj) {
        const finalScale: Vec3 = [
          this.lastScaleVec[0],
          this.lastScaleVec[1],
          this.lastScaleVec[2],
        ];
        obj.scale.set(1, 1, 1);
        store.scalePrimitive(entityId, finalScale, { recordHistory: false });
      } else if (entityId && obj) {
        this.pushLiveTransform(entityId, obj);
      }

      this.dragging = false;
      this.activeScaleDrag = false;
      this.dragEndedAt = performance.now();
      store.commitTransaction();
      this.callbacks.onDraggingChange(false);
    }
  };

  private readonly handleObjectChange = () => {
    if (!this.dragging || !this.attachedEntityId || !this.controls.object) {
      return;
    }

    const obj = this.controls.object;
    const mode = this.controls.getMode();

    if (mode === 'scale') {
      this.constrainLiveScalePreview(this.attachedEntityId, obj);
    } else {
      this.pushLiveTransform(this.attachedEntityId, obj);
    }
  };

  private pushLiveTransform(entityId: string, obj: THREE.Object3D): void {
    const mode = this.controls.getMode();
    const store = useProjectStore.getState();

    if (mode === 'translate') {
      const position: Vec3 = [
        roundClean(obj.position.x, 4),
        roundClean(obj.position.y, 4),
        roundClean(obj.position.z, 4),
      ];
      store.updateEntityTransform(
        entityId,
        { position },
        { recordHistory: false },
      );
    } else if (mode === 'rotate') {
      obj.rotation.order = 'XYZ';
      const rotation: Vec3 = [
        roundClean(obj.rotation.x, 5),
        roundClean(obj.rotation.y, 5),
        roundClean(obj.rotation.z, 5),
      ];
      store.updateEntityTransform(
        entityId,
        { rotation },
        { recordHistory: false },
      );
    }
  }

  private constrainLiveScalePreview(
    entityId: string,
    obj: THREE.Object3D,
  ): void {
    const entity = useProjectStore
      .getState()
      .document.entities.find((e) => e.id === entityId);
    if (!entity || !isPrimitiveEntity(entity)) return;

    const MIN_SCALE = 0.02;
    const sx = Math.max(MIN_SCALE, Math.abs(obj.scale.x));
    const sy = Math.max(MIN_SCALE, Math.abs(obj.scale.y));
    const sz = Math.max(MIN_SCALE, Math.abs(obj.scale.z));
    const axis = this.controls.axis;

    switch (entity.type) {
      case 'box': {
        obj.scale.set(sx, sy, sz);
        this.lastScaleVec = [sx, sy, sz];
        break;
      }
      case 'cylinder': {
        let sRadial = sx;
        if (axis === 'Z') {
          sRadial = sz;
        } else if (axis === 'X') {
          sRadial = sx;
        } else {
          sRadial = (sx + sz) / 2;
        }
        obj.scale.set(sRadial, sy, sRadial);
        this.lastScaleVec = [sRadial, sy, sRadial];
        break;
      }
      case 'sphere': {
        let sUniform = sx;
        if (axis === 'Y') sUniform = sy;
        else if (axis === 'Z') sUniform = sz;
        else if (axis === 'X') sUniform = sx;
        else sUniform = (sx + sy + sz) / 3;
        obj.scale.set(sUniform, sUniform, sUniform);
        this.lastScaleVec = [sUniform, sUniform, sUniform];
        break;
      }
      case 'plane': {
        obj.scale.set(sx, 1, sz);
        this.lastScaleVec = [sx, 1, sz];
        break;
      }
    }
  }

  dispose(): void {
    this.controls.removeEventListener(
      'dragging-changed',
      this.handleDraggingChanged,
    );
    this.controls.removeEventListener('objectChange', this.handleObjectChange);
    this.detach();
    this.helper.removeFromParent();
    this.controls.dispose();
  }
}
