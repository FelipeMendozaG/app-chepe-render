import { describe, expect, it } from 'vitest';
import {
  analyzeGroupGeometryWarnings,
  hasBlockingErrors,
  validateEntityName,
  validateGeometry,
  validateMaterial,
} from './validation';
import type { BoxEntity, Entity, GroupEntity } from './types';

function makeBox(id: string, overrides: Partial<BoxEntity> = {}): BoxEntity {
  return {
    id,
    type: 'box',
    name: id,
    parentId: 'g1',
    layer: 'main',
    visible: true,
    locked: false,
    materialId: 'mat-oak-natural',
    transform: { position: [0, 0, 0], rotation: [0, 0, 0] },
    geometry: { width: 1, height: 0.5, depth: 0.5 },
    ...overrides,
  };
}

describe('validation', () => {
  it('bloquea medidas <= 0 y nombres vacíos con mensajes en la unidad activa', () => {
    const issues = validateGeometry('box', { width: 0, height: -0.2, depth: 0.5 }, 'cm');
    expect(hasBlockingErrors(issues)).toBe(true);
    expect(issues.some((i) => i.message.includes('0 cm'))).toBe(true);
    expect(validateEntityName('   ')?.severity).toBe('error');
  });

  it('emite advertencias no bloqueantes para dimensiones extremas (< 1 mm o > 50 m)', () => {
    const smallIssues = validateGeometry(
      'box',
      { width: 0.0005, height: 0.5, depth: 0.5 },
      'mm',
    );
    expect(hasBlockingErrors(smallIssues)).toBe(false);
    expect(smallIssues.some((i) => i.code === 'DIMENSION_VERY_SMALL')).toBe(true);

    const largeIssues = validateGeometry(
      'plane',
      { width: 60, depth: 2 },
      'm',
    );
    expect(hasBlockingErrors(largeIssues)).toBe(false);
    expect(largeIssues.some((i) => i.code === 'DIMENSION_VERY_LARGE')).toBe(true);
  });

  it('valida parámetros de material', () => {
    expect(hasBlockingErrors(validateMaterial({ color: '#c9a575', roughness: 0.5, metalness: 0 }))).toBe(false);
    expect(hasBlockingErrors(validateMaterial({ color: 'rojo' }))).toBe(true);
    expect(hasBlockingErrors(validateMaterial({ roughness: 1.5 }))).toBe(true);
  });

  it('detecta piezas superpuestas y flotantes dentro de un grupo por AABB', () => {
    const group: GroupEntity = {
      id: 'g1',
      type: 'group',
      name: 'Mueble',
      parentId: null,
      layer: 'main',
      visible: true,
      locked: false,
      transform: { position: [0, 0, 0], rotation: [0, 0, 0] },
    };

    // Caso limpio: pata en el suelo (0..0.73) + cubierta apoyada justo encima (0.73..0.75)
    const leg = makeBox('Pata', {
      transform: { position: [0, 0, 0], rotation: [0, 0, 0] },
      geometry: { width: 0.1, height: 0.73, depth: 0.5 },
    });
    const top = makeBox('Cubierta', {
      transform: { position: [0, 0.73, 0], rotation: [0, 0, 0] },
      geometry: { width: 1.2, height: 0.02, depth: 0.6 },
    });
    expect(analyzeGroupGeometryWarnings('g1', [group, leg, top])).toEqual([]);

    // Caso con pieza flotante y pieza superpuesta
    const floating = makeBox('Estante flotante', {
      transform: { position: [0, 1.5, 0], rotation: [0, 0, 0] },
      geometry: { width: 0.5, height: 0.02, depth: 0.3 },
    });
    const overlapping = makeBox('Refuerzo cruzado', {
      transform: { position: [0, 0.2, 0], rotation: [0, 0, 0] },
      geometry: { width: 0.5, height: 0.2, depth: 0.5 },
    });

    const entities: Entity[] = [group, leg, top, floating, overlapping];
    const warnings = analyzeGroupGeometryWarnings('g1', entities);
    expect(warnings.some((w) => w.code === 'GROUP_PIECE_FLOATING')).toBe(true);
    expect(warnings.some((w) => w.code === 'GROUP_PIECES_OVERLAPPING')).toBe(true);
  });
});
