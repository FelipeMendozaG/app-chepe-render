import {
  buildEntityMap,
  getDescendantPrimitives,
  getLocalBounds,
  getWorldMatrix,
  transformAABB,
} from './geometry';
import { formatLength } from './units';
import type {
  AABB,
  DisplayUnit,
  Entity,
  GeometryParams,
  MaterialDef,
  PrimitiveType,
  ValidationIssue,
} from './types';

export const SMALL_DIMENSION_WARNING_METERS = 0.001; // 1 mm
export const LARGE_DIMENSION_WARNING_METERS = 50; // 50 m
export const DEFAULT_GROUP_AABB_TOLERANCE_METERS = 0.002; // 2 mm

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

export function validateEntityName(name: string): ValidationIssue | null {
  if (!name || name.trim().length === 0) {
    return {
      severity: 'error',
      code: 'EMPTY_ENTITY_NAME',
      field: 'name',
      message: 'El nombre de la pieza o grupo no puede estar vacío.',
    };
  }
  return null;
}

export function validateProjectName(name: string): ValidationIssue | null {
  if (!name || name.trim().length === 0) {
    return {
      severity: 'error',
      code: 'EMPTY_PROJECT_NAME',
      field: 'name',
      message: 'El nombre del proyecto no puede estar vacío.',
    };
  }
  return null;
}

export function validateDimensionMeters(
  valueMeters: number,
  label: string,
  field: string,
  unit: DisplayUnit,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (typeof valueMeters !== 'number' || !Number.isFinite(valueMeters)) {
    issues.push({
      severity: 'error',
      code: 'INVALID_NUMBER',
      field,
      message: `Introduce un valor numérico válido para ${label.toLowerCase()}.`,
    });
    return issues;
  }

  if (valueMeters <= 0) {
    issues.push({
      severity: 'error',
      code: 'NON_POSITIVE_DIMENSION',
      field,
      message: `${label} debe ser mayor que 0 ${unit} para generar la pieza.`,
    });
    return issues;
  }

  if (valueMeters < SMALL_DIMENSION_WARNING_METERS) {
    issues.push({
      severity: 'warning',
      code: 'DIMENSION_VERY_SMALL',
      field,
      message: `${label} (${formatLength(valueMeters, unit)}) es muy pequeño (menor a 1 mm).`,
    });
  } else if (valueMeters > LARGE_DIMENSION_WARNING_METERS) {
    issues.push({
      severity: 'warning',
      code: 'DIMENSION_VERY_LARGE',
      field,
      message: `${label} (${formatLength(valueMeters, unit)}) es muy grande (mayor a 50 m).`,
    });
  }

  return issues;
}

export function validateGeometry(
  type: PrimitiveType,
  geometry: GeometryParams,
  unit: DisplayUnit,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  switch (type) {
    case 'box': {
      const g = geometry as { width: number; height: number; depth: number };
      issues.push(
        ...validateDimensionMeters(g.width, 'El ancho', 'width', unit),
        ...validateDimensionMeters(g.height, 'El alto', 'height', unit),
        ...validateDimensionMeters(g.depth, 'La profundidad', 'depth', unit),
      );
      break;
    }
    case 'cylinder': {
      const g = geometry as {
        radius: number;
        height: number;
        radialSegments?: number;
      };
      issues.push(
        ...validateDimensionMeters(g.radius * 2, 'El diámetro', 'radius', unit),
        ...validateDimensionMeters(g.height, 'El alto', 'height', unit),
      );
      if (
        g.radialSegments !== undefined &&
        (!Number.isInteger(g.radialSegments) ||
          g.radialSegments < 6 ||
          g.radialSegments > 128)
      ) {
        issues.push({
          severity: 'error',
          code: 'INVALID_SEGMENTS',
          field: 'radialSegments',
          message: 'Los segmentos radiales deben ser un entero entre 6 y 128.',
        });
      }
      break;
    }
    case 'sphere': {
      const g = geometry as {
        radius: number;
        widthSegments?: number;
        heightSegments?: number;
      };
      issues.push(
        ...validateDimensionMeters(g.radius * 2, 'El diámetro', 'radius', unit),
      );
      if (
        g.widthSegments !== undefined &&
        (!Number.isInteger(g.widthSegments) ||
          g.widthSegments < 6 ||
          g.widthSegments > 128)
      ) {
        issues.push({
          severity: 'error',
          code: 'INVALID_SEGMENTS',
          field: 'widthSegments',
          message:
            'Los segmentos horizontales deben ser un entero entre 6 y 128.',
        });
      }
      if (
        g.heightSegments !== undefined &&
        (!Number.isInteger(g.heightSegments) ||
          g.heightSegments < 4 ||
          g.heightSegments > 128)
      ) {
        issues.push({
          severity: 'error',
          code: 'INVALID_SEGMENTS',
          field: 'heightSegments',
          message:
            'Los segmentos verticales deben ser un entero entre 4 y 128.',
        });
      }
      break;
    }
    case 'plane': {
      const g = geometry as { width: number; depth: number };
      issues.push(
        ...validateDimensionMeters(g.width, 'El ancho', 'width', unit),
        ...validateDimensionMeters(g.depth, 'El largo', 'depth', unit),
      );
      break;
    }
  }

  return issues;
}

