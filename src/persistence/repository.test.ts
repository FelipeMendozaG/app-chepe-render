import { describe, expect, it } from 'vitest';
import { createEmptyProjectDocument } from '../domain';
import { createMemoryProjectRepository } from './indexedDb';
import { buildProjectFilename } from './jsonFile';

describe('persistence repository y nombres de archivo JSON', () => {
  it('soporta guardar, listar, cargar, renombrar y eliminar proyectos', async () => {
    const repo = createMemoryProjectRepository();

    const doc1 = createEmptyProjectDocument({
      name: 'Escritorio en L',
      displayUnit: 'cm',
    });
    doc1.entities.push({
      id: 'ent-1',
      type: 'box',
      name: 'Cubierta',
      parentId: null,
      layer: 'main',
      visible: true,
      locked: false,
      materialId: doc1.materials[0].id,
      transform: { position: [0, 0, 0], rotation: [0, 0, 0] },
      geometry: { width: 1.8, height: 0.02, depth: 0.6 },
    });

    const doc2 = createEmptyProjectDocument({
      name: 'Estantería',
      displayUnit: 'mm',
    });

    await repo.saveProject(doc1);
    await repo.saveProject(doc2);

    const list = await repo.listProjects();
    expect(list).toHaveLength(2);
    expect(list.find((p) => p.id === doc1.project.id)?.entityCount).toBe(1);
    expect(list.find((p) => p.id === doc2.project.id)?.entityCount).toBe(0);

    // Renombrar
    expect(await repo.renameProject(doc1.project.id, '   ')).toBe(false);
    expect(
      await repo.renameProject(doc1.project.id, 'Escritorio estudio'),
    ).toBe(true);

    const reloaded = await repo.loadProject(doc1.project.id);
    expect(reloaded?.project.name).toBe('Escritorio estudio');
    expect(reloaded?.entities).toHaveLength(1);

    // Eliminar
    await repo.deleteProject(doc2.project.id);
    expect(await repo.loadProject(doc2.project.id)).toBeNull();
    expect(await repo.listProjects()).toHaveLength(1);
  });

  it('genera nombres de archivo .chepita.json limpios y sin acentos', () => {
    expect(buildProjectFilename('Escritorio esquinero en L')).toBe(
      'escritorio-esquinero-en-l.chepita.json',
    );
    expect(buildProjectFilename('Cajón niño #2')).toBe(
      'cajon-nino-2.chepita.json',
    );
    expect(buildProjectFilename('   ')).toBe('proyecto-3d.chepita.json');
  });
});
