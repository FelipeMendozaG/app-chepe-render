import { describe, expect, it } from 'vitest';
import { createEmptyProjectDocument } from './presets';
import { deserializeProject, serializeProject } from './serializer';

describe('serializer (schemaVersion: 1)', () => {
  it('realiza ida y vuelta fiel de un documento válido con grupos, capas y primitivas', () => {
    const doc = createEmptyProjectDocument({
      name: 'Escritorio en L',
      displayUnit: 'cm',
    });
    doc.entities.push(
      {
        id: 'grp-1',
        type: 'group',
        name: 'Escritorio',
        parentId: null,
        layer: 'main',
        visible: true,
        locked: false,
        transform: { position: [0, 0, 0], rotation: [0, 0, 0] },
      },
      {
        id: 'ent-1',
        type: 'box',
        name: 'Cubierta',
        parentId: 'grp-1',
        layer: 'main',
        visible: true,
        locked: false,
        materialId: doc.materials[0].id,
        transform: { position: [0, 0.732, 0], rotation: [0, 0, 0] },
        geometry: { width: 1.8, height: 0.018, depth: 0.6 },
      },
      {
        id: 'ent-2',
        type: 'cylinder',
        name: 'Maceta',
        parentId: 'grp-1',
        layer: 'accessories',
        visible: true,
        locked: false,
        materialId: doc.materials[1].id,
        transform: { position: [-0.5, 0.75, 0], rotation: [0, 0, 0] },
        geometry: { radius: 0.06, height: 0.12, radialSegments: 24 },
      },
    );

    const json = serializeProject(doc);
    const parsed = deserializeProject(json);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.document).toEqual(doc);
    }
  });

  it('rechaza JSON corrupto, versiones no soportadas, medidas <= 0 y ciclos de parentId', () => {
    expect(deserializeProject('{bad json').ok).toBe(false);

    const wrongVersion = createEmptyProjectDocument();
    const wrongJson = JSON.stringify({ ...wrongVersion, schemaVersion: 99 });
    expect(deserializeProject(wrongJson).ok).toBe(false);

    const badGeom = createEmptyProjectDocument();
    badGeom.entities.push({
      id: 'e1',
      type: 'box',
      name: 'Caja inválida',
      parentId: null,
      layer: 'main',
      visible: true,
      locked: false,
      materialId: badGeom.materials[0].id,
      transform: { position: [0, 0, 0], rotation: [0, 0, 0] },
      geometry: { width: -1, height: 0.5, depth: 0.5 },
    });
    expect(deserializeProject(serializeProject(badGeom)).ok).toBe(false);

    const cyclic = createEmptyProjectDocument();
    cyclic.entities.push(
      {
        id: 'g1',
        type: 'group',
        name: 'G1',
        parentId: 'g2',
        layer: 'main',
        visible: true,
        locked: false,
        transform: { position: [0, 0, 0], rotation: [0, 0, 0] },
      },
      {
        id: 'g2',
        type: 'group',
        name: 'G2',
        parentId: 'g1',
        layer: 'main',
        visible: true,
        locked: false,
        transform: { position: [0, 0, 0], rotation: [0, 0, 0] },
      },
    );
    expect(deserializeProject(serializeProject(cyclic)).ok).toBe(false);
  });

  it('conserva aiChatHistory en ida y vuelta y mantiene retrocompatibilidad cuando falta', () => {
    const legacyDoc = createEmptyProjectDocument({ name: 'Proyecto sin chat' });
    const legacyParsed = deserializeProject(serializeProject(legacyDoc));
    expect(legacyParsed.ok).toBe(true);
    if (legacyParsed.ok) {
      expect(legacyParsed.document.aiChatHistory).toBeUndefined();
    }

    const withChat = createEmptyProjectDocument({ name: 'Proyecto con chat' });
    withChat.aiChatHistory = [
      {
        id: 'msg-1',
        role: 'user',
        text: 'Crea una mesa de 140x70x75 cm',
        createdAt: '2026-11-21T10:00:00.000Z',
      },
      {
        id: 'msg-2',
        role: 'assistant',
        text: 'Crearé una mesa con cubierta y 4 patas.',
        createdAt: '2026-11-21T10:00:03.000Z',
        plan: {
          summary: 'Mesa de roble 140×70×75 cm',
          items: ['Crear grupo Mesa', 'Crear cubierta y 4 patas'],
          status: 'applied',
          appliedAt: '2026-11-21T10:00:10.000Z',
        },
      },
    ];

    const serialized = serializeProject(withChat);
    const parsed = deserializeProject(serialized);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.document.aiChatHistory).toEqual(withChat.aiChatHistory);
    }

    const corruptedChat = JSON.stringify({
      ...withChat,
      aiChatHistory: [{ id: 'bad', role: 'invalid', text: 'x', createdAt: 'now' }],
    });
    expect(deserializeProject(corruptedChat).ok).toBe(false);
  });
});
