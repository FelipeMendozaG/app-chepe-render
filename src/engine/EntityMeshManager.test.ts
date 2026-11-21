import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_MATERIALS,
  type BoxEntity,
  type CylinderEntity,
  type Entity,
  type GroupEntity,
  type PlaneEntity,
  type SphereEntity,
} from '../domain';
import { EntityMeshManager } from './EntityMeshManager';

const MATERIALS = [...DEFAULT_MATERIALS];

function makeBox(id: string, overrides: Partial<BoxEntity> = {}): BoxEntity {
  return {
    id,
    type: 'box',
    name: id,
    parentId: null,
    layer: 'main',
    visible: true,
    locked: false,
    materialId: MATERIALS[0].id,
    transform: { position: [0, 0, 0], rotation: [0, 0, 0] },
    geometry: { width: 1.2, height: 0.4, depth: 0.6 },
    ...overrides,
  };
}

describe('EntityMeshManager', () => {
  it('aplica la convención de pivote en base inferior (Y = 0) para todas las primitivas', () => {
    const scene = new THREE.Scene();
    const manager = new EntityMeshManager(scene);

    const box = makeBox('b1', { geometry: { width: 1, height: 0.8, depth: 0.5 } });
    const cyl: CylinderEntity = {
      id: 'c1',
      type: 'cylinder',
      name: 'Cilindro',
      parentId: null,
      layer: 'main',
      visible: true,
      locked: false,
      materialId: MATERIALS[0].id,
      transform: { position: [0, 0, 0], rotation: [0, 0, 0] },
      geometry: { radius: 0.05, height: 0.75, radialSegments: 24 },
    };
    const sphere: SphereEntity = {
      id: 's1',
      type: 'sphere',
      name: 'Esfera',
      parentId: null,
      layer: 'main',
      visible: true,
      locked: false,
      materialId: MATERIALS[0].id,
      transform: { position: [0, 0, 0], rotation: [0, 0, 0] },
      geometry: { radius: 0.15 },
    };
    const plane: PlaneEntity = {
      id: 'p1',
      type: 'plane',
      name: 'Plano',
      parentId: null,
      layer: 'main',
      visible: true,
      locked: false,
      materialId: MATERIALS[0].id,
      transform: { position: [0, 0, 0], rotation: [0, 0, 0] },
      geometry: { width: 1, depth: 1 },
    };

    manager.sync([box, cyl, sphere, plane], MATERIALS, true, null);

    const getMesh = (id: string) =>
      manager
        .getEntityObject(id)!
        .children.find((c): c is THREE.Mesh => c instanceof THREE.Mesh)!;

    expect(getMesh('b1').position.y).toBeCloseTo(0.4, 5);
    expect(getMesh('c1').position.y).toBeCloseTo(0.375, 5);
    expect(getMesh('s1').position.y).toBeCloseTo(0.15, 5);

    const planeMesh = getMesh('p1');
    expect(planeMesh.position.y).toBe(0);
    expect(planeMesh.rotation.x).toBeCloseTo(-Math.PI / 2, 5);
    expect((planeMesh.material as THREE.MeshStandardMaterial).side).toBe(
      THREE.DoubleSide,
    );

    manager.dispose();
  });

  it('actualiza de forma incremental sin recrear geometrías sin cambios y ejecuta dispose() limpio', () => {
    const scene = new THREE.Scene();
    const manager = new EntityMeshManager(scene);

    const boxA = makeBox('a', { geometry: { width: 1, height: 0.5, depth: 0.5 } });
    const boxB = makeBox('b', { geometry: { width: 0.4, height: 0.4, depth: 0.4 } });

    manager.sync([boxA, boxB], MATERIALS, true, null);

    const meshA = manager
      .getEntityObject('a')!
      .children.find((c): c is THREE.Mesh => c instanceof THREE.Mesh)!;
    const meshB = manager
      .getEntityObject('b')!
      .children.find((c): c is THREE.Mesh => c instanceof THREE.Mesh)!;
    const geoA = meshA.geometry;
    const geoB = meshB.geometry;
    const disposeASpy = vi.spyOn(geoA, 'dispose');
    const disposeBSpy = vi.spyOn(geoB, 'dispose');

    // Mover A y cambiar dimensiones de B: A no debe recrear geometría; B sí y libera la anterior
    const boxAMoved = {
      ...boxA,
      transform: { position: [1, 0, 0] as [number, number, number], rotation: [0, 0, 0] as [number, number, number] },
    };
    const boxBResized = {
      ...boxB,
      geometry: { width: 0.8, height: 0.9, depth: 0.4 },
    };

    manager.sync([boxAMoved, boxBResized], MATERIALS, true, 'a');

    expect(meshA.geometry).toBe(geoA);
    expect(disposeASpy).not.toHaveBeenCalled();
    expect(meshB.geometry).not.toBe(geoB);
    expect(disposeBSpy).toHaveBeenCalledTimes(1);
    expect(meshB.position.y).toBeCloseTo(0.45, 5);

    // Eliminar A libera su geometría
    manager.sync([boxBResized], MATERIALS, true, null);
    expect(disposeASpy).toHaveBeenCalledTimes(1);
    expect(manager.getEntityObject('a')).toBeNull();

    manager.dispose();
  });

  it('mantiene jerarquía de grupos y oculta accesorios cuando showAccessories = false', () => {
    const scene = new THREE.Scene();
    const manager = new EntityMeshManager(scene);

    const grp: GroupEntity = {
      id: 'g1',
      type: 'group',
      name: 'Accesorios',
      parentId: null,
      layer: 'accessories',
      visible: true,
      locked: false,
      transform: { position: [0, 0.75, 0], rotation: [0, 0, 0] },
    };
    const child = makeBox('c1', { parentId: 'g1', layer: 'accessories' });
    const main = makeBox('m1', { layer: 'main' });
    const entities: Entity[] = [grp, child, main];

    manager.sync(entities, MATERIALS, true, null);
    expect(manager.getEntityObject('c1')!.parent).toBe(manager.getEntityObject('g1'));
    expect(manager.getPickableMeshes()).toHaveLength(2);

    manager.sync(entities, MATERIALS, false, null);
    expect(manager.getEntityObject('g1')!.visible).toBe(false);
    expect(manager.getPickableMeshes()).toHaveLength(1);
    expect(manager.pickEntityIdFromMesh(manager.getPickableMeshes()[0])).toBe('m1');

    manager.dispose();
  });
});
