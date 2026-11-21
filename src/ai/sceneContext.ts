import {
  QUICK_OBJECT_PRESETS,
  isPrimitiveEntity,
  type Entity,
  type ProjectDocument,
} from '../domain';

export interface CompactEntitySummary {
  id: string;
  name: string;
  type: Entity['type'];
  parentId: string | null;
  layer: Entity['layer'];
  locked: boolean;
  visible: boolean;
  position: [number, number, number];
  rotation: [number, number, number];
  materialId?: string;
  geometry?: Record<string, number | undefined>;
}

export interface SceneContextSummary {
  projectName: string;
  displayUnit: ProjectDocument['project']['displayUnit'];
  selectedId: string | null;
  materials: Array<{
    id: string;
    name: string;
    color: string;
    roughness: number;
    metalness: number;
  }>;
  quickObjectPresets: Array<{
    id: string;
    label: string;
    kind: 'primitive' | 'composite';
  }>;
  entities: CompactEntitySummary[];
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function roundVec3(v: [number, number, number]): [number, number, number] {
  return [round4(v[0]), round4(v[1]), round4(v[2])];
}

export function buildSceneContextSummary(
  document: ProjectDocument,
  selectedId: string | null,
): SceneContextSummary {
  return {
    projectName: document.project.name,
    displayUnit: document.project.displayUnit,
    selectedId,
    materials: document.materials.map((m) => ({
      id: m.id,
      name: m.name,
      color: m.color,
      roughness: round4(m.roughness),
      metalness: round4(m.metalness),
    })),
    quickObjectPresets: QUICK_OBJECT_PRESETS.map((p) => ({
      id: p.id,
      label: p.label,
      kind: p.kind === 'composite' ? 'composite' : 'primitive',
    })),
    entities: document.entities.map((entity) => {
      const base: CompactEntitySummary = {
        id: entity.id,
        name: entity.name,
        type: entity.type,
        parentId: entity.parentId,
        layer: entity.layer,
        locked: entity.locked,
        visible: entity.visible,
        position: roundVec3(entity.transform.position),
        rotation: roundVec3(entity.transform.rotation),
      };
      if (isPrimitiveEntity(entity)) {
        base.materialId = entity.materialId;
        base.geometry = { ...entity.geometry };
      }
      return base;
    }),
  };
}
