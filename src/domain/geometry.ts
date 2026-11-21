import { generateCopyName, generateId } from './presets';
import { roundClean } from './units';
import {
  isGroupEntity,
  isPrimitiveEntity,
  type AABB,
  type Dimensions3D,
  type Entity,
  type GeometryParams,
  type PrimitiveEntity,
  type PrimitiveType,
  type Transform,
  type Vec3,
} from './types';

/** 4x4 row-major matrix */
export type Mat4 = readonly [
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
];

export const IDENTITY_MAT4: Mat4 = [
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1,
];

export const MIN_DIMENSION_METERS = 0.0005; // 0.5 mm

export function composeTransformMatrix(transform: Transform): Mat4 {
  const [tx, ty, tz] = transform.position;
  const [rx, ry, rz] = transform.rotation;

  const ca = Math.cos(rx);
  const sa = Math.sin(rx);
  const cb = Math.cos(ry);
  const sb = Math.sin(ry);
  const cc = Math.cos(rz);
  const sc = Math.sin(rz);

  // Intrinsic XYZ rotation (R = Rx * Ry * Rz), matching Three.js Euler(..., 'XYZ')
  const r00 = cb * cc;
  const r01 = -cb * sc;
  const r02 = sb;

  const r10 = sa * sb * cc + ca * sc;
  const r11 = -sa * sb * sc + ca * cc;
  const r12 = -sa * cb;

  const r20 = -ca * sb * cc + sa * sc;
  const r21 = ca * sb * sc + sa * cc;
  const r22 = ca * cb;

  return [
    r00, r01, r02, tx,
    r10, r11, r12, ty,
    r20, r21, r22, tz,
    0, 0, 0, 1,
  ];
}

export function multiplyMat4(a: Mat4, b: Mat4): Mat4 {
  const out = new Array<number>(16);
  for (let row = 0; row < 4; row++) {
    const r = row * 4;
    for (let col = 0; col < 4; col++) {
      out[r + col] =
        a[r] * b[col] +
        a[r + 1] * b[4 + col] +
        a[r + 2] * b[8 + col] +
        a[r + 3] * b[12 + col];
    }
  }
  return out as unknown as Mat4;
}

export function transformPoint(m: Mat4, p: Vec3): Vec3 {
  const [x, y, z] = p;
  return [
    m[0] * x + m[1] * y + m[2] * z + m[3],
    m[4] * x + m[5] * y + m[6] * z + m[7],
    m[8] * x + m[9] * y + m[10] * z + m[11],
  ];
}

/**
 * Local AABB with bottom-base pivot convention (Y = 0, centered in X and Z).
 */
export function getLocalBoundsForGeometry(
  type: PrimitiveType,
  geometry: GeometryParams,
): AABB {
  switch (type) {
    case 'box': {
      const g = geometry as { width: number; height: number; depth: number };
      const hw = g.width / 2;
      const hd = g.depth / 2;
      return {
        min: [-hw, 0, -hd],
        max: [hw, g.height, hd],
      };
    }
    case 'cylinder': {
      const g = geometry as { radius: number; height: number };
      return {
        min: [-g.radius, 0, -g.radius],
        max: [g.radius, g.height, g.radius],
      };
    }
    case 'sphere': {
      const g = geometry as { radius: number };
      return {
        min: [-g.radius, 0, -g.radius],
        max: [g.radius, g.radius * 2, g.radius],
      };
    }
    case 'plane': {
      const g = geometry as { width: number; depth: number };
      const hw = g.width / 2;
      const hd = g.depth / 2;
      return {
        min: [-hw, 0, -hd],
        max: [hw, 0, hd],
      };
    }
  }
}

export function getLocalBounds(entity: PrimitiveEntity): AABB {
  return getLocalBoundsForGeometry(entity.type, entity.geometry);
}

export function buildEntityMap(entities: readonly Entity[]): Map<string, Entity> {
  const map = new Map<string, Entity>();
  for (const entity of entities) {
    map.set(entity.id, entity);
  }
  return map;
}

export function getWorldMatrix(
  entityId: string,
  entitiesById: Map<string, Entity>,
): Mat4 {
  const chain: Entity[] = [];
  const visited = new Set<string>();
  let current = entitiesById.get(entityId);

  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    chain.push(current);
    current = current.parentId ? entitiesById.get(current.parentId) : undefined;
  }

  let world = IDENTITY_MAT4;
  for (let i = chain.length - 1; i >= 0; i--) {
    world = multiplyMat4(world, composeTransformMatrix(chain[i].transform));
  }
  return world;
}

