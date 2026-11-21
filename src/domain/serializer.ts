import { DEFAULT_MATERIALS, DEFAULT_MATERIAL_ID } from './presets';
import {
  SCHEMA_VERSION,
  type DisplayUnit,
  type Entity,
  type EntityLayer,
  type MaterialDef,
  type PrimitiveEntity,
  type ProjectDocument,
  type Vec3,
} from './types';

export type DeserializeResult =
  | { ok: true; document: ProjectDocument }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidVec3(value: unknown): value is Vec3 {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((n) => typeof n === 'number' && Number.isFinite(n))
  );
}

function isPositiveFinite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isDisplayUnit(value: unknown): value is DisplayUnit {
  return value === 'mm' || value === 'cm' || value === 'm';
}

function isEntityLayer(value: unknown): value is EntityLayer {
  return value === 'main' || value === 'accessories';
}

function parseMaterial(raw: unknown, index: number): MaterialDef | string {
  if (!isRecord(raw)) {
    return `El material #${index + 1} no tiene un formato válido.`;
  }
  const { id, name, color, roughness, metalness } = raw;
  if (typeof id !== 'string' || !id.trim()) {
    return `El material #${index + 1} no tiene un identificador válido.`;
  }
  if (typeof name !== 'string' || !name.trim()) {
    return `El material "${id}" no tiene un nombre válido.`;
  }
  if (typeof color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(color)) {
    return `El material "${name}" tiene un color inválido.`;
  }
  if (
    typeof roughness !== 'number' ||
    !Number.isFinite(roughness) ||
    roughness < 0 ||
    roughness > 1
  ) {
    return `El material "${name}" tiene una rugosidad fuera de rango (0 a 1).`;
  }
  if (
    typeof metalness !== 'number' ||
    !Number.isFinite(metalness) ||
    metalness < 0 ||
    metalness > 1
  ) {
    return `El material "${name}" tiene una metalicidad fuera de rango (0 a 1).`;
  }

  return { id, name, color, roughness, metalness };
}