export function validateMaterial(
  material: Partial<MaterialDef>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (material.color !== undefined && !HEX_COLOR_PATTERN.test(material.color)) {
    issues.push({
      severity: 'error',
      code: 'INVALID_COLOR',
      field: 'color',
      message: 'El color debe tener formato hexadecimal válido (ej. #c9a575).',
    });
  }

  if (
    material.roughness !== undefined &&
    (!Number.isFinite(material.roughness) ||
      material.roughness < 0 ||
      material.roughness > 1)
  ) {
    issues.push({
      severity: 'error',
      code: 'INVALID_ROUGHNESS',
      field: 'roughness',
      message: 'La rugosidad debe estar entre 0 y 1.',
    });
  }

  if (
    material.metalness !== undefined &&
    (!Number.isFinite(material.metalness) ||
      material.metalness < 0 ||
      material.metalness > 1)
  ) {
    issues.push({
      severity: 'error',
      code: 'INVALID_METALNESS',
      field: 'metalness',
      message: 'La metalicidad debe estar entre 0 y 1.',
    });
  }

  return issues;
}

export function hasBlockingErrors(issues: readonly ValidationIssue[]): boolean {
  return issues.some((issue) => issue.severity === 'error');
}

function axisOverlap(minA: number, maxA: number, minB: number, maxB: number): number {
  return Math.min(maxA, maxB) - Math.max(minA, minB);
}

function axisGap(minA: number, maxA: number, minB: number, maxB: number): number {
  return Math.max(0, Math.max(minA - maxB, minB - maxA));
}

function aabbsPenetrate(a: AABB, b: AABB, tolerance: number): boolean {
  const ox = axisOverlap(a.min[0], a.max[0], b.min[0], b.max[0]);
  const oy = axisOverlap(a.min[1], a.max[1], b.min[1], b.max[1]);
  const oz = axisOverlap(a.min[2], a.max[2], b.min[2], b.max[2]);
  return ox > tolerance && oy > tolerance && oz > tolerance;
}

function aabbsTouchOrOverlap(a: AABB, b: AABB, tolerance: number): boolean {
  const gx = axisGap(a.min[0], a.max[0], b.min[0], b.max[0]);
  const gy = axisGap(a.min[1], a.max[1], b.min[1], b.max[1]);
  const gz = axisGap(a.min[2], a.max[2], b.min[2], b.max[2]);
  return gx <= tolerance && gy <= tolerance && gz <= tolerance;
}

/**
 * Lightweight AABB-based advisory check for pieces inside a group:
 * - Detects overlapping pieces beyond tolerance.
 * - Detects floating pieces (not resting on floor Y=0 and not touching any peer).
 */
export function analyzeGroupGeometryWarnings(
  groupId: string,
  entities: readonly Entity[],
  toleranceMeters = DEFAULT_GROUP_AABB_TOLERANCE_METERS,
): ValidationIssue[] {
  const primitives = getDescendantPrimitives(groupId, entities);
  if (primitives.length === 0) return [];

  const entitiesById = buildEntityMap(entities);
  const items = primitives.map((entity) => ({
    entity,
    aabb: transformAABB(
      getLocalBounds(entity),
      getWorldMatrix(entity.id, entitiesById),
    ),
  }));

  const warnings: ValidationIssue[] = [];

  // 1. Overlapping pairs
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (aabbsPenetrate(items[i].aabb, items[j].aabb, toleranceMeters)) {
        warnings.push({
          severity: 'warning',
          code: 'GROUP_PIECES_OVERLAPPING',
          entityId: items[i].entity.id,
          message: `"${items[i].entity.name}" y "${items[j].entity.name}" parecen superponerse.`,
        });
      }
    }
  }

  // 2. Floating / disconnected pieces (above floor and not touching any peer in group)
  for (let i = 0; i < items.length; i++) {
    const current = items[i];
    const restingOnFloor = current.aabb.min[1] <= toleranceMeters;
    if (restingOnFloor) continue;

    let touchesPeer = false;
    for (let j = 0; j < items.length; j++) {
      if (i === j) continue;
      if (aabbsTouchOrOverlap(current.aabb, items[j].aabb, toleranceMeters)) {
        touchesPeer = true;
        break;
      }
    }

    if (!touchesPeer) {
      warnings.push({
        severity: 'warning',
        code: 'GROUP_PIECE_FLOATING',
        entityId: current.entity.id,
        message: `"${current.entity.name}" queda flotando sin contacto con el suelo ni con otras piezas del grupo.`,
      });
    }
  }

  return warnings;
}