export function isEntityEffectivelyVisible(
  entity: Entity,
  entitiesById: Map<string, Entity>,
  showAccessories: boolean,
): boolean {
  const visited = new Set<string>();
  let current: Entity | undefined = entity;

  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    if (!current.visible) return false;
    if (!showAccessories && current.layer === 'accessories') return false;
    current = current.parentId ? entitiesById.get(current.parentId) : undefined;
  }

  return true;
}

export function isEntityEffectivelyLocked(
  entity: Entity,
  entitiesById: Map<string, Entity>,
): boolean {
  const visited = new Set<string>();
  let current: Entity | undefined = entity;

  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    if (current.locked) return true;
    current = current.parentId ? entitiesById.get(current.parentId) : undefined;
  }

  return false;
}

export function getDescendantIds(
  parentId: string,
  entities: readonly Entity[],
): string[] {
  const childrenByParent = new Map<string, Entity[]>();
  for (const entity of entities) {
    if (entity.parentId) {
      const list = childrenByParent.get(entity.parentId) ?? [];
      list.push(entity);
      childrenByParent.set(entity.parentId, list);
    }
  }

  const result: string[] = [];
  const queue = [...(childrenByParent.get(parentId) ?? [])];
  const visited = new Set<string>([parentId]);

  while (queue.length > 0) {
    const next = queue.shift()!;
    if (visited.has(next.id)) continue;
    visited.add(next.id);
    result.push(next.id);
    const children = childrenByParent.get(next.id);
    if (children) {
      queue.push(...children);
    }
  }

  return result;
}

export function getDescendantPrimitives(
  groupId: string,
  entities: readonly Entity[],
): PrimitiveEntity[] {
  const descendantSet = new Set(getDescendantIds(groupId, entities));
  return entities.filter(
    (entity): entity is PrimitiveEntity =>
      descendantSet.has(entity.id) && isPrimitiveEntity(entity),
  );
}

export function canReparent(
  entityId: string,
  newParentId: string | null,
  entities: readonly Entity[],
): boolean {
  if (newParentId === null) return true;
  if (entityId === newParentId) return false;

  const targetParent = entities.find((e) => e.id === newParentId);
  if (!targetParent || !isGroupEntity(targetParent)) return false;

  const descendants = getDescendantIds(entityId, entities);
  return !descendants.includes(newParentId);
}

export function transformAABB(local: AABB, matrix: Mat4): AABB {
  const [minX, minY, minZ] = local.min;
  const [maxX, maxY, maxZ] = local.max;

  const corners: Vec3[] = [
    [minX, minY, minZ],
    [minX, minY, maxZ],
    [minX, maxY, minZ],
    [minX, maxY, maxZ],
    [maxX, minY, minZ],
    [maxX, minY, maxZ],
    [maxX, maxY, minZ],
    [maxX, maxY, maxZ],
  ];

  let outMinX = Infinity;
  let outMinY = Infinity;
  let outMinZ = Infinity;
  let outMaxX = -Infinity;
  let outMaxY = -Infinity;
  let outMaxZ = -Infinity;

  for (const corner of corners) {
    const [wx, wy, wz] = transformPoint(matrix, corner);
    if (wx < outMinX) outMinX = wx;
    if (wy < outMinY) outMinY = wy;
    if (wz < outMinZ) outMinZ = wz;
    if (wx > outMaxX) outMaxX = wx;
    if (wy > outMaxY) outMaxY = wy;
    if (wz > outMaxZ) outMaxZ = wz;
  }

  return {
    min: [roundClean(outMinX), roundClean(outMinY), roundClean(outMinZ)],
    max: [roundClean(outMaxX), roundClean(outMaxY), roundClean(outMaxZ)],
  };
}

