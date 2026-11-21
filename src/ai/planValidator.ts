import {
  getQuickObjectPreset,
  hasBlockingErrors,
  isCompositeQuickObjectPreset,
  validateEntityName,
  validateGeometry,
  type EntityLayer,
  type EntityType,
  type GeometryParams,
  type PrimitiveType,
  type ProjectDocument,
  type Vec3,
} from '../domain';
import type { AiCommand, AiProposedPlan } from './types';

export type PlanValidationResult =
  | { ok: true; plan: AiProposedPlan }
  | { ok: false; errors: string[] };

interface SimulatedEntity {
  id: string;
  type: EntityType;
  parentId: string | null;
  locked: boolean;
  geometry?: GeometryParams;
}

const VALID_PRIMITIVE_TYPES = new Set<PrimitiveType>([
  'box',
  'cylinder',
  'sphere',
  'plane',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isVec3(value: unknown): value is Vec3 {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((n) => typeof n === 'number' && Number.isFinite(n))
  );
}

function isEntityLayer(value: unknown): value is EntityLayer {
  return value === 'main' || value === 'accessories';
}

function stripOptionalMarkdownFences(rawText: string): string {
  const trimmed = rawText.trim();
  const match = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return match ? match[1].trim() : trimmed;
}

function parseGeometryForType(
  type: PrimitiveType,
  raw: unknown,
): GeometryParams | null {
  if (!isRecord(raw)) return null;
  switch (type) {
    case 'box': {
      const { width, height, depth } = raw;
      if (
        typeof width !== 'number' ||
        typeof height !== 'number' ||
        typeof depth !== 'number'
      ) {
        return null;
      }
      return { width, height, depth };
    }
    case 'cylinder': {
      const { radius, height, radialSegments } = raw;
      if (typeof radius !== 'number' || typeof height !== 'number') {
        return null;
      }
      return {
        radius,
        height,
        ...(typeof radialSegments === 'number' ? { radialSegments } : {}),
      };
    }
    case 'sphere': {
      const { radius, widthSegments, heightSegments } = raw;
      if (typeof radius !== 'number') return null;
      return {
        radius,
        ...(typeof widthSegments === 'number' ? { widthSegments } : {}),
        ...(typeof heightSegments === 'number' ? { heightSegments } : {}),
      };
    }
    case 'plane': {
      const { width, depth } = raw;
      if (typeof width !== 'number' || typeof depth !== 'number') {
        return null;
      }
      return { width, depth };
    }
  }
}

function wouldCreateCycle(
  entityId: string,
  newParentId: string | null,
  simMap: Map<string, SimulatedEntity>,
): boolean {
  if (newParentId === null) return false;
  if (newParentId === entityId) return true;
  let cursor: string | null = newParentId;
  const visited = new Set<string>([entityId]);
  while (cursor !== null) {
    if (visited.has(cursor)) return true;
    visited.add(cursor);
    cursor = simMap.get(cursor)?.parentId ?? null;
  }
  return false;
}

function isSimulatedLocked(
  entityId: string,
  simMap: Map<string, SimulatedEntity>,
): boolean {
  let cursor: string | null = entityId;
  const visited = new Set<string>();
  while (cursor !== null && !visited.has(cursor)) {
    visited.add(cursor);
    const item = simMap.get(cursor);
    if (!item) break;
    if (item.locked) return true;
    cursor = item.parentId;
  }
  return false;
}

export function parseAndValidateAiPlan(
  rawText: string,
  document: ProjectDocument,
): PlanValidationResult {
  const cleaned = stripOptionalMarkdownFences(rawText);
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return {
      ok: false,
      errors: [
        'La respuesta del modelo no contiene un JSON válido. Reformula tu solicitud e inténtalo de nuevo.',
      ],
    };
  }

  if (!isRecord(parsed)) {
    return {
      ok: false,
      errors: ['La respuesta del modelo no tiene la estructura esperada de un plan.'],
    };
  }

  const summary =
    typeof parsed.summary === 'string' ? parsed.summary.trim() : '';
  if (!summary) {
    return {
      ok: false,
      errors: ['El plan propuesto por el modelo no incluye un resumen legible ("summary").'],
    };
  }

  const rawSteps = parsed.steps;
  if (
    !Array.isArray(rawSteps) ||
    !rawSteps.every((step) => typeof step === 'string' && step.trim().length > 0)
  ) {
    return {
      ok: false,
      errors: ['El plan propuesto no incluye una lista válida de pasos ("steps").'],
    };
  }
  const steps = rawSteps.map((s) => s.trim());

  if (!Array.isArray(parsed.commands)) {
    return {
      ok: false,
      errors: ['El plan propuesto no incluye una lista válida de comandos ("commands").'],
    };
  }

  const errors: string[] = [];
  const validatedCommands: AiCommand[] = [];
  const materialIds = new Set(document.materials.map((m) => m.id));
  const simMap = new Map<string, SimulatedEntity>();

  for (const entity of document.entities) {
    simMap.set(entity.id, {
      id: entity.id,
      type: entity.type,
      parentId: entity.parentId,
      locked: entity.locked,
      ...(entity.type !== 'group' ? { geometry: { ...entity.geometry } } : {}),
    });
  }

  const registerTempId = (
    tempId: unknown,
    type: EntityType,
    parentId: string | null,
    cmdIndex: number,
    geometry?: GeometryParams,
  ): string | undefined => {
    if (tempId === undefined) return undefined;
    if (typeof tempId !== 'string' || !tempId.trim()) {
      errors.push(`Comando #${cmdIndex + 1}: "tempId" debe ser un texto no vacío.`);
      return undefined;
    }
    const cleanId = tempId.trim();
    if (simMap.has(cleanId)) {
      errors.push(
        `Comando #${cmdIndex + 1}: el identificador temporal "${cleanId}" ya existe.`,
      );
      return undefined;
    }
    simMap.set(cleanId, {
      id: cleanId,
      type,
      parentId,
      locked: false,
      ...(geometry ? { geometry } : {}),
    });
    return cleanId;
  };

  const validateParentRef = (
    parentId: unknown,
    cmdIndex: number,
  ): string | null | undefined => {
    if (parentId === undefined || parentId === null) return null;
    if (typeof parentId !== 'string' || !parentId.trim()) {
      errors.push(`Comando #${cmdIndex + 1}: "parentId" es inválido.`);
      return undefined;
    }
    const target = simMap.get(parentId);
    if (!target || target.type !== 'group') {
      errors.push(
        `Comando #${cmdIndex + 1}: el grupo padre "${parentId}" no existe.`,
      );
      return undefined;
    }
    return parentId;
  };

  for (let i = 0; i < parsed.commands.length; i++) {
    const rawCmd = parsed.commands[i];
    if (!isRecord(rawCmd) || typeof rawCmd.op !== 'string') {
      errors.push(`Comando #${i + 1}: formato de comando inválido.`);
      continue;
    }

    switch (rawCmd.op) {
      case 'addPrimitive': {
        const type = rawCmd.type;
        if (
          typeof type !== 'string' ||
          !VALID_PRIMITIVE_TYPES.has(type as PrimitiveType)
        ) {
          errors.push(`Comando #${i + 1}: tipo de primitiva inválido ("${String(type)}").`);
          continue;
        }
        const primType = type as PrimitiveType;
        const geometry = parseGeometryForType(primType, rawCmd.geometry);
        if (!geometry) {
          errors.push(`Comando #${i + 1}: geometría incompleta o inválida para "${primType}".`);
          continue;
        }
        const geoIssues = validateGeometry(
          primType,
          geometry,
          document.project.displayUnit,
        );
        if (hasBlockingErrors(geoIssues)) {
          errors.push(
            `Comando #${i + 1}: ${geoIssues.map((issue) => issue.message).join(' ')}`,
          );
          continue;
        }
        if (rawCmd.name !== undefined) {
          if (typeof rawCmd.name !== 'string') {
            errors.push(`Comando #${i + 1}: el nombre debe ser texto.`);
            continue;
          }
          const nameIssue = validateEntityName(rawCmd.name);
          if (nameIssue) {
            errors.push(`Comando #${i + 1}: ${nameIssue.message}`);
            continue;
          }
        }
        if (rawCmd.position !== undefined && !isVec3(rawCmd.position)) {
          errors.push(`Comando #${i + 1}: "position" debe ser un arreglo [x, y, z] numérico.`);
          continue;
        }
        if (rawCmd.rotation !== undefined && !isVec3(rawCmd.rotation)) {
          errors.push(`Comando #${i + 1}: "rotation" debe ser un arreglo [rx, ry, rz] numérico.`);
          continue;
        }
        if (rawCmd.layer !== undefined && !isEntityLayer(rawCmd.layer)) {
          errors.push(`Comando #${i + 1}: "layer" debe ser "main" o "accessories".`);
          continue;
        }
        if (
          rawCmd.materialId !== undefined &&
          (typeof rawCmd.materialId !== 'string' || !materialIds.has(rawCmd.materialId))
        ) {
          errors.push(
            `Comando #${i + 1}: el material "${String(rawCmd.materialId)}" no existe en el proyecto.`,
          );
          continue;
        }
        const parentId = validateParentRef(rawCmd.parentId, i);
        if (parentId === undefined) continue;

        const tempId = registerTempId(rawCmd.tempId, primType, parentId, i, geometry);
        validatedCommands.push({
          op: 'addPrimitive',
          ...(tempId ? { tempId } : {}),
          type: primType,
          ...(typeof rawCmd.name === 'string' ? { name: rawCmd.name.trim() } : {}),
          geometry,
          ...(rawCmd.position ? { position: rawCmd.position } : {}),
          ...(rawCmd.rotation ? { rotation: rawCmd.rotation } : {}),
          ...(rawCmd.parentId !== undefined ? { parentId } : {}),
          ...(rawCmd.layer ? { layer: rawCmd.layer } : {}),
          ...(typeof rawCmd.materialId === 'string'
            ? { materialId: rawCmd.materialId }
            : {}),
        });
        break;
      }

      case 'addQuickObject': {
        if (typeof rawCmd.presetId !== 'string') {
          errors.push(`Comando #${i + 1}: falta "presetId" válido.`);
          continue;
        }
        const preset = getQuickObjectPreset(rawCmd.presetId);
        if (!preset) {
          errors.push(
            `Comando #${i + 1}: el objeto rápido "${rawCmd.presetId}" no existe.`,
          );
          continue;
        }
        if (rawCmd.position !== undefined && !isVec3(rawCmd.position)) {
          errors.push(`Comando #${i + 1}: "position" inválido.`);
          continue;
        }
        if (rawCmd.layer !== undefined && !isEntityLayer(rawCmd.layer)) {
          errors.push(`Comando #${i + 1}: "layer" inválido.`);
          continue;
        }
        const parentId = validateParentRef(rawCmd.parentId, i);
        if (parentId === undefined) continue;

        const presetType: EntityType = isCompositeQuickObjectPreset(preset)
          ? 'group'
          : preset.type;
        const tempId = registerTempId(rawCmd.tempId, presetType, parentId, i);
        validatedCommands.push({
          op: 'addQuickObject',
          ...(tempId ? { tempId } : {}),
          presetId: preset.id,
          ...(rawCmd.position ? { position: rawCmd.position } : {}),
          ...(rawCmd.parentId !== undefined ? { parentId } : {}),
          ...(rawCmd.layer ? { layer: rawCmd.layer } : {}),
        });
        break;
      }

      case 'addGroup': {
        if (typeof rawCmd.name !== 'string') {
          errors.push(`Comando #${i + 1}: falta un nombre válido para el grupo.`);
          continue;
        }
        const nameIssue = validateEntityName(rawCmd.name);
        if (nameIssue) {
          errors.push(`Comando #${i + 1}: ${nameIssue.message}`);
          continue;
        }
        if (rawCmd.layer !== undefined && !isEntityLayer(rawCmd.layer)) {
          errors.push(`Comando #${i + 1}: "layer" inválido.`);
          continue;
        }
        const parentId = validateParentRef(rawCmd.parentId, i);
        if (parentId === undefined) continue;

        let wrapEntityId: string | null | undefined = undefined;
        if (rawCmd.wrapEntityId !== undefined && rawCmd.wrapEntityId !== null) {
          if (
            typeof rawCmd.wrapEntityId !== 'string' ||
            !simMap.has(rawCmd.wrapEntityId)
          ) {
            errors.push(
              `Comando #${i + 1}: la entidad a agrupar "${String(rawCmd.wrapEntityId)}" no existe.`,
            );
            continue;
          }
          wrapEntityId = rawCmd.wrapEntityId;
        }

        const tempId = registerTempId(rawCmd.tempId, 'group', parentId, i);
        validatedCommands.push({
          op: 'addGroup',
          ...(tempId ? { tempId } : {}),
          name: rawCmd.name.trim(),
          ...(rawCmd.parentId !== undefined ? { parentId } : {}),
          ...(rawCmd.layer ? { layer: rawCmd.layer } : {}),
          ...(wrapEntityId !== undefined ? { wrapEntityId } : {}),
        });
        break;
      }

      case 'renameEntity': {
        if (typeof rawCmd.entityId !== 'string' || !simMap.has(rawCmd.entityId)) {
          errors.push(
            `Comando #${i + 1}: la entidad "${String(rawCmd.entityId)}" no existe.`,
          );
          continue;
        }
        if (typeof rawCmd.name !== 'string') {
          errors.push(`Comando #${i + 1}: falta el nuevo nombre.`);
          continue;
        }
        const nameIssue = validateEntityName(rawCmd.name);
        if (nameIssue) {
          errors.push(`Comando #${i + 1}: ${nameIssue.message}`);
          continue;
        }
        validatedCommands.push({
          op: 'renameEntity',
          entityId: rawCmd.entityId,
          name: rawCmd.name.trim(),
        });
        break;
      }

      case 'updateGeometry': {
        if (typeof rawCmd.entityId !== 'string') {
          errors.push(`Comando #${i + 1}: falta "entityId".`);
          continue;
        }
        const target = simMap.get(rawCmd.entityId);
        if (!target) {
          errors.push(`Comando #${i + 1}: la entidad "${rawCmd.entityId}" no existe.`);
          continue;
        }
        if (target.type === 'group') {
          errors.push(
            `Comando #${i + 1}: no se puede editar geometría directa de un grupo ("${rawCmd.entityId}").`,
          );
          continue;
        }
        if (isSimulatedLocked(rawCmd.entityId, simMap)) {
          errors.push(`Comando #${i + 1}: la entidad "${rawCmd.entityId}" está bloqueada.`);
          continue;
        }
        if (!isRecord(rawCmd.geometry)) {
          errors.push(`Comando #${i + 1}: falta objeto "geometry".`);
          continue;
        }
        const numericPatch: Record<string, number> = {};
        let patchValid = true;
        for (const [k, v] of Object.entries(rawCmd.geometry)) {
          if (typeof v !== 'number' || !Number.isFinite(v)) {
            patchValid = false;
            errors.push(`Comando #${i + 1}: parámetro geométrico "${k}" inválido.`);
            break;
          }
          numericPatch[k] = v;
        }
        if (!patchValid || Object.keys(numericPatch).length === 0) {
          if (patchValid) {
            errors.push(`Comando #${i + 1}: "geometry" no contiene medidas para actualizar.`);
          }
          continue;
        }
        const mergedGeometry = {
          ...(target.geometry ?? {}),
          ...numericPatch,
        } as GeometryParams;
        const geoIssues = validateGeometry(
          target.type,
          mergedGeometry,
          document.project.displayUnit,
        );
        if (hasBlockingErrors(geoIssues)) {
          errors.push(
            `Comando #${i + 1}: ${geoIssues.map((issue) => issue.message).join(' ')}`,
          );
          continue;
        }
        target.geometry = mergedGeometry;
        validatedCommands.push({
          op: 'updateGeometry',
          entityId: rawCmd.entityId,
          geometry: numericPatch,
        });
        break;
      }

      case 'updateTransform': {
        if (typeof rawCmd.entityId !== 'string' || !simMap.has(rawCmd.entityId)) {
          errors.push(
            `Comando #${i + 1}: la entidad "${String(rawCmd.entityId)}" no existe.`,
          );
          continue;
        }
        if (isSimulatedLocked(rawCmd.entityId, simMap)) {
          errors.push(`Comando #${i + 1}: la entidad "${rawCmd.entityId}" está bloqueada.`);
          continue;
        }
        if (rawCmd.position !== undefined && !isVec3(rawCmd.position)) {
          errors.push(`Comando #${i + 1}: "position" inválido.`);
          continue;
        }
        if (rawCmd.rotation !== undefined && !isVec3(rawCmd.rotation)) {
          errors.push(`Comando #${i + 1}: "rotation" inválido.`);
          continue;
        }
        if (rawCmd.position === undefined && rawCmd.rotation === undefined) {
          errors.push(`Comando #${i + 1}: indica al menos "position" o "rotation".`);
          continue;
        }
        validatedCommands.push({
          op: 'updateTransform',
          entityId: rawCmd.entityId,
          ...(rawCmd.position ? { position: rawCmd.position } : {}),
          ...(rawCmd.rotation ? { rotation: rawCmd.rotation } : {}),
        });
        break;
      }

      case 'setLayer': {
        if (typeof rawCmd.entityId !== 'string' || !simMap.has(rawCmd.entityId)) {
          errors.push(
            `Comando #${i + 1}: la entidad "${String(rawCmd.entityId)}" no existe.`,
          );
          continue;
        }
        if (!isEntityLayer(rawCmd.layer)) {
          errors.push(`Comando #${i + 1}: "layer" debe ser "main" o "accessories".`);
          continue;
        }
        validatedCommands.push({
          op: 'setLayer',
          entityId: rawCmd.entityId,
          layer: rawCmd.layer,
        });
        break;
      }

      case 'assignMaterial': {
        if (typeof rawCmd.entityId !== 'string' || !simMap.has(rawCmd.entityId)) {
          errors.push(
            `Comando #${i + 1}: la entidad "${String(rawCmd.entityId)}" no existe.`,
          );
          continue;
        }
        if (isSimulatedLocked(rawCmd.entityId, simMap)) {
          errors.push(`Comando #${i + 1}: la entidad "${rawCmd.entityId}" está bloqueada.`);
          continue;
        }
        if (
          typeof rawCmd.materialId !== 'string' ||
          !materialIds.has(rawCmd.materialId)
        ) {
          errors.push(
            `Comando #${i + 1}: el material "${String(rawCmd.materialId)}" no existe.`,
          );
          continue;
        }
        validatedCommands.push({
          op: 'assignMaterial',
          entityId: rawCmd.entityId,
          materialId: rawCmd.materialId,
        });
        break;
      }

      case 'updateMaterialAppearance': {
        if (typeof rawCmd.entityId !== 'string' || !simMap.has(rawCmd.entityId)) {
          errors.push(
            `Comando #${i + 1}: la entidad "${String(rawCmd.entityId)}" no existe.`,
          );
          continue;
        }
        if (isSimulatedLocked(rawCmd.entityId, simMap)) {
          errors.push(`Comando #${i + 1}: la entidad "${rawCmd.entityId}" está bloqueada.`);
          continue;
        }
        if (
          rawCmd.color !== undefined &&
          (typeof rawCmd.color !== 'string' ||
            !/^#[0-9a-fA-F]{6}$/.test(rawCmd.color))
        ) {
          errors.push(
            `Comando #${i + 1}: "color" debe ser un código hexadecimal #RRGGBB.`,
          );
          continue;
        }
        if (
          rawCmd.roughness !== undefined &&
          (typeof rawCmd.roughness !== 'number' ||
            !Number.isFinite(rawCmd.roughness) ||
            rawCmd.roughness < 0 ||
            rawCmd.roughness > 1)
        ) {
          errors.push(`Comando #${i + 1}: "roughness" debe estar entre 0 y 1.`);
          continue;
        }
        if (
          rawCmd.metalness !== undefined &&
          (typeof rawCmd.metalness !== 'number' ||
            !Number.isFinite(rawCmd.metalness) ||
            rawCmd.metalness < 0 ||
            rawCmd.metalness > 1)
        ) {
          errors.push(`Comando #${i + 1}: "metalness" debe estar entre 0 y 1.`);
          continue;
        }
        if (
          rawCmd.color === undefined &&
          rawCmd.roughness === undefined &&
          rawCmd.metalness === undefined &&
          rawCmd.name === undefined
        ) {
          errors.push(
            `Comando #${i + 1}: indica al menos color, roughness, metalness o name.`,
          );
          continue;
        }
        validatedCommands.push({
          op: 'updateMaterialAppearance',
          entityId: rawCmd.entityId,
          ...(typeof rawCmd.color === 'string' ? { color: rawCmd.color } : {}),
          ...(typeof rawCmd.roughness === 'number'
            ? { roughness: rawCmd.roughness }
            : {}),
          ...(typeof rawCmd.metalness === 'number'
            ? { metalness: rawCmd.metalness }
            : {}),
          ...(typeof rawCmd.name === 'string' && rawCmd.name.trim()
            ? { name: rawCmd.name.trim() }
            : {}),
        });
        break;
      }

      case 'reparentEntity': {
        if (typeof rawCmd.entityId !== 'string' || !simMap.has(rawCmd.entityId)) {
          errors.push(
            `Comando #${i + 1}: la entidad "${String(rawCmd.entityId)}" no existe.`,
          );
          continue;
        }
        const newParentId = validateParentRef(rawCmd.newParentId, i);
        if (newParentId === undefined) continue;
        if (wouldCreateCycle(rawCmd.entityId, newParentId, simMap)) {
          errors.push(
            `Comando #${i + 1}: mover "${rawCmd.entityId}" dentro de "${String(newParentId)}" crea un ciclo de jerarquía.`,
          );
          continue;
        }
        const target = simMap.get(rawCmd.entityId)!;
        target.parentId = newParentId;
        validatedCommands.push({
          op: 'reparentEntity',
          entityId: rawCmd.entityId,
          newParentId,
        });
        break;
      }

      case 'ungroupEntity': {
        if (typeof rawCmd.groupId !== 'string') {
          errors.push(`Comando #${i + 1}: falta "groupId".`);
          continue;
        }
        const group = simMap.get(rawCmd.groupId);
        if (!group || group.type !== 'group') {
          errors.push(`Comando #${i + 1}: el grupo "${rawCmd.groupId}" no existe.`);
          continue;
        }
        if (isSimulatedLocked(rawCmd.groupId, simMap)) {
          errors.push(`Comando #${i + 1}: el grupo "${rawCmd.groupId}" está bloqueado.`);
          continue;
        }
        for (const child of simMap.values()) {
          if (child.parentId === rawCmd.groupId) {
            child.parentId = group.parentId;
          }
        }
        simMap.delete(rawCmd.groupId);
        validatedCommands.push({
          op: 'ungroupEntity',
          groupId: rawCmd.groupId,
        });
        break;
      }

      case 'duplicateEntity': {
        if (typeof rawCmd.entityId !== 'string') {
          errors.push(`Comando #${i + 1}: falta "entityId".`);
          continue;
        }
        const source = simMap.get(rawCmd.entityId);
        if (!source) {
          errors.push(`Comando #${i + 1}: la entidad "${rawCmd.entityId}" no existe.`);
          continue;
        }
        const tempId = registerTempId(
          rawCmd.tempId,
          source.type,
          source.parentId,
          i,
          source.geometry,
        );
        validatedCommands.push({
          op: 'duplicateEntity',
          entityId: rawCmd.entityId,
          ...(tempId ? { tempId } : {}),
        });
        break;
      }

      case 'deleteEntity': {
        if (typeof rawCmd.entityId !== 'string' || !simMap.has(rawCmd.entityId)) {
          errors.push(
            `Comando #${i + 1}: la entidad "${String(rawCmd.entityId)}" no existe.`,
          );
          continue;
        }
        if (isSimulatedLocked(rawCmd.entityId, simMap)) {
          errors.push(`Comando #${i + 1}: la entidad "${rawCmd.entityId}" está bloqueada.`);
          continue;
        }
        // Remove entity and simulated descendants
        const toDelete = new Set<string>([rawCmd.entityId]);
        let grew = true;
        while (grew) {
          grew = false;
          for (const item of simMap.values()) {
            if (item.parentId && toDelete.has(item.parentId) && !toDelete.has(item.id)) {
              toDelete.add(item.id);
              grew = true;
            }
          }
        }
        for (const id of toDelete) {
          simMap.delete(id);
        }
        validatedCommands.push({
          op: 'deleteEntity',
          entityId: rawCmd.entityId,
        });
        break;
      }

      default:
        errors.push(`Comando #${i + 1}: operación desconocida ("${rawCmd.op}").`);
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    plan: {
      summary,
      steps,
      commands: validatedCommands,
    },
  };
}