function parseEntity(
  raw: unknown,
  index: number,
  validMaterialIds: Set<string>,
  fallbackMaterialId: string,
): Entity | string {
  if (!isRecord(raw)) {
    return `La entidad #${index + 1} no tiene un formato válido.`;
  }

  const { id, type, name, parentId, layer, visible, locked, transform } = raw;
  if (typeof id !== 'string' || !id.trim()) {
    return `La entidad #${index + 1} no tiene un identificador válido.`;
  }
  if (typeof name !== 'string' || !name.trim()) {
    return `La entidad "${id}" no tiene un nombre válido.`;
  }
  if (parentId !== null && typeof parentId !== 'string') {
    return `La entidad "${name}" tiene una referencia de padre inválida.`;
  }
  const resolvedLayer: EntityLayer =
    layer === undefined ? 'main' : isEntityLayer(layer) ? layer : 'main';
  if (layer !== undefined && !isEntityLayer(layer)) {
    return `La entidad "${name}" tiene una capa inválida (debe ser "main" o "accessories").`;
  }
  if (typeof visible !== 'boolean' || typeof locked !== 'boolean') {
    return `La entidad "${name}" tiene propiedades de visibilidad o bloqueo inválidas.`;
  }
  if (
    !isRecord(transform) ||
    !isValidVec3(transform.position) ||
    !isValidVec3(transform.rotation)
  ) {
    return `La entidad "${name}" tiene una transformación (posición/rotación) inválida.`;
  }

  const base = {
    id,
    name: name.trim(),
    parentId,
    layer: resolvedLayer,
    visible,
    locked,
    transform: {
      position: [...transform.position] as Vec3,
      rotation: [...transform.rotation] as Vec3,
    },
  };

  if (type === 'group') {
    return { ...base, type: 'group' };
  }

  const rawMaterialId = raw.materialId;
  const materialId =
    typeof rawMaterialId === 'string' && validMaterialIds.has(rawMaterialId)
      ? rawMaterialId
      : fallbackMaterialId;

  const geometry = raw.geometry;
  if (!isRecord(geometry)) {
    return `La pieza "${name}" no contiene parámetros de geometría válidos.`;
  }

  switch (type) {
    case 'box': {
      if (
        !isPositiveFinite(geometry.width) ||
        !isPositiveFinite(geometry.height) ||
        !isPositiveFinite(geometry.depth)
      ) {
        return `La caja "${name}" tiene medidas inválidas (deben ser mayores a 0).`;
      }
      return {
        ...base,
        type: 'box',
        materialId,
        geometry: {
          width: geometry.width,
          height: geometry.height,
          depth: geometry.depth,
        },
      };
    }
    case 'cylinder': {
      if (
        !isPositiveFinite(geometry.radius) ||
        !isPositiveFinite(geometry.height)
      ) {
        return `El cilindro "${name}" tiene medidas inválidas (radio y alto deben ser mayores a 0).`;
      }
      const radialSegments =
        typeof geometry.radialSegments === 'number' &&
        Number.isInteger(geometry.radialSegments) &&
        geometry.radialSegments >= 6 &&
        geometry.radialSegments <= 128
          ? geometry.radialSegments
          : undefined;
      return {
        ...base,
        type: 'cylinder',
        materialId,
        geometry: {
          radius: geometry.radius,
          height: geometry.height,
          ...(radialSegments !== undefined ? { radialSegments } : {}),
        },
      };
    }
    case 'sphere': {
      if (!isPositiveFinite(geometry.radius)) {
        return `La esfera "${name}" tiene un radio inválido (debe ser mayor a 0).`;
      }
      const widthSegments =
        typeof geometry.widthSegments === 'number' &&
        Number.isInteger(geometry.widthSegments) &&
        geometry.widthSegments >= 6 &&
        geometry.widthSegments <= 128
          ? geometry.widthSegments
          : undefined;
      const heightSegments =
        typeof geometry.heightSegments === 'number' &&
        Number.isInteger(geometry.heightSegments) &&
        geometry.heightSegments >= 4 &&
        geometry.heightSegments <= 128
          ? geometry.heightSegments
          : undefined;
      return {
        ...base,
        type: 'sphere',
        materialId,
        geometry: {
          radius: geometry.radius,
          ...(widthSegments !== undefined ? { widthSegments } : {}),
          ...(heightSegments !== undefined ? { heightSegments } : {}),
        },
      };
    }
    case 'plane': {
      if (
        !isPositiveFinite(geometry.width) ||
        !isPositiveFinite(geometry.depth)
      ) {
        return `El plano "${name}" tiene medidas inválidas (ancho y largo deben ser mayores a 0).`;
      }
      return {
        ...base,
        type: 'plane',
        materialId,
        geometry: {
          width: geometry.width,
          depth: geometry.depth,
        },
      };
    }
    default:
      return `La entidad "${name}" tiene un tipo desconocido ("${String(type)}").`;
  }
}

function hasParentCycle(entities: readonly Entity[]): boolean {
  const byId = new Map(entities.map((e) => [e.id, e]));
  for (const entity of entities) {
    const visited = new Set<string>([entity.id]);
    let parentId = entity.parentId;
    while (parentId) {
      if (visited.has(parentId)) return true;
      visited.add(parentId);
      const parent = byId.get(parentId);
      if (!parent) break;
      parentId = parent.parentId;
    }
  }
  return false;
}

export function serializeProject(document: ProjectDocument): string {
  return JSON.stringify(document, null, 2);
}

