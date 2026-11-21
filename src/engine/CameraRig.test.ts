import { describe, expect, it } from 'vitest';
import type { AABB, CameraPreset } from '../domain';
import { computeCameraPoseForPreset } from './CameraRig';

const PRESETS: CameraPreset[] = [
  'initial',
  'front',
  'side',
  'top',
  'isometric',
];

describe('CameraRig presets', () => {
  it('mantiene la cámara sobre el suelo (Y > 0) para todas las vistas en lienzo vacío y con objetos', () => {
    const sampleBounds: AABB = {
      min: [-0.9, 0, -0.3],
      max: [0.9, 0.75, 1.1],
    };

    for (const preset of PRESETS) {
      const emptyPose = computeCameraPoseForPreset(preset, null);
      expect(emptyPose.position.y).toBeGreaterThan(0);
      expect(emptyPose.target.y).toBeGreaterThanOrEqual(0);

      const framedPose = computeCameraPoseForPreset(preset, sampleBounds);
      expect(framedPose.position.y).toBeGreaterThan(0);
      expect(framedPose.target.y).toBeGreaterThanOrEqual(0);
    }
  });
});
