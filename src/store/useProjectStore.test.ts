import { beforeEach, describe, expect, it } from 'vitest';
import { isPrimitiveEntity, type BoxEntity } from '../domain';
import { canRedo, canUndo } from './history';
import { useProjectStore } from './useProjectStore';

describe('useProjectStore', () => {
  beforeEach(() => {
    useProjectStore.getState().newEmptyProject();
  });

  it('inicia con lienzo vacío, sin proyecto precargado ni función de duplicar', () => {
    const state = useProjectStore.getState();
    expect(state.document.entities).toHaveLength(0);
    expect(state.selectedId).toBeNull();
    expect(state.isDirty).toBe(false);
    expect(state.document.settings.showAccessories).toBe(true);
    expect('duplicateEntity' in state).toBe(false);
  });

  it('inserta objetos rápidos con nombres correlativos apoyados en Y=0 y los selecciona', () => {
    const store = useProjectStore.getState();
    const id1 = store.addQuickObject('quick-board');
    const id2 = store.addQuickObject('quick-board');

    expect(id1).toBeTruthy();
    expect(id2).toBeTruthy();

    const { document, selectedId } = useProjectStore.getState();
    expect(document.entities).toHaveLength(2);
    expect(document.entities[0].name).toBe('Tablero 1');
    expect(document.entities[1].name).toBe('Tablero 2');
    expect(document.entities[0].transform.position[1]).toBe(0);
    expect(document.entities[1].transform.position[1]).toBe(0);
    expect(selectedId).toBe(id2);
  });

  it('soporta Undo / Redo y transacciones continuas de arrastre en un solo paso', () => {
    const id = useProjectStore.getState().addPrimitive({
      type: 'box',
      name: 'Cubierta',
      geometry: { width: 1.2, height: 0.02, depth: 0.6 },
    })!;

    // Simular arrastre continuo del gizmo (3 ticks -> 1 solo paso en Undo)
    useProjectStore.getState().beginTransaction();
    useProjectStore.getState().updateEntityTransform(id, { position: [0.2, 0, 0] });
    useProjectStore.getState().updateEntityTransform(id, { position: [0.5, 0, 0] });
    useProjectStore.getState().updateEntityTransform(id, { position: [1.0, 0, 0] });
    useProjectStore.getState().commitTransaction();

    expect(useProjectStore.getState().document.entities[0].transform.position[0]).toBe(1.0);
    expect(canUndo(useProjectStore.getState().history)).toBe(true);

    // Un solo Undo revierte todo el arrastre de vuelta a [0,0,0]
    useProjectStore.getState().undo();
    expect(useProjectStore.getState().document.entities[0].transform.position[0]).toBe(0);
    expect(canRedo(useProjectStore.getState().history)).toBe(true);

    // Redo vuelve a [1.0, 0, 0]
    useProjectStore.getState().redo();
    expect(useProjectStore.getState().document.entities[0].transform.position[0]).toBe(1.0);

    // Cancelar transacción restaura sin ensuciar el historial
    const pastLen = useProjectStore.getState().history.past.length;
    useProjectStore.getState().beginTransaction();
    useProjectStore.getState().updateEntityTransform(id, { position: [5, 0, 0] });
    useProjectStore.getState().cancelTransaction();
    expect(useProjectStore.getState().document.entities[0].transform.position[0]).toBe(1.0);
    expect(useProjectStore.getState().history.past.length).toBe(pastLen);
  });

  it('propaga material en lote al aplicarlo sobre un grupo y aísla personalizaciones', () => {
    const groupId = useProjectStore.getState().addGroup({ name: 'Escritorio' });
    const p1 = useProjectStore.getState().addPrimitive({
      type: 'box',
      name: 'Cubierta',
      parentId: groupId,
    })!;
    const p2 = useProjectStore.getState().addPrimitive({
      type: 'box',
      name: 'Faldón',
      parentId: groupId,
    })!;
    const outside = useProjectStore.getState().addPrimitive({
      type: 'box',
      name: 'Silla',
    })!;

    // Propagación de material preset al grupo
    expect(
      useProjectStore.getState().assignMaterialToEntity(groupId, 'mat-steel'),
    ).toBe(true);

    let entities = useProjectStore.getState().document.entities;
    const e1 = entities.find((e) => e.id === p1) as BoxEntity;
    const e2 = entities.find((e) => e.id === p2) as BoxEntity;
    const eOut = entities.find((e) => e.id === outside) as BoxEntity;
    expect(e1.materialId).toBe('mat-steel');
    expect(e2.materialId).toBe('mat-steel');
    expect(eOut.materialId).not.toBe('mat-steel');

    // Personalizar color de p1 crea un material propio sin alterar p2
    expect(
      useProjectStore
        .getState()
        .updateEntityMaterialAppearance(p1, { color: '#112233' }),
    ).toBe(true);

    entities = useProjectStore.getState().document.entities;
    const e1After = entities.find((e) => e.id === p1) as BoxEntity;
    const e2After = entities.find((e) => e.id === p2) as BoxEntity;
    expect(e1After.materialId).not.toBe('mat-steel');
    expect(e2After.materialId).toBe('mat-steel');
    const customMat = useProjectStore
      .getState()
      .document.materials.find((m) => m.id === e1After.materialId);
    expect(customMat?.color).toBe('#112233');
  });

  it('protege piezas bloqueadas (locked), deshabilita Escalar en grupos y permite eliminar con Undo', () => {
    const groupId = useProjectStore.getState().addGroup({ name: 'Conjunto' });
    const boxId = useProjectStore.getState().addPrimitive({
      type: 'box',
      name: 'Pieza 1',
      parentId: groupId,
      geometry: { width: 1, height: 0.5, depth: 0.5 },
    })!;

    // Modo Escalar permitido en primitiva, pero se revierte a Mover al seleccionar grupo
    useProjectStore.getState().selectEntity(boxId);
    useProjectStore.getState().setToolMode('scale');
    expect(useProjectStore.getState().toolMode).toBe('scale');

    useProjectStore.getState().selectEntity(groupId);
    expect(useProjectStore.getState().toolMode).toBe('translate');
    useProjectStore.getState().setToolMode('scale');
    expect(useProjectStore.getState().toolMode).toBe('translate');

    // Bloquear grupo impide modificar transformación o geometría de sus hijos
    useProjectStore.getState().toggleEntityLocked(groupId);
    expect(
      useProjectStore.getState().updateEntityTransform(boxId, { position: [2, 0, 0] }),
    ).toBe(false);
    expect(
      useProjectStore.getState().scalePrimitive(boxId, [2, 1, 1]),
    ).toBe(false);

    // Desbloquear y escalar actualiza dimensiones reales
    useProjectStore.getState().toggleEntityLocked(groupId);
    expect(useProjectStore.getState().scalePrimitive(boxId, [2, 1, 1])).toBe(true);
    const updatedBox = useProjectStore
      .getState()
      .document.entities.find((e) => e.id === boxId)!;
    expect(isPrimitiveEntity(updatedBox) && updatedBox.type === 'box' && updatedBox.geometry.width).toBe(2);

    // Eliminar grupo elimina hijos y se revierte completo con Undo
    expect(useProjectStore.getState().deleteEntity(groupId)).toBe(true);
    expect(useProjectStore.getState().document.entities).toHaveLength(0);

    useProjectStore.getState().undo();
    expect(useProjectStore.getState().document.entities).toHaveLength(2);
  });

  it('propaga capa accessories al cambiar la capa de un grupo y permite desagrupar', () => {
    const groupId = useProjectStore.getState().addGroup({ name: 'Accesorios' });
    const itemId = useProjectStore.getState().addPrimitive({
      type: 'cylinder',
      name: 'Taza',
      parentId: groupId,
    })!;

    useProjectStore.getState().setEntityLayer(groupId, 'accessories');
    const entities = useProjectStore.getState().document.entities;
    expect(entities.every((e) => e.layer === 'accessories')).toBe(true);

    expect(useProjectStore.getState().ungroupEntity(groupId)).toBe(true);
    const afterUngroup = useProjectStore.getState().document.entities;
    expect(afterUngroup).toHaveLength(1);
    expect(afterUngroup[0].id).toBe(itemId);
    expect(afterUngroup[0].parentId).toBeNull();
  });
});
