import { useProjectStore } from '../store';
import type { AiProposedPlan } from './types';

export type ExecutePlanResult =
  | { ok: true; appliedCount: number; createdIds: string[] }
  | { ok: false; error: string };

/**
 * Applies a validated AI plan atomically onto the Zustand project store.
 * Wraps the whole batch in beginTransaction / commitTransaction so a single
 * Undo reverts the entire AI turn, and rolls back cleanly on any failure.
 */
export function executeAiPlan(plan: AiProposedPlan): ExecutePlanResult {
  if (plan.commands.length === 0) {
    return { ok: true, appliedCount: 0, createdIds: [] };
  }

  const store = useProjectStore.getState();
  const idMap = new Map<string, string>();
  const createdIds: string[] = [];

  const resolveId = (id: string): string => idMap.get(id) ?? id;
  const resolveOptionalParent = (
    parentId: string | null | undefined,
  ): string | null | undefined => {
    if (parentId === undefined) return undefined;
    if (parentId === null) return null;
    return resolveId(parentId);
  };

  store.beginTransaction();

  try {
    for (let i = 0; i < plan.commands.length; i++) {
      const cmd = plan.commands[i];
      const currentStore = useProjectStore.getState();

      switch (cmd.op) {
        case 'addPrimitive': {
          const createdId = currentStore.addPrimitive({
            type: cmd.type,
            name: cmd.name,
            geometry: cmd.geometry,
            position: cmd.position,
            rotation: cmd.rotation,
            parentId: resolveOptionalParent(cmd.parentId),
            layer: cmd.layer,
            materialId: cmd.materialId,
          });
          if (!createdId) {
            throw new Error(
              `No se pudo crear la primitiva en el paso #${i + 1}.`,
            );
          }
          if (cmd.tempId) idMap.set(cmd.tempId, createdId);
          createdIds.push(createdId);
          break;
        }

        case 'addQuickObject': {
          const createdId = currentStore.addQuickObject(cmd.presetId, {
            position: cmd.position,
            parentId: resolveOptionalParent(cmd.parentId),
            layer: cmd.layer,
          });
          if (!createdId) {
            throw new Error(
              `No se pudo insertar el objeto rápido "${cmd.presetId}" en el paso #${i + 1}.`,
            );
          }
          if (cmd.tempId) idMap.set(cmd.tempId, createdId);
          createdIds.push(createdId);
          break;
        }

        case 'addGroup': {
          const createdId = currentStore.addGroup({
            name: cmd.name,
            parentId: resolveOptionalParent(cmd.parentId),
            layer: cmd.layer,
            wrapEntityId:
              cmd.wrapEntityId !== undefined && cmd.wrapEntityId !== null
                ? resolveId(cmd.wrapEntityId)
                : cmd.wrapEntityId,
          });
          if (cmd.tempId) idMap.set(cmd.tempId, createdId);
          createdIds.push(createdId);
          break;
        }

        case 'renameEntity': {
          const ok = currentStore.renameEntity(resolveId(cmd.entityId), cmd.name);
          if (!ok) {
            throw new Error(
              `No se pudo renombrar la entidad en el paso #${i + 1}.`,
            );
          }
          break;
        }

        case 'updateGeometry': {
          const ok = currentStore.updatePrimitiveGeometry(
            resolveId(cmd.entityId),
            cmd.geometry,
          );
          if (!ok) {
            throw new Error(
              `No se pudieron actualizar las medidas en el paso #${i + 1}.`,
            );
          }
          break;
        }

        case 'updateTransform': {
          const ok = currentStore.updateEntityTransform(resolveId(cmd.entityId), {
            ...(cmd.position ? { position: cmd.position } : {}),
            ...(cmd.rotation ? { rotation: cmd.rotation } : {}),
          });
          if (!ok) {
            throw new Error(
              `No se pudo mover o rotar la entidad en el paso #${i + 1}.`,
            );
          }
          break;
        }

        case 'setLayer': {
          currentStore.setEntityLayer(resolveId(cmd.entityId), cmd.layer);
          break;
        }

        case 'assignMaterial': {
          const ok = currentStore.assignMaterialToEntity(
            resolveId(cmd.entityId),
            cmd.materialId,
          );
          if (!ok) {
            throw new Error(
              `No se pudo asignar el material en el paso #${i + 1}.`,
            );
          }
          break;
        }

        case 'updateMaterialAppearance': {
          const ok = currentStore.updateEntityMaterialAppearance(
            resolveId(cmd.entityId),
            {
              color: cmd.color,
              roughness: cmd.roughness,
              metalness: cmd.metalness,
              name: cmd.name,
            },
          );
          if (!ok) {
            throw new Error(
              `No se pudo personalizar el material en el paso #${i + 1}.`,
            );
          }
          break;
        }

        case 'reparentEntity': {
          const ok = currentStore.reparentEntity(
            resolveId(cmd.entityId),
            cmd.newParentId === null ? null : resolveId(cmd.newParentId),
          );
          if (!ok) {
            throw new Error(
              `No se pudo reagrupar la entidad en el paso #${i + 1}.`,
            );
          }
          break;
        }

        case 'ungroupEntity': {
          const ok = currentStore.ungroupEntity(resolveId(cmd.groupId));
          if (!ok) {
            throw new Error(
              `No se pudo desagrupar en el paso #${i + 1}.`,
            );
          }
          break;
        }

        case 'duplicateEntity': {
          const duplicatedId = currentStore.duplicateEntity(
            resolveId(cmd.entityId),
          );
          if (!duplicatedId) {
            throw new Error(
              `No se pudo duplicar la entidad en el paso #${i + 1}.`,
            );
          }
          if (cmd.tempId) idMap.set(cmd.tempId, duplicatedId);
          createdIds.push(duplicatedId);
          break;
        }

        case 'deleteEntity': {
          const ok = currentStore.deleteEntity(resolveId(cmd.entityId));
          if (!ok) {
            throw new Error(
              `No se pudo eliminar la entidad en el paso #${i + 1}.`,
            );
          }
          break;
        }
      }
    }

    useProjectStore.getState().commitTransaction();
    return {
      ok: true,
      appliedCount: plan.commands.length,
      createdIds,
    };
  } catch (err) {
    useProjectStore.getState().cancelTransaction();
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : 'Ocurrió un error al aplicar el plan. Se revirtieron todos los cambios.',
    };
  }
}
