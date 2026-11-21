import { describe, expect, it } from 'vitest';
import {
  aabbToDimensions,
  applyScaleToGeometry,
  canReparent,
  findFreePlacementPosition,
  getEntityWorldAABB,
  getLocalBounds,
  getProjectWorldAABB,
} from './geometry';
import type {
  BoxEntity,
  CylinderEntity,
  Entity,
  GroupEntity,
  PlaneEntity,
  SphereEntity,
} from './types';

function makeBox(id: string, overrides: Partial<BoxEntity> = {}): BoxEntity {
  return {
    id,
    type: 'box',
    name: id,
    parentId: null,
    layer: 'main',
    visible: true,
    locked: false,
    materialId: 'mat-oak-natural',
    transform: { position: [0, 0, 0], rotation: [0, 0, 0] },
    geometry: { width: 1, height: 0.5, depth: 0.4 },
    ...overrides,
  };
}

describe('geometry y pivote Y=0', () => {
  it('calcula bounds locales con pivote en base inferior (Y=0)', () => {
    const box = makeBox('b1', { geometry: { width: 2, height: 0.8, depth: 0.6 } });
    expect(getLocalBounds(box)).toEqual({
      min: [-1, 0, -0.3],
      max: [1, 0.8, 0.3],
    });

    const cyl: CylinderEntity = {
      id: 'c1',
      type: 'cylinder',
      name: 'Cilindro',
      parentId: null,
      layer: 'main',
      visible: true,
      locked: false,
      materialId: 'mat-steel',
      transform: { position: [0, 0, 0], rotation: [0, 0, 0] },
      geometry: { radius: 0.05, height: 0.75 },
    };
    expect(getLocalBounds(cyl)).toEqual({
      min: [-0.05, 0, -0.05],
      max: [0.05, 0.75, 0.05],
    });

    const sphere: SphereEntity = {
      id: 's1',
      type: 'sphere',
      name: 'Esfera',
      parentId: null,
      layer: 'main',
      visible: true,
      locked: false,
      materialId: 'mat-sage',
      transform: { position: [0, 0, 0], rotation: [0, 0, 0] },
      geometry: { radius: 0.1 },
    };
    expect(getLocalBounds(sphere)).toEqual({
      min: [-0.1, 0, -0.1],
      max: [0.1, 0.2, 0.1],
    });

    const plane: PlaneEntity = {
      id: 'p1',
      type: 'plane',
      name: 'Plano',
      parentId: null,
      layer: 'main',
      visible: true,
      locked: false,
      materialId: 'mat-warm-gray',
      transform: { position: [0, 0, 0], rotation: [0, 0, 0] },
      geometry: { width: 1.2, depth: 0.8 },
    };
    expect(getLocalBounds(plane)).toEqual({
      min: [-0.6, 0, -0.4],
      max: [0.6, 0, 0.4],
    });
  });

  it('calcula medidas envolventes mundiales para un grupo con hijos y rotación', () => {
    const group: GroupEntity = {
      id: 'g1',
      type: 'group',
      name: 'Escritorio',
      parentId: null,
      layer: 'main',
      visible: true,
      locked: false,
      transform: { position: [1, 0, 0], rotation: [0, Math.PI / 2, 0] },
    };
    const top = makeBox('top', {
      parentId: 'g1',
      transform: { position: [0, 0.73, 0], rotation: [0, 0, 0] },
      geometry: { width: 1.8, height: 0.02, depth: 0.6 },
    });
    const leg = makeBox('leg', {
      parentId: 'g1',
      transform: { position: [-0.85, 0, 0], rotation: [0, 0, 0] },
      geometry: { width: 0.1, height: 0.73, depth: 0.6 },
    });
    const entities: Entity[] = [group, top, leg];

    const aabb = getEntityWorldAABB('g1', entities)!;
    const dims = aabbToDimensions(aabb);
    // Rotated 90° around Y: local X (1.8m) becomes world Z, local Z (0.6m) becomes world X
    expect(dims.width).toBeCloseTo(0.6, 4);
    expect(dims.height).toBeCloseTo(0.75, 4);
    expect(dims.depth).toBeCloseTo(1.8, 4);
  });

  it('respeta capa accessories al calcular el AABB del proyecto', () => {
    const mainBox = makeBox('b1', {
      geometry: { width: 1, height: 1, depth: 1 },
      layer: 'main',
    });
    const accessory = makeBox('acc1', {
      geometry: { width: 1, height: 2, depth: 1 },
      transform: { position: [3, 0, 0], rotation: [0, 0, 0] },
      layer: 'accessories',
    });

    const withAcc = getProjectWorldAABB([mainBox, accessory], {
      showAccessories: true,
    })!;
    const withoutAcc = getProjectWorldAABB([mainBox, accessory], {
      showAccessories: false,
    })!;

    expect(aabbToDimensions(withAcc).width).toBeCloseTo(4, 4);
    expect(aabbToDimensions(withoutAcc).width).toBeCloseTo(1, 4);
  });

  it('normaliza escala por primitiva sin dejar escala arbitraria', () => {
    const box = makeBox('b1', { geometry: { width: 1, height: 0.5, depth: 0.4 } });
    expect(applyScaleToGeometry(box, [1.5, 2, 0.5])).toEqual({
      width: 1.5,
      height: 1,
      depth: 0.2,
    });

    const cyl: CylinderEntity = {
      id: 'c1',
      type: 'cylinder',
      name: 'Barra',
      parentId: null,
      layer: 'main',
      visible: true,
      locked: false,
      materialId: 'mat-steel',
      transform: { position: [0, 0, 0], rotation: [0, 0, 0] },
      geometry: { radius: 0.05, height: 1, radialSegments: 32 },
    };
    // Scaling only X updates radius uniformly; Y scales height independently
    expect(applyScaleToGeometry(cyl, [2, 1.5, 1])).toEqual({
      radius: 0.1,
      height: 1.5,
      radialSegments: 32,
    });

    const sphere: SphereEntity = {
      id: 's1',
      type: 'sphere',
      name: 'Esfera',
      parentId: null,
      layer: 'main',
      visible: true,
      locked: false,
      materialId: 'mat-sage',
      transform: { position: [0, 0, 0], rotation: [0, 0, 0] },
      geometry: { radius: 0.1, widthSegments: 32, heightSegments: 24 },
    };
    // Uniform scaling when pulling a single axis
    expect(applyScaleToGeometry(sphere, [1, 1.5, 1])).toEqual({
      radius: 0.15,
      widthSegments: 32,
      heightSegments: 24,
    });

    const plane: PlaneEntity = {
      id: 'p1',
      type: 'plane',
      name: 'Plano',
      parentId: null,
      layer: 'main',
      visible: true,
      locked: false,
      materialId: 'mat-warm-gray',
      transform: { position: [0, 0, 0], rotation: [0, 0, 0] },
      geometry: { width: 1, depth: 2 },
    };
    // Plane ignores Y scale
    expect(applyScaleToGeometry(plane, [2, 5, 0.5])).toEqual({
      width: 2,
      depth: 1,
    });
  });

  it('evita ciclos y padres no-grupo en canReparent', () => {
    const g1: GroupEntity = {
      id: 'g1',
      type: 'group',
      name: 'G1',
      parentId: null,
      layer: 'main',
      visible: true,
      locked: false,
      transform: { position: [0, 0, 0], rotation: [0, 0, 0] },
    };
    const g2: GroupEntity = {
      id: 'g2',
      type: 'group',
      name: 'G2',
      parentId: 'g1',
      layer: 'main',
      visible: true,
      locked: false,
      transform: { position: [0, 0, 0], rotation: [0, 0, 0] },
    };
    const b1 = makeBox('b1', { parentId: 'g2' });
    const entities: Entity[] = [g1, g2, b1];

    expect(canReparent('g1', 'g1', entities)).toBe(false);
    expect(canReparent('g1', 'g2', entities)).toBe(false);
    expect(canReparent('g2', 'b1', entities)).toBe(false);
    expect(canReparent('b1', 'g1', entities)).toBe(true);
    expect(canReparent('g2', null, entities)).toBe(true);
  });

  it('encuentra posición libre en el suelo (Y=0) cuando el origen está ocupado', () => {
    const existing = makeBox('b1', {
      transform: { position: [0, 0, 0], rotation: [0, 0, 0] },
      geometry: { width: 1, height: 0.5, depth: 0.6 },
    });
    const pos = findFreePlacementPosition(
      'box',
      { width: 1, height: 0.5, depth: 0.6 },
      [existing],
    );
    expect(pos[1]).toBe(0);
    expect(pos[0] !== 0 || pos[2] !== 0).toBe(true);
  });
});