export function unionAABBs(aabbs: readonly AABB[]): AABB | null {
  if (aabbs.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;

  for (const box of aabbs) {
    if (box.min[0] < minX) minX = box.min[0];
    if (box.min[1] < minY) minY = box.min[1];
    if (box.min[2] < minZ) minZ = box.min[2];
    if (box.max[0] > maxX) maxX = box.max[0];
    if (box.max[1] > maxY) maxY = box.max[1];
    if (box.max[2] > maxZ) maxZ = box.max[2];
  }

  return {
    min: [roundClean(minX), roundClean(minY), roundClean(minZ)],
    max: [roundClean(maxX), roundClean(maxY), roundClean(maxZ)],
  };
}

export function aabbToDimensions(aabb: AABB): Dimensions3D {
  return {
    width: roundClean(aabb.max[0] - aabb.min[0]),
    height: roundClean(aabb.max[1] - aabb.min[1]),
    depth: roundClean(aabb.max[2] - aabb.min[2]),
  };
}

export interface BoundsOptions {
  includeHidden?: boolean;
  showAccessories?: boolean;
}

export function getEntityWorldAABB(
  entityId: string,
  entities: readonly Entity[],
  options?: BoundsOptions,
): AABB | null {
  const entitiesById = buildEntityMap(entities);
  const entity = entitiesById.get(entityId);
  if (!entity) return null;

  const includeHidden = options?.includeHidden ?? true;
  const showAccessories = options?.showAccessories ?? true;

  if (isPrimitiveEntity(entity)) {
    if (
      !includeHidden &&
      !isEntityEffectivelyVisible(entity, entitiesById, showAccessories)
    ) {
      return null;
    }
    const worldMatrix = getWorldMatrix(entity.id, entitiesById);
    return transformAABB(getLocalBounds(entity), worldMatrix);
  }

  const descendants = getDescendantPrimitives(entity.id, entities);
  const childAABBs: AABB[] = [];
  for (const child of descendants) {
    if (
      !includeHidden &&
      !isEntityEffectivelyVisible(child, entitiesById, showAccessories)
    ) {
      continue;
    }
    const worldMatrix = getWorldMatrix(child.id, entitiesById);
    childAABBs.push(transformAABB(getLocalBounds(child), worldMatrix));
  }
  return unionAABBs(childAABBs);
}

export function getProjectWorldAABB(
  entities: readonly Entity[],
  options?: BoundsOptions,
): AABB | null {
  const entitiesById = buildEntityMap(entities);
  const includeHidden = options?.includeHidden ?? false;
  const showAccessories = options?.showAccessories ?? true;

  const aabbs: AABB[] = [];
  for (const entity of entities) {
    if (!isPrimitiveEntity(entity)) continue;
    if (
      !includeHidden &&
      !isEntityEffectivelyVisible(entity, entitiesById, showAccessories)
    ) {
      continue;
    }
    const worldMatrix = getWorldMatrix(entity.id, entitiesById);
    aabbs.push(transformAABB(getLocalBounds(entity), worldMatrix));
  }

  return unionAABBs(aabbs);
}

/**
 * Converts a transient 3D gizmo scale vector [sx, sy, sz] directly into real
 * geometric dimensions per primitive constraints, so scale always resets to [1,1,1].
 */
export function applyScaleToGeometry(
  entity: PrimitiveEntity,
  scale: Vec3,
  minDimensionMeters = MIN_DIMENSION_METERS,
): GeometryParams {
  const EPS = 1e-4;
  const sx = Math.max(EPS, Math.abs(scale[0]));
  const sy = Math.max(EPS, Math.abs(scale[1]));
  const sz = Math.max(EPS, Math.abs(scale[2]));

  const clampDim = (val: number) =>
    roundClean(Math.max(minDimensionMeters, val), 6);

  switch (entity.type) {
    case 'box':
      return {
        width: clampDim(entity.geometry.width * sx),
        height: clampDim(entity.geometry.height * sy),
        depth: clampDim(entity.geometry.depth * sz),
      };

    case 'cylinder': {
      const xChanged = Math.abs(sx - 1) > EPS;
      const zChanged = Math.abs(sz - 1) > EPS;
      let sRadial = 1;
      if (xChanged && !zChanged) {
        sRadial = sx;
      } else if (!xChanged && zChanged) {
        sRadial = sz;
      } else if (xChanged && zChanged) {
        sRadial = (sx + sz) / 2;
      }
      return {
        ...entity.geometry,
        radius: clampDim(entity.geometry.radius * sRadial),
        height: clampDim(entity.geometry.height * sy),
      };
    }

    case 'sphere': {
      const changed = [sx, sy, sz].filter((s) => Math.abs(s - 1) > EPS);
      const sUniform =
        changed.length === 0
          ? 1
          : changed.reduce((sum, s) => sum + s, 0) / changed.length;
      return {
        ...entity.geometry,
        radius: clampDim(entity.geometry.radius * sUniform),
      };
    }

    case 'plane':
      return {
        width: clampDim(entity.geometry.width * sx),
        depth: clampDim(entity.geometry.depth * sz),
      };
  }
}

function aabbsOverlapXZ(a: AABB, b: AABB, margin: number): boolean {
  return (
    a.min[0] < b.max[0] + margin &&
    a.max[0] > b.min[0] - margin &&
    a.min[2] < b.max[2] + margin &&
    a.max[2] > b.min[2] - margin
  );
}

/**
 * Finds a free floor placement (Y = 0) near the origin for 1-click quick object insertion.
 */
export function findFreePlacementPosition(
  type: PrimitiveType,
  geometry: GeometryParams,
  entities: readonly Entity[],
): Vec3 {
  const local = getLocalBoundsForGeometry(type, geometry);
  const existingAABBs: AABB[] = [];
  const entitiesById = buildEntityMap(entities);

  for (const entity of entities) {
    if (!isPrimitiveEntity(entity)) continue;
    const worldMatrix = getWorldMatrix(entity.id, entitiesById);
    const aabb = transformAABB(getLocalBounds(entity), worldMatrix);
    // Only consider objects resting near the floor
    if (aabb.min[1] < 0.05) {
      existingAABBs.push(aabb);
    }
  }

  const gap = 0.08;
  const candidateOffsets: Array<[number, number]> = [[0, 0]];
  const stepX = Math.max(0.35, local.max[0] - local.min[0] + gap);
  const stepZ = Math.max(0.35, local.max[2] - local.min[2] + gap);

  for (let ring = 1; ring <= 6; ring++) {
    for (let dx = -ring; dx <= ring; dx++) {
      for (let dz = -ring; dz <= ring; dz++) {
        if (Math.abs(dx) !== ring && Math.abs(dz) !== ring) continue;
        candidateOffsets.push([
          roundClean(dx * stepX, 4),
          roundClean(dz * stepZ, 4),
        ]);
      }
    }
  }

  for (const [cx, cz] of candidateOffsets) {
    const candidateAABB: AABB = {
      min: [local.min[0] + cx, 0, local.min[2] + cz],
      max: [local.max[0] + cx, local.max[1], local.max[2] + cz],
    };
    const collides = existingAABBs.some((other) =>
      aabbsOverlapXZ(candidateAABB, other, 0.02),
    );
    if (!collides) {
      return [cx, 0, cz];
    }
  }

  return [0, 0, 0];
}

export const DUPLICATE_GAP_METERS = 0.08;
const EMPTY_GROUP_DUPLICATE_STEP_METERS = 0.2;

function aabbsOverlap3D(a: AABB, b: AABB, tolerance = 0.005): boolean {
  return (
    a.min[0] < b.max[0] - tolerance &&
    a.max[0] > b.min[0] + tolerance &&
    a.min[1] < b.max[1] - tolerance &&
    a.max[1] > b.min[1] + tolerance &&
    a.min[2] < b.max[2] - tolerance &&
    a.max[2] > b.min[2] + tolerance
  );
}

function getEntitySubtreeAABBInParentSpace(
  entityId: string,
  entities: readonly Entity[],
  entitiesById: Map<string, Entity>,
): AABB | null {
  const root = entitiesById.get(entityId);
  if (!root) return null;

  const getRelativeMatrix = (targetId: string): Mat4 => {
    const chain: Entity[] = [];
    const visited = new Set<string>();
    let current = entitiesById.get(targetId);

    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      chain.push(current);
      if (current.id === entityId) break;
      current = current.parentId ? entitiesById.get(current.parentId) : undefined;
    }

    let mat = IDENTITY_MAT4;
    for (let i = chain.length - 1; i >= 0; i--) {
      mat = multiplyMat4(mat, composeTransformMatrix(chain[i].transform));
    }
    return mat;
  };

  if (isPrimitiveEntity(root)) {
    return transformAABB(getLocalBounds(root), getRelativeMatrix(root.id));
  }

  const descendants = getDescendantPrimitives(root.id, entities);
  const childAABBs = descendants.map((child) =>
    transformAABB(getLocalBounds(child), getRelativeMatrix(child.id)),
  );
  return unionAABBs(childAABBs);
}