export function deserializeProject(jsonText: string): DeserializeResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return {
      ok: false,
      error: 'El archivo no contiene un JSON válido.',
    };
  }

  if (!isRecord(parsed)) {
    return {
      ok: false,
      error: 'El archivo JSON no tiene la estructura esperada de un proyecto.',
    };
  }

  if (parsed.schemaVersion !== SCHEMA_VERSION) {
    return {
      ok: false,
      error: `Versión de esquema no soportada (${String(parsed.schemaVersion)}). Se esperaba schemaVersion: ${SCHEMA_VERSION}.`,
    };
  }

  if (!isRecord(parsed.project)) {
    return {
      ok: false,
      error: 'Faltan los metadatos del proyecto ("project").',
    };
  }

  const { id, name, description, displayUnit, createdAt, updatedAt } =
    parsed.project;
  if (typeof id !== 'string' || !id.trim()) {
    return { ok: false, error: 'El proyecto no tiene un identificador válido.' };
  }
  if (typeof name !== 'string' || !name.trim()) {
    return { ok: false, error: 'El proyecto no tiene un nombre válido.' };
  }
  if (!isDisplayUnit(displayUnit)) {
    return {
      ok: false,
      error: 'La unidad de visualización debe ser "mm", "cm" o "m".',
    };
  }

  const now = new Date().toISOString();
  const rawSettings = isRecord(parsed.settings) ? parsed.settings : {};
  const settings = {
    showGrid:
      typeof rawSettings.showGrid === 'boolean' ? rawSettings.showGrid : true,
    showAxes:
      typeof rawSettings.showAxes === 'boolean' ? rawSettings.showAxes : true,
    showDimensions:
      typeof rawSettings.showDimensions === 'boolean'
        ? rawSettings.showDimensions
        : true,
    showSummaryCard:
      typeof rawSettings.showSummaryCard === 'boolean'
        ? rawSettings.showSummaryCard
        : true,
    showAccessories:
      typeof rawSettings.showAccessories === 'boolean'
        ? rawSettings.showAccessories
        : true,
    gridSpacing:
      typeof rawSettings.gridSpacing === 'number' &&
      Number.isFinite(rawSettings.gridSpacing) &&
      rawSettings.gridSpacing > 0
        ? rawSettings.gridSpacing
        : 0.1,
  };

  if (!Array.isArray(parsed.materials)) {
    return {
      ok: false,
      error: 'La lista de materiales ("materials") no es válida.',
    };
  }

  const materials: MaterialDef[] = [];
  const seenMaterialIds = new Set<string>();
  for (let i = 0; i < parsed.materials.length; i++) {
    const mat = parseMaterial(parsed.materials[i], i);
    if (typeof mat === 'string') {
      return { ok: false, error: mat };
    }
    if (seenMaterialIds.has(mat.id)) {
      return {
        ok: false,
        error: `Existe un identificador de material duplicado ("${mat.id}").`,
      };
    }
    seenMaterialIds.add(mat.id);
    materials.push(mat);
  }

  if (materials.length === 0) {
    for (const def of DEFAULT_MATERIALS) {
      materials.push({ ...def });
      seenMaterialIds.add(def.id);
    }
  }

  const fallbackMaterialId = seenMaterialIds.has(DEFAULT_MATERIAL_ID)
    ? DEFAULT_MATERIAL_ID
    : materials[0].id;

  if (!Array.isArray(parsed.entities)) {
    return {
      ok: false,
      error: 'La lista de entidades ("entities") no es válida.',
    };
  }

  const entities: Entity[] = [];
  const seenEntityIds = new Set<string>();
  for (let i = 0; i < parsed.entities.length; i++) {
    const ent = parseEntity(
      parsed.entities[i],
      i,
      seenMaterialIds,
      fallbackMaterialId,
    );
    if (typeof ent === 'string') {
      return { ok: false, error: ent };
    }
    if (seenEntityIds.has(ent.id)) {
      return {
        ok: false,
        error: `Existe un identificador de entidad duplicado ("${ent.id}").`,
      };
    }
    seenEntityIds.add(ent.id);
    entities.push(ent);
  }

  // Verify parent references point to existing groups
  const entityMap = new Map(entities.map((e) => [e.id, e]));
  for (const entity of entities) {
    if (entity.parentId !== null) {
      const parent = entityMap.get(entity.parentId);
      if (!parent || parent.type !== 'group') {
        return {
          ok: false,
          error: `La entidad "${entity.name}" referencia un grupo padre inexistente o inválido.`,
        };
      }
    }
  }

  if (hasParentCycle(entities)) {
    return {
      ok: false,
      error: 'La jerarquía del proyecto contiene referencias cíclicas inválidas.',
    };
  }

  const document: ProjectDocument = {
    schemaVersion: SCHEMA_VERSION,
    project: {
      id: id.trim(),
      name: name.trim(),
      description: typeof description === 'string' ? description : '',
      displayUnit,
      createdAt: typeof createdAt === 'string' ? createdAt : now,
      updatedAt: typeof updatedAt === 'string' ? updatedAt : now,
    },
    settings,
    materials,
    entities: entities as Array<Entity | PrimitiveEntity>,
    parameters: Array.isArray(parsed.parameters) ? parsed.parameters : [],
    constraints: Array.isArray(parsed.constraints) ? parsed.constraints : [],
  };

  return { ok: true, document };
}
