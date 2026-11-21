import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { DimensionsOverlay } from './DimensionsOverlay';

describe('DimensionsOverlay', () => {
  it('genera líneas exteriores para ancho/alto/profundidad y omite alto en planos', () => {
    const scene = new THREE.Scene();
    const overlay = new DimensionsOverlay(scene);

    overlay.sync(true, { min: [-0.9, 0, -0.3], max: [0.9, 0.75, 0.3] }, 'cm');
    expect(overlay.group.visible).toBe(true);
    // 5 lines per axis (2 extension + 1 main + 2 ticks) * 3 axes = 15 lines
    const boxLineCount = overlay.group.children.filter(
      (c) => c instanceof THREE.Line,
    ).length;
    expect(boxLineCount).toBe(15);

    // Plano horizontal (height = 0): solo ejes X y Z -> 10 líneas
    overlay.sync(true, { min: [-0.5, 0, -0.5], max: [0.5, 0, 0.5] }, 'cm');
    const planeLineCount = overlay.group.children.filter(
      (c) => c instanceof THREE.Line,
    ).length;
    expect(planeLineCount).toBe(10);

    overlay.dispose();
  });

  it('evita reconstruir si la firma no cambió y libera geometrías al ocultarse o actualizarse', () => {
    const scene = new THREE.Scene();
    const overlay = new DimensionsOverlay(scene);
    const aabb = {
      min: [-0.5, 0, -0.5] as [number, number, number],
      max: [0.5, 0.5, 0.5] as [number, number, number],
    };

    overlay.sync(true, aabb, 'cm');
    const firstLine = overlay.group.children.find(
      (c): c is THREE.Line => c instanceof THREE.Line,
    )!;
    const disposeSpy = vi.spyOn(firstLine.geometry, 'dispose');

    // Misma firma -> no reconstruye ni libera
    overlay.sync(true, aabb, 'cm');
    expect(disposeSpy).not.toHaveBeenCalled();

    // Cambio de unidad -> reconstruye y libera las geometrías anteriores
    overlay.sync(true, aabb, 'mm');
    expect(disposeSpy).toHaveBeenCalledTimes(1);

    // Ocultar -> limpia y oculta
    overlay.sync(false, aabb, 'mm');
    expect(overlay.group.visible).toBe(false);
    expect(overlay.group.children).toHaveLength(0);

    overlay.dispose();
  });
});
