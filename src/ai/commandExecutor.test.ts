import { beforeEach, describe, expect, it } from 'vitest';
import { useProjectStore } from '../store';
import { executeAiPlan } from './commandExecutor';
import type { AiProposedPlan } from './types';

describe('executeAiPlan', () => {
  beforeEach(() => {
    useProjectStore.getState().newEmptyProject({
      name: 'Prueba IA',
      displayUnit: 'cm',
    });
  });

  it('ejecuta un plan multi-comando en una única transacción reversible con Deshacer', () => {
    const materialId = useProjectStore.getState().document.materials[0].id;
    const plan: AiProposedPlan = {
      summary: 'Mesa con cubierta y grupo Base',
      steps: ['Crear grupo Base', 'Crear pata', 'Crear cubierta'],
      commands: [
        { op: 'addGroup', tempId: 'tmp_base', name: 'Base' },
        {
          op: 'addPrimitive',
          tempId: 'tmp_pata',
          type: 'box',
          name: 'Pata 1',
          geometry: { width: 0.05, height: 0.72, depth: 0.05 },
          position: [-0.6, 0, -0.3],
          parentId: 'tmp_base',
          materialId,
        },
        {
          op: 'addPrimitive',
          type: 'box',
          name: 'Cubierta',
          geometry: { width: 1.4, height: 0.03, depth: 0.7 },
          position: [0, 0.72, 0],
          materialId,
        },
        {
          op: 'renameEntity',
          entityId: 'tmp_pata',
          name: 'Pata Frontal Izq',
        },
      ],
    };

    const result = executeAiPlan(plan);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.appliedCount).toBe(4);
      expect(result.createdIds).toHaveLength(3);
    }

    const stateAfter = useProjectStore.getState();
    expect(stateAfter.document.entities).toHaveLength(3);
    const group = stateAfter.document.entities.find((e) => e.name === 'Base');
    const leg = stateAfter.document.entities.find(
      (e) => e.name === 'Pata Frontal Izq',
    );
    expect(group?.type).toBe('group');
    expect(leg?.parentId).toBe(group?.id);

    // Single Undo reverts the entire AI plan atomically
    expect(stateAfter.history.past).toHaveLength(1);
    useProjectStore.getState().undo();
    expect(useProjectStore.getState().document.entities).toHaveLength(0);
  });

  it('revierte todos los cambios (rollback) si un comando falla a mitad del lote', () => {
    const plan: AiProposedPlan = {
      summary: 'Lote con fallo en segundo comando',
      steps: ['Crear caja', 'Eliminar ID inexistente'],
      commands: [
        {
          op: 'addPrimitive',
          type: 'box',
          name: 'Temporal',
          geometry: { width: 1, height: 1, depth: 1 },
        },
        {
          op: 'deleteEntity',
          entityId: 'ent-inexistente',
        },
      ],
    };

    const result = executeAiPlan(plan);
    expect(result.ok).toBe(false);

    const stateAfter = useProjectStore.getState();
    expect(stateAfter.document.entities).toHaveLength(0);
    expect(stateAfter.history.past).toHaveLength(0);
  });
});
