import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { AABB, CameraPreset } from '../domain';

export interface CameraPose {
  position: THREE.Vector3;
  target: THREE.Vector3;
}

const DEFAULT_INITIAL_POSITION = new THREE.Vector3(3.25, 2.55, 3.7);
const DEFAULT_INITIAL_TARGET = new THREE.Vector3(0, 0.45, 0);
const TRANSITION_DURATION_MS = 260;

export function computeCameraPoseForPreset(
  preset: CameraPreset,
  sceneBounds: AABB | null,
): CameraPose {
  if (!sceneBounds) {
    switch (preset) {
      case 'initial':
        return {
          position: DEFAULT_INITIAL_POSITION.clone(),
          target: DEFAULT_INITIAL_TARGET.clone(),
        };
      case 'front':
        return {
          position: new THREE.Vector3(0, 0.8, 3.8),
          target: new THREE.Vector3(0, 0.45, 0),
        };
      case 'side':
        return {
          position: new THREE.Vector3(3.8, 0.8, 0),
          target: new THREE.Vector3(0, 0.45, 0),
        };
      case 'top':
        return {
          position: new THREE.Vector3(0, 4.5, 0.01),
          target: new THREE.Vector3(0, 0, 0),
        };
      case 'isometric':
        return {
          position: new THREE.Vector3(3.2, 2.6, 3.2),
          target: new THREE.Vector3(0, 0.45, 0),
        };
    }
  }

  const center = new THREE.Vector3(
    (sceneBounds.min[0] + sceneBounds.max[0]) / 2,
    Math.max(0.15, (sceneBounds.min[1] + sceneBounds.max[1]) / 2),
    (sceneBounds.min[2] + sceneBounds.max[2]) / 2,
  );
  const sizeX = sceneBounds.max[0] - sceneBounds.min[0];
  const sizeY = sceneBounds.max[1] - sceneBounds.min[1];
  const sizeZ = sceneBounds.max[2] - sceneBounds.min[2];
  const radius = Math.max(0.6, Math.hypot(sizeX, sizeY, sizeZ) * 0.5);
  const dist = Math.min(34, Math.max(2.4, radius * 3.15));

  switch (preset) {
    case 'initial':
      return {
        position: center
          .clone()
          .add(new THREE.Vector3(dist * 0.68, dist * 0.52, dist * 0.78)),
        target: center,
      };
    case 'front':
      return {
        position: center.clone().add(new THREE.Vector3(0, dist * 0.14, dist)),
        target: center,
      };
    case 'side':
      return {
        position: center.clone().add(new THREE.Vector3(dist, dist * 0.14, 0)),
        target: center,
      };
    case 'top':
      return {
        position: center.clone().add(new THREE.Vector3(0, dist * 1.25, 0.01)),
        target: new THREE.Vector3(center.x, 0, center.z),
      };
    case 'isometric':
      return {
        position: center
          .clone()
          .add(new THREE.Vector3(dist * 0.72, dist * 0.62, dist * 0.72)),
        target: center,
      };
  }
}

export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;

  private activeTransition: {
    startPos: THREE.Vector3;
    endPos: THREE.Vector3;
    startTarget: THREE.Vector3;
    endTarget: THREE.Vector3;
    startTime: number;
    duration: number;
  } | null = null;

  private readonly onControlStart = () => {
    this.activeTransition = null;
  };

  constructor(domElement: HTMLElement, aspect: number) {
    this.camera = new THREE.PerspectiveCamera(42, aspect, 0.05, 160);
    this.camera.position.copy(DEFAULT_INITIAL_POSITION);

    this.controls = new OrbitControls(this.camera, domElement);
    this.controls.target.copy(DEFAULT_INITIAL_TARGET);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.controls.minPolarAngle = 0.02;
    this.controls.minDistance = 0.35;
    this.controls.maxDistance = 45;
    this.controls.screenSpacePanning = false;
    this.controls.addEventListener('start', this.onControlStart);
    this.controls.update();
  }

  resize(width: number, height: number): void {
    if (width <= 0 || height <= 0) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  setEnabled(enabled: boolean): void {
    this.controls.enabled = enabled;
  }

  goToPreset(preset: CameraPreset, sceneBounds: AABB | null, animate = true): void {
    const pose = computeCameraPoseForPreset(preset, sceneBounds);
    if (!animate) {
      this.activeTransition = null;
      this.camera.position.copy(pose.position);
      this.controls.target.copy(pose.target);
      this.controls.update();
      return;
    }

    this.activeTransition = {
      startPos: this.camera.position.clone(),
      endPos: pose.position,
      startTarget: this.controls.target.clone(),
      endTarget: pose.target,
      startTime: performance.now(),
      duration: TRANSITION_DURATION_MS,
    };
  }

  update(now = performance.now()): void {
    if (this.activeTransition) {
      const elapsed = now - this.activeTransition.startTime;
      const t = Math.min(1, elapsed / this.activeTransition.duration);
      const eased = 1 - (1 - t) ** 3;

      this.camera.position.lerpVectors(
        this.activeTransition.startPos,
        this.activeTransition.endPos,
        eased,
      );
      this.controls.target.lerpVectors(
        this.activeTransition.startTarget,
        this.activeTransition.endTarget,
        eased,
      );

      if (t >= 1) {
        this.activeTransition = null;
      }
    }

    // Keep camera target above floor plane to prevent dipping underground
    if (this.controls.target.y < 0) {
      this.controls.target.y = 0;
    }

    this.controls.update();
  }

  dispose(): void {
    this.activeTransition = null;
    this.controls.removeEventListener('start', this.onControlStart);
    this.controls.dispose();
  }
}