export interface ClonedSubtreeResult {
  rootId: string;
  clonedEntities: Entity[];
}

/**
 * Clones a primitive or group (with all nested descendants), remapping IDs and
 * parentId links, naming the root with the "copia" suffix, and offsetting the
 * root to the side (+X) of the original without overlapping existing siblings.
 */
export function cloneEntitySubtree(
  entityId: string,
  entities: readonly Entity[],
): ClonedSubtreeResult | null {
  const entitiesById = buildEntityMap(entities);
  const root = entitiesById.get(entityId);
  if (!root) return null;

  const subtreeIds = new Set<string>([entityId]);
  if (isGroupEntity(root)) {
    for (const descId of getDescendantIds(entityId, entities)) {
      subtreeIds.add(descId);
    }
  }

  // Preserve original ordering from the flat entities list
  const sourceSubtree = entities.filter((e) => subtreeIds.has(e.id));

  // Build oldId -> newId map
  const idMap = new Map<string, string>();
  for (const item of sourceSubtree) {
    idMap.set(item.id, generateId(isGroupEntity(item) ? 'grp' : 'ent'));
  }

  // Compute side offset along +X in parent's coordinate space
  const parentSpaceAABB = getEntitySubtreeAABBInParentSpace(
    entityId,
    entities,
    entitiesById,
  );
  const spanX = parentSpaceAABB
    ? Math.max(0, parentSpaceAABB.max[0] - parentSpaceAABB.min[0])
    : 0;
  const stepX =
    spanX > 0
      ? roundClean(spanX + DUPLICATE_GAP_METERS, 6)
      : EMPTY_GROUP_DUPLICATE_STEP_METERS;

  let offsetX = stepX;
  const sourceWorldAABB = getEntityWorldAABB(entityId, entities, {
    includeHidden: true,
    showAccessories: true,
  });

  if (sourceWorldAABB) {
    // Collect existing primitive world AABBs to avoid stacking repeated copies
    const existingAABBs: AABB[] = [];
    for (const entity of entities) {
      if (!isPrimitiveEntity(entity)) continue;
      const worldMatrix = getWorldMatrix(entity.id, entitiesById);
      existingAABBs.push(transformAABB(getLocalBounds(entity), worldMatrix));
    }

    // Compute world-space direction of parent's local +X axis
    const parentWorldMat = root.parentId
      ? getWorldMatrix(root.parentId, entitiesById)
      : IDENTITY_MAT4;
    const worldAxisX: Vec3 = [
      parentWorldMat[0],
      parentWorldMat[4],
      parentWorldMat[8],
    ];

    for (let attempt = 1; attempt <= 20; attempt++) {
      const candidateOffset = roundClean(stepX * attempt, 6);
      const dx = worldAxisX[0] * candidateOffset;
      const dy = worldAxisX[1] * candidateOffset;
      const dz = worldAxisX[2] * candidateOffset;
      const candidateAABB: AABB = {
        min: [
          sourceWorldAABB.min[0] + dx,
          sourceWorldAABB.min[1] + dy,
          sourceWorldAABB.min[2] + dz,
        ],
        max: [
          sourceWorldAABB.max[0] + dx,
          sourceWorldAABB.max[1] + dy,
          sourceWorldAABB.max[2] + dz,
        ],
      };

      const collides = existingAABBs.some((other) =>
        aabbsOverlap3D(candidateAABB, other),
      );
      if (!collides) {
        offsetX = candidateOffset;
        break;
      }
      offsetX = candidateOffset;
    }
  }

  const rootCopyName = generateCopyName(root.name, entities);
  const clonedEntities: Entity[] = sourceSubtree.map((item) => {
    const newId = idMap.get(item.id)!;
    const isRoot = item.id === entityId;
    const newParentId = isRoot
      ? item.parentId
      : item.parentId
        ? (idMap.get(item.parentId) ?? item.parentId)
        : null;

    const position: Vec3 = isRoot
      ? [
          roundClean(item.transform.position[0] + offsetX, 6),
          item.transform.position[1],
          item.transform.position[2],
        ]
      : [...item.transform.position];

    const transform: Transform = {
      position,
      rotation: [...item.transform.rotation],
    };

    const base = {
      id: newId,
      name: isRoot ? rootCopyName : item.name,
      parentId: newParentId,
      layer: item.layer,
      visible: isRoot ? true : item.visible,
      locked: isRoot ? false : item.locked,
      transform,
    };

    if (isGroupEntity(item)) {
      return {
        ...base,
        type: 'group',
      };
    }

    return {
      ...base,
      type: item.type,
      materialId: item.materialId,
      geometry: { ...item.geometry },
    } as PrimitiveEntity;
  });

  return {
    rootId: idMap.get(entityId)!,
    clonedEntities,
  };
}
