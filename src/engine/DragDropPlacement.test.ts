import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { DragDropPlacement } from './DragDropPlacement';

function createMockElement(width = 800, height = 600): HTMLElement {
  return {
    getBoundingClientRect: () =>
      ({
        left: 0,
        top: 0,
        width,
        height,
        right: width,
        bottom: height,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect,
  } as HTMLElement;
}

describe('DragDropPlacement', () => {
  it('apoya sobre el suelo (Y = 0) cuando no hay superficies bajo el cursor', () => {
    const scene = new THREE.Scene();
    const placement = new DragDropPlacement(scene);
    const camera = new THREE.PerspectiveCamera(45, 800 / 600, 0.1, 100);
    camera.position.set(0, 3, 3);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();

    const pos = placement.computePlacementPosition(
      400,
      300,
      createMockElement(),
      camera,
      [],
    );

    expect(pos).not.toBeNull();
    expect(pos![1]).toBe(0);
    expect(pos![0]).toBeCloseTo(0, 2);
    expect(pos![2]).toBeCloseTo(0, 2);

    placement.dispose();
  });

  it('apoya sobre la cara superior horizontal de una pieza existente', () => {
    const scene = new THREE.Scene();
    const placement = new DragDropPlacement(scene);
    const camera = new THREE.PerspectiveCamera(45, 800 / 600, 0.1, 100);
    camera.position.set(0, 3, 0.001);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();

    // Tablero de 1.2 x 0.75 x 0.6 con pivote en base Y=0 (cara superior en Y = 0.75)
    const tableMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.75, 0.6),
      new THREE.MeshBasicMaterial(),
    );
    tableMesh.position.set(0, 0.375, 0);
    tableMesh.updateMatrixWorld(true);

    const pos = placement.computePlacementPosition(
      400,
      300,
      createMockElement(),
      camera,
      [tableMesh],
    );

    expect(pos).not.toBeNull();
    expect(pos![1]).toBeCloseTo(0.75, 3);

    tableMesh.geometry.dispose();
    (tableMesh.material as THREE.Material).dispose();
    placement.dispose();
  });
});
