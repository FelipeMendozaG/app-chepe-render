import { describe, expect, it } from 'vitest';
import { createEmptyProjectDocument } from '../domain';
import { parseAndValidateAiPlan } from './planValidator';

describe('parseAndValidateAiPlan', () => {
  it('valida un plan compuesto con grupo temporal (tempId) y piezas hijas', () => {
    const doc = createEmptyProjectDocument({ displayUnit: 'cm' });
    const raw = JSON.stringify({
      summary: 'Crear mesa de 140 × 70 × 75 cm con grupo Base',
      steps: ['Crear grupo Base', 'Agregar cubierta y 1 pata de ejemplo'],
      commands: [
        {
          op: 'addGroup',
          tempId: 'tmp_base',
          name: 'Base',
        },
        {
          op: 'addPrimitive',
          tempId: 'tmp_pata_1',
          type: 'box',
          name: 'Pata 1',
          geometry: { width: 0.05, height: 0.72, depth: 0.05 },
          position: [-0.65, 0, -0.3],
          parentId: 'tmp_base',
          materialId: doc.materials[0].id,
        },
        {
          op: 'addPrimitive',
          type: 'box',
          name: 'Cubierta',
          geometry: { width: 1.4, height: 0.03, depth: 0.7 },
          position: [0, 0.72, 0],
          materialId: doc.materials[0].id,
        },
      ],
    });

    const result = parseAndValidateAiPlan(raw, doc);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plan.commands).toHaveLength(3);
    }
  });

  it('rechaza de inmediato JSON malformado, medidas <= 0 y referencias inexistentes', () => {
    const doc = createEmptyProjectDocument();

    expect(parseAndValidateAiPlan('{bad json', doc).ok).toBe(false);

    const invalidDims = JSON.stringify({
      summary: 'Caja inválida',
      steps: ['Crear caja con altura 0'],
      commands: [
        {
          op: 'addPrimitive',
          type: 'box',
          name: 'Caja rota',
          geometry: { width: 1, height: 0, depth: 0.5 },
        },
      ],
    });
    const dimsRes = parseAndValidateAiPlan(invalidDims, doc);
    expect(dimsRes.ok).toBe(false);

    const missingParent = JSON.stringify({
      summary: 'Padre inexistente',
      steps: ['Crear caja'],
      commands: [
        {
          op: 'addPrimitive',
          type: 'box',
          name: 'Caja huérfana',
          geometry: { width: 1, height: 0.5, depth: 0.5 },
          parentId: 'grp-no-existe',
        },
      ],
    });
    expect(parseAndValidateAiPlan(missingParent, doc).ok).toBe(false);
  });

  it('rechaza modificaciones sobre entidades bloqueadas y ciclos de jerarquía', () => {
    const doc = createEmptyProjectDocument();
    doc.entities.push(
      {
        id: 'grp-a',
        type: 'group',
        name: 'Grupo A',
        parentId: null,
        layer: 'main',
        visible: true,
        locked: false,
        transform: { position: [0, 0, 0], rotation: [0, 0, 0] },
      },
      {
        id: 'grp-b',
        type: 'group',
        name: 'Grupo B',
        parentId: 'grp-a',
        layer: 'main',
        visible: true,
        locked: false,
        transform: { position: [0, 0, 0], rotation: [0, 0, 0] },
      },
      {
        id: 'box-locked',
        type: 'box',
        name: 'Fija',
        parentId: null,
        layer: 'main',
        visible: true,
        locked: true,
        materialId: doc.materials[0].id,
        transform: { position: [0, 0, 0], rotation: [0, 0, 0] },
        geometry: { width: 1, height: 1, depth: 1 },
      },
    );

    const lockedEdit = JSON.stringify({
      summary: 'Editar bloqueada',
      steps: ['Eliminar entidad bloqueada'],
      commands: [{ op: 'deleteEntity', entityId: 'box-locked' }],
    });
    expect(parseAndValidateAiPlan(lockedEdit, doc).ok).toBe(false);

    const cyclePlan = JSON.stringify({
      summary: 'Ciclo',
      steps: ['Mover Grupo A dentro de Grupo B'],
      commands: [
        { op: 'reparentEntity', entityId: 'grp-a', newParentId: 'grp-b' },
      ],
    });
    expect(parseAndValidateAiPlan(cyclePlan, doc).ok).toBe(false);
  });
});
