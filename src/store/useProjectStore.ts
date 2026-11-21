import { create } from 'zustand';
import {
  DEFAULT_MATERIALS,
  DEFAULT_MATERIAL_ID,
  PRIMITIVE_DEFAULT_PREFIX,
  applyScaleToGeometry,
  buildEntityMap,
  canReparent,
  cloneEntitySubtree,
  createEmptyProjectDocument,
  findFreePlacementPosition,
  findFreePlacementPositionForBounds,
  generateCorrelativeName,
  generateId,
  getDefaultGeometryForPrimitive,
  getDescendantIds,
  getDescendantPrimitives,
  getQuickObjectPreset,
  hasBlockingErrors,
  isCompositeQuickObjectPreset,
  isEntityEffectivelyLocked,
  isGroupEntity,
  isPrimitiveEntity,
  validateEntityName,
  validateGeometry,
  validateMaterial,
  type AiChatMessage,
  type AiChatPlanRecord,
  type CameraPreset,
  type DisplayUnit,
  type Entity,
  type EntityLayer,
  type GeometryParams,
  type GroupEntity,
  type MaterialDef,
  type PrimitiveEntity,
  type PrimitiveType,
  type ProjectDocument,
  type ProjectSettings,
  type Transform,
  type TransformToolMode,
  type Vec3,
} from '../domain';
import {
  cloneDocument,
  createEmptyHistory,
  pushHistory,
  redoHistory,
  undoHistory,
  type HistoryState,
} from './history';

export type ToggleableSettingKey =
  | 'showGrid'
  | 'showAxes'
  | 'showDimensions'
  | 'showSummaryCard'
  | 'showAccessories';

export interface AddPrimitiveInput {
  type: PrimitiveType;
  name?: string;
  geometry?: GeometryParams;
  position?: Vec3;
  rotation?: Vec3;
  parentId?: string | null;
  layer?: EntityLayer;
  materialId?: string;
}

export interface AddGroupOptions {
  name?: string;
  parentId?: string | null;
  layer?: EntityLayer;
  wrapEntityId?: string | null;
}

export interface UpdateMutationOptions {
  recordHistory?: boolean;
}

export interface MaterialAppearancePatch {
  color?: string;
  roughness?: number;
  metalness?: number;
  name?: string;
}

export interface ProjectStoreState {
  document: ProjectDocument;
  history: HistoryState<ProjectDocument>;
  transactionSnapshot: ProjectDocument | null;
  selectedId: string | null;
  toolMode: TransformToolMode;
  cameraPresetRequest: { preset: CameraPreset; seq: number };
  isDirty: boolean;

  // History & transactions
  undo: () => void;
  redo: () => void;
  beginTransaction: () => void;
  commitTransaction: () => void;
  cancelTransaction: () => void;

  // Selection & viewport controls
  selectEntity: (id: string | null) => void;
  setToolMode: (mode: TransformToolMode) => void;
  requestCameraPreset: (preset: CameraPreset) => void;

  // Project metadata, settings & lifecycle
  setDisplayUnit: (unit: DisplayUnit) => void;
  updateProjectMeta: (patch: { name?: string; description?: string }) => boolean;
  toggleSetting: (key: ToggleableSettingKey) => void;
  setSetting: <K extends keyof ProjectSettings>(
    key: K,
    value: ProjectSettings[K],
  ) => void;
  newEmptyProject: (options?: {
    name?: string;
    description?: string;
    displayUnit?: DisplayUnit;
  }) => void;
  loadProjectDocument: (doc: ProjectDocument, options?: { markDirty?: boolean }) => void;
  markSaved: () => void;

  // Entities & hierarchy
  addPrimitive: (input: AddPrimitiveInput) => string | null;
  addQuickObject: (
    presetId: string,
    options?: { position?: Vec3; parentId?: string | null; layer?: EntityLayer },
  ) => string | null;
  addGroup: (options?: AddGroupOptions) => string;
  renameEntity: (id: string, name: string) => boolean;
  updateEntityTransform: (
    id: string,
    patch: Partial<Transform>,
    options?: UpdateMutationOptions,
  ) => boolean;
  updatePrimitiveGeometry: (
    id: string,
    geometryPatch: Record<string, number | undefined>,
    options?: UpdateMutationOptions,
  ) => boolean;
  scalePrimitive: (
    id: string,
    scale: Vec3,
    options?: UpdateMutationOptions,
  ) => boolean;
  toggleEntityVisible: (id: string) => void;
  toggleEntityLocked: (id: string) => void;
  setEntityLayer: (id: string, layer: EntityLayer) => void;
  reparentEntity: (id: string, newParentId: string | null) => boolean;
  ungroupEntity: (groupId: string) => boolean;
  duplicateEntity: (id: string) => string | null;
  deleteEntity: (id: string) => boolean;

  // Materials
  assignMaterialToEntity: (entityId: string, materialId: string) => boolean;
  updateEntityMaterialAppearance: (
    entityId: string,
    patch: MaterialAppearancePatch,
    options?: UpdateMutationOptions,
  ) => boolean;

  // AI chat history (persisted in ProjectDocument without touching 3D Undo stack)
  appendAiChatMessage: (message: AiChatMessage) => void;
  updateAiChatPlanStatus: (
    messageId: string,
    patch: Partial<AiChatPlanRecord>,
  ) => void;
  clearAiChatHistory: () => void;
}

const DEFAULT_PRESET_MATERIAL_IDS = new Set(
  DEFAULT_MATERIALS.map((material) => material.id),
);

function touchDocument(doc: ProjectDocument): ProjectDocument {
  return {
    ...doc,
    project: {
      ...doc.project,
      updatedAt: new Date().toISOString(),
    },
  };
}

function resolveMaterialId(doc: ProjectDocument, preferred?: string): string {
  if (preferred && doc.materials.some((m) => m.id === preferred)) {
    return preferred;
  }
  if (doc.materials.some((m) => m.id === DEFAULT_MATERIAL_ID)) {
    return DEFAULT_MATERIAL_ID;
  }
  return doc.materials[0]?.id ?? DEFAULT_MATERIAL_ID;
}

function buildPrimitiveEntity(
  id: string,
  name: string,
  parentId: string | null,
  layer: EntityLayer,
  materialId: string,
  position: Vec3,
  rotation: Vec3,
  type: PrimitiveType,
  geometry: GeometryParams,
): PrimitiveEntity {
  const base = {
    id,
    name,
    parentId,
    layer,
    visible: true,
    locked: false,
    materialId,
    transform: {
      position: [...position] as Vec3,
      rotation: [...rotation] as Vec3,
    },
  };

  switch (type) {
    case 'box': {
      const g = geometry as { width: number; height: number; depth: number };
      return {
        ...base,
        type: 'box',
        geometry: { width: g.width, height: g.height, depth: g.depth },
      };
    }
    case 'cylinder': {
      const g = geometry as {
        radius: number;
        height: number;
        radialSegments?: number;
      };
      return {
        ...base,
        type: 'cylinder',
        geometry: {
          radius: g.radius,
          height: g.height,
          ...(g.radialSegments !== undefined
            ? { radialSegments: g.radialSegments }
            : {}),
        },
      };
    }
    case 'sphere': {
      const g = geometry as {
        radius: number;
        widthSegments?: number;
        heightSegments?: number;
      };
      return {
        ...base,
        type: 'sphere',
        geometry: {
          radius: g.radius,
          ...(g.widthSegments !== undefined
            ? { widthSegments: g.widthSegments }
            : {}),
          ...(g.heightSegments !== undefined
            ? { heightSegments: g.heightSegments }
            : {}),
        },
      };
    }
    case 'plane': {
      const g = geometry as { width: number; depth: number };
      return {
        ...base,
        type: 'plane',
        geometry: { width: g.width, depth: g.depth },
      };
    }
  }
}

export const useProjectStore = create<ProjectStoreState>((set, get) => {
  const applyDocumentChange = (
    mutator: (doc: ProjectDocument) => ProjectDocument,
    options?: {
      recordHistory?: boolean;
      selectedId?: string | null;
      keepSelectionIfValid?: boolean;
    },
  ) => {
    const state = get();
    const recordHistory =
      options?.recordHistory ?? state.transactionSnapshot === null;
    const prevSnapshot = recordHistory ? cloneDocument(state.document) : null;
    const nextDoc = touchDocument(mutator(state.document));

    let nextSelectedId =
      options?.selectedId !== undefined ? options.selectedId : state.selectedId;
    if (
      options?.keepSelectionIfValid &&
      nextSelectedId !== null &&
      !nextDoc.entities.some((e) => e.id === nextSelectedId)
    ) {
      nextSelectedId = null;
    }

    let nextToolMode = state.toolMode;
    if (nextSelectedId !== null && nextToolMode === 'scale') {
      const selected = nextDoc.entities.find((e) => e.id === nextSelectedId);
      if (selected && isGroupEntity(selected)) {
        nextToolMode = 'translate';
      }
    }

    set({
      document: nextDoc,
      history: prevSnapshot
        ? pushHistory(state.history, prevSnapshot)
        : state.history,
      selectedId: nextSelectedId,
      toolMode: nextToolMode,
      isDirty: true,
    });
  };

  return {
    document: createEmptyProjectDocument(),
    history: createEmptyHistory<ProjectDocument>(),
    transactionSnapshot: null,
    selectedId: null,
    toolMode: 'translate',
    cameraPresetRequest: { preset: 'initial', seq: 0 },
    isDirty: false,

    undo: () => {
      const state = get();
      const result = undoHistory(state.history, cloneDocument(state.document));
      if (!result) return;

      const nextDoc = cloneDocument(result.nextCurrent);
      const validSelection =
        state.selectedId &&
        nextDoc.entities.some((e) => e.id === state.selectedId)
          ? state.selectedId
          : null;

      set({
        document: nextDoc,
        history: result.nextHistory,
        transactionSnapshot: null,
        selectedId: validSelection,
        isDirty: true,
      });
    },

    redo: () => {
      const state = get();
      const result = redoHistory(state.history, cloneDocument(state.document));
      if (!result) return;

      const nextDoc = cloneDocument(result.nextCurrent);
      const validSelection =
        state.selectedId &&
        nextDoc.entities.some((e) => e.id === state.selectedId)
          ? state.selectedId
          : null;

      set({
        document: nextDoc,
        history: result.nextHistory,
        transactionSnapshot: null,
        selectedId: validSelection,
        isDirty: true,
      });
    },

    beginTransaction: () => {
      const state = get();
      if (state.transactionSnapshot !== null) return;
      set({ transactionSnapshot: cloneDocument(state.document) });
    },

    commitTransaction: () => {
      const state = get();
      if (state.transactionSnapshot === null) return;

      const snapshot = state.transactionSnapshot;
      const changed =
        JSON.stringify(snapshot.entities) !==
          JSON.stringify(state.document.entities) ||
        JSON.stringify(snapshot.materials) !==
          JSON.stringify(state.document.materials);

      set({
        transactionSnapshot: null,
        history: changed
          ? pushHistory(state.history, snapshot)
          : state.history,
      });
    },

    cancelTransaction: () => {
      const state = get();
      if (state.transactionSnapshot === null) return;
      set({
        document: cloneDocument(state.transactionSnapshot),
        transactionSnapshot: null,
      });
    },

    selectEntity: (id) => {
      const state = get();
      if (id === null) {
        set({ selectedId: null });
        return;
      }
      const entity = state.document.entities.find((e) => e.id === id);
      if (!entity) return;

      const nextToolMode =
        isGroupEntity(entity) && state.toolMode === 'scale'
          ? 'translate'
          : state.toolMode;

      set({ selectedId: id, toolMode: nextToolMode });
    },

    setToolMode: (mode) => {
      const state = get();
      if (mode === 'scale' && state.selectedId) {
        const selected = state.document.entities.find(
          (e) => e.id === state.selectedId,
        );
        if (selected && isGroupEntity(selected)) {
          return;
        }
      }
      set({ toolMode: mode });
    },

    requestCameraPreset: (preset) => {
      set((state) => ({
        cameraPresetRequest: {
          preset,
          seq: state.cameraPresetRequest.seq + 1,
        },
      }));
    },

    setDisplayUnit: (unit) => {
      const state = get();
      if (state.document.project.displayUnit === unit) return;
      set({
        document: touchDocument({
          ...state.document,
          project: {
            ...state.document.project,
            displayUnit: unit,
          },
        }),
        isDirty: true,
      });
    },

    updateProjectMeta: (patch) => {
      const state = get();
      const nextName =
        patch.name !== undefined
          ? patch.name.trim()
          : state.document.project.name;
      if (!nextName) return false;

      set({
        document: touchDocument({
          ...state.document,
          project: {
            ...state.document.project,
            name: nextName,
            description:
              patch.description !== undefined
                ? patch.description
                : state.document.project.description,
          },
        }),
        isDirty: true,
      });
      return true;
    },

    toggleSetting: (key) => {
      const state = get();
      set({
        document: {
          ...state.document,
          settings: {
            ...state.document.settings,
            [key]: !state.document.settings[key],
          },
        },
      });
    },

    setSetting: (key, value) => {
      const state = get();
      set({
        document: {
          ...state.document,
          settings: {
            ...state.document.settings,
            [key]: value,
          },
        },
      });
    },

    newEmptyProject: (options) => {
      set((state) => ({
        document: createEmptyProjectDocument(options),
        history: createEmptyHistory<ProjectDocument>(),
        transactionSnapshot: null,
        selectedId: null,
        toolMode: 'translate',
        cameraPresetRequest: {
          preset: 'initial',
          seq: state.cameraPresetRequest.seq + 1,
        },
        isDirty: false,
      }));
    },

    loadProjectDocument: (doc, options) => {
      set((state) => ({
        document: cloneDocument(doc),
        history: createEmptyHistory<ProjectDocument>(),
        transactionSnapshot: null,
        selectedId: null,
        toolMode: 'translate',
        cameraPresetRequest: {
          preset: 'initial',
          seq: state.cameraPresetRequest.seq + 1,
        },
        isDirty: options?.markDirty ?? false,
      }));
    },

    markSaved: () => {
      set({ isDirty: false });
    },

    addPrimitive: (input) => {
      const state = get();
      const doc = state.document;
      const geometry =
        input.geometry ?? getDefaultGeometryForPrimitive(input.type);
      const issues = validateGeometry(
        input.type,
        geometry,
        doc.project.displayUnit,
      );
      if (hasBlockingErrors(issues)) {
        return null;
      }

      const trimmedName = input.name?.trim();
      const name =
        trimmedName && trimmedName.length > 0
          ? trimmedName
          : generateCorrelativeName(
              PRIMITIVE_DEFAULT_PREFIX[input.type],
              doc.entities,
            );

      const parentId =
        input.parentId &&
        doc.entities.some(
          (e) => e.id === input.parentId && isGroupEntity(e),
        )
          ? input.parentId
          : null;

      const parentEntity = parentId
        ? doc.entities.find((e) => e.id === parentId)
        : undefined;
      const layer: EntityLayer =
        input.layer ?? parentEntity?.layer ?? 'main';

      const position =
        input.position ??
        findFreePlacementPosition(input.type, geometry, doc.entities);
      const rotation: Vec3 = input.rotation ?? [0, 0, 0];
      const materialId = resolveMaterialId(doc, input.materialId);
      const id = generateId('ent');

      const entity = buildPrimitiveEntity(
        id,
        name,
        parentId,
        layer,
        materialId,
        position,
        rotation,
        input.type,
        geometry,
      );

      applyDocumentChange(
        (current) => ({
          ...current,
          entities: [...current.entities, entity],
        }),
        { selectedId: id },
      );

      return id;
    },

    addQuickObject: (presetId, options) => {
      const preset = getQuickObjectPreset(presetId);
      if (!preset) return null;

      const state = get();
      const doc = state.document;
      const name = generateCorrelativeName(
        preset.defaultNamePrefix,
        doc.entities,
      );

      if (isCompositeQuickObjectPreset(preset)) {
        const parentId =
          options?.parentId &&
          doc.entities.some(
            (e) => e.id === options.parentId && isGroupEntity(e),
          )
            ? options.parentId
            : null;
        const layer: EntityLayer = options?.layer ?? preset.defaultLayer;
        const hw = preset.bounds.width / 2;
        const hd = preset.bounds.depth / 2;
        const position: Vec3 =
          options?.position ??
          findFreePlacementPositionForBounds(
            {
              min: [-hw, 0, -hd],
              max: [hw, preset.bounds.height, hd],
            },
            doc.entities,
          );

        const groupId = generateId('grp');
        const group: GroupEntity = {
          id: groupId,
          type: 'group',
          name,
          parentId,
          layer,
          visible: true,
          locked: false,
          transform: {
            position: [...position] as Vec3,
            rotation: [0, 0, 0],
          },
        };

        const childEntities: PrimitiveEntity[] = preset.parts.map((part) =>
          buildPrimitiveEntity(
            generateId('ent'),
            part.name,
            groupId,
            layer,
            resolveMaterialId(doc, part.materialId),
            part.position,
            part.rotation ?? [0, 0, 0],
            part.type,
            structuredClone(part.geometry),
          ),
        );

        applyDocumentChange(
          (current) => ({
            ...current,
            entities: [...current.entities, group, ...childEntities],
          }),
          { selectedId: groupId },
        );

        return groupId;
      }

      return get().addPrimitive({
        type: preset.type,
        name,
        geometry: structuredClone(preset.geometry),
        materialId: preset.defaultMaterialId,
        position: options?.position,
        parentId: options?.parentId ?? null,
        layer: options?.layer ?? preset.defaultLayer,
      });
    },

    addGroup: (options) => {
      const state = get();
      const doc = state.document;
      const id = generateId('grp');
      const name =
        options?.name?.trim() ||
        generateCorrelativeName('Grupo', doc.entities);

      const wrapEntity = options?.wrapEntityId
        ? doc.entities.find((e) => e.id === options.wrapEntityId)
        : undefined;

      const parentId =
        options?.parentId !== undefined
          ? options.parentId
          : (wrapEntity?.parentId ?? null);

      const validParentId =
        parentId &&
        doc.entities.some((e) => e.id === parentId && isGroupEntity(e))
          ? parentId
          : null;

      const layer: EntityLayer =
        options?.layer ?? wrapEntity?.layer ?? 'main';

      const group: GroupEntity = {
        id,
        type: 'group',
        name,
        parentId: validParentId,
        layer,
        visible: true,
        locked: false,
        transform: {
          position: [0, 0, 0],
          rotation: [0, 0, 0],
        },
      };

      applyDocumentChange(
        (current) => {
          const nextEntities: Entity[] = current.entities.map((entity) =>
            wrapEntity && entity.id === wrapEntity.id
              ? { ...entity, parentId: id }
              : entity,
          );
          return {
            ...current,
            entities: [...nextEntities, group],
          };
        },
        { selectedId: id },
      );

      return id;
    },

    renameEntity: (id, name) => {
      if (validateEntityName(name)) return false;
      const state = get();
      const target = state.document.entities.find((e) => e.id === id);
      if (!target) return false;
      const trimmed = name.trim();
      if (target.name === trimmed) return true;

      applyDocumentChange((current) => ({
        ...current,
        entities: current.entities.map((e) =>
          e.id === id ? { ...e, name: trimmed } : e,
        ),
      }));
      return true;
    },

    updateEntityTransform: (id, patch, options) => {
      const state = get();
      const entitiesById = buildEntityMap(state.document.entities);
      const target = entitiesById.get(id);
      if (!target || isEntityEffectivelyLocked(target, entitiesById)) {
        return false;
      }

      const nextPos = patch.position ?? target.transform.position;
      const nextRot = patch.rotation ?? target.transform.rotation;
      if (
        !nextPos.every(Number.isFinite) ||
        !nextRot.every(Number.isFinite)
      ) {
        return false;
      }

      applyDocumentChange(
        (current) => ({
          ...current,
          entities: current.entities.map((e) =>
            e.id === id
              ? {
                  ...e,
                  transform: {
                    position: [...nextPos] as Vec3,
                    rotation: [...nextRot] as Vec3,
                  },
                }
              : e,
          ),
        }),
        { recordHistory: options?.recordHistory },
      );
      return true;
    },

    updatePrimitiveGeometry: (id, geometryPatch, options) => {
      const state = get();
      const entitiesById = buildEntityMap(state.document.entities);
      const target = entitiesById.get(id);
      if (
        !target ||
        !isPrimitiveEntity(target) ||
        isEntityEffectivelyLocked(target, entitiesById)
      ) {
        return false;
      }

      const mergedGeometry = {
        ...target.geometry,
        ...geometryPatch,
      } as GeometryParams;

      const issues = validateGeometry(
        target.type,
        mergedGeometry,
        state.document.project.displayUnit,
      );
      if (hasBlockingErrors(issues)) {
        return false;
      }

      applyDocumentChange(
        (current) => ({
          ...current,
          entities: current.entities.map((e) =>
            e.id === id && isPrimitiveEntity(e)
              ? ({ ...e, geometry: mergedGeometry } as PrimitiveEntity)
              : e,
          ),
        }),
        { recordHistory: options?.recordHistory },
      );
      return true;
    },

    scalePrimitive: (id, scale, options) => {
      const state = get();
      const entitiesById = buildEntityMap(state.document.entities);
      const target = entitiesById.get(id);
      if (
        !target ||
        !isPrimitiveEntity(target) ||
        isEntityEffectivelyLocked(target, entitiesById)
      ) {
        return false;
      }

      const nextGeometry = applyScaleToGeometry(target, scale);
      applyDocumentChange(
        (current) => ({
          ...current,
          entities: current.entities.map((e) =>
            e.id === id && isPrimitiveEntity(e)
              ? ({ ...e, geometry: nextGeometry } as PrimitiveEntity)
              : e,
          ),
        }),
        { recordHistory: options?.recordHistory },
      );
      return true;
    },

    toggleEntityVisible: (id) => {
      const state = get();
      if (!state.document.entities.some((e) => e.id === id)) return;

      applyDocumentChange((current) => ({
        ...current,
        entities: current.entities.map((e) =>
          e.id === id ? { ...e, visible: !e.visible } : e,
        ),
      }));
    },

    toggleEntityLocked: (id) => {
      const state = get();
      if (!state.document.entities.some((e) => e.id === id)) return;

      applyDocumentChange((current) => ({
        ...current,
        entities: current.entities.map((e) =>
          e.id === id ? { ...e, locked: !e.locked } : e,
        ),
      }));
    },

    setEntityLayer: (id, layer) => {
      const state = get();
      const target = state.document.entities.find((e) => e.id === id);
      if (!target) return;

      const affectedIds = new Set<string>([id]);
      if (isGroupEntity(target)) {
        for (const childId of getDescendantIds(id, state.document.entities)) {
          affectedIds.add(childId);
        }
      }

      applyDocumentChange((current) => ({
        ...current,
        entities: current.entities.map((e) =>
          affectedIds.has(e.id) ? { ...e, layer } : e,
        ),
      }));
    },

    reparentEntity: (id, newParentId) => {
      const state = get();
      if (!canReparent(id, newParentId, state.document.entities)) {
        return false;
      }
      const target = state.document.entities.find((e) => e.id === id);
      if (!target || target.parentId === newParentId) return false;

      applyDocumentChange((current) => ({
        ...current,
        entities: current.entities.map((e) =>
          e.id === id ? { ...e, parentId: newParentId } : e,
        ),
      }));
      return true;
    },

    ungroupEntity: (groupId) => {
      const state = get();
      const group = state.document.entities.find((e) => e.id === groupId);
      if (!group || !isGroupEntity(group)) return false;

      applyDocumentChange(
        (current) => ({
          ...current,
          entities: current.entities
            .filter((e) => e.id !== groupId)
            .map((e) =>
              e.parentId === groupId ? { ...e, parentId: group.parentId } : e,
            ),
        }),
        { keepSelectionIfValid: true },
      );
      return true;
    },

    duplicateEntity: (id) => {
      const state = get();
      const cloned = cloneEntitySubtree(id, state.document.entities);
      if (!cloned) return null;

      applyDocumentChange(
        (current) => ({
          ...current,
          entities: [...current.entities, ...cloned.clonedEntities],
        }),
        { selectedId: cloned.rootId },
      );
      return cloned.rootId;
    },

    deleteEntity: (id) => {
      const state = get();
      const target = state.document.entities.find((e) => e.id === id);
      if (!target) return false;

      const toDelete = new Set<string>([id]);
      if (isGroupEntity(target)) {
        for (const descId of getDescendantIds(id, state.document.entities)) {
          toDelete.add(descId);
        }
      }

      applyDocumentChange(
        (current) => ({
          ...current,
          entities: current.entities.filter((e) => !toDelete.has(e.id)),
        }),
        { keepSelectionIfValid: true },
      );
      return true;
    },

    assignMaterialToEntity: (entityId, materialId) => {
      const state = get();
      const doc = state.document;
      if (!doc.materials.some((m) => m.id === materialId)) return false;

      const entitiesById = buildEntityMap(doc.entities);
      const target = entitiesById.get(entityId);
      if (!target || isEntityEffectivelyLocked(target, entitiesById)) {
        return false;
      }

      const affectedPrimitiveIds = new Set<string>();
      if (isPrimitiveEntity(target)) {
        affectedPrimitiveIds.add(target.id);
      } else {
        const descendants = getDescendantPrimitives(target.id, doc.entities);
        for (const child of descendants) {
          if (!isEntityEffectivelyLocked(child, entitiesById)) {
            affectedPrimitiveIds.add(child.id);
          }
        }
      }

      if (affectedPrimitiveIds.size === 0) return false;

      applyDocumentChange((current) => ({
        ...current,
        entities: current.entities.map((e) =>
          affectedPrimitiveIds.has(e.id) && isPrimitiveEntity(e)
            ? { ...e, materialId }
            : e,
        ),
      }));
      return true;
    },

    updateEntityMaterialAppearance: (entityId, patch, options) => {
      const validation = validateMaterial(patch);
      if (hasBlockingErrors(validation)) return false;

      const state = get();
      const doc = state.document;
      const entitiesById = buildEntityMap(doc.entities);
      const target = entitiesById.get(entityId);
      if (!target || isEntityEffectivelyLocked(target, entitiesById)) {
        return false;
      }

      const targetPrimitives: PrimitiveEntity[] = isPrimitiveEntity(target)
        ? [target]
        : getDescendantPrimitives(target.id, doc.entities).filter(
            (child) => !isEntityEffectivelyLocked(child, entitiesById),
          );

      if (targetPrimitives.length === 0) return false;

      const targetIdSet = new Set(targetPrimitives.map((p) => p.id));
      const baseMaterialId = targetPrimitives[0].materialId;
      const baseMaterial =
        doc.materials.find((m) => m.id === baseMaterialId) ?? doc.materials[0];
      if (!baseMaterial) return false;

      const allTargetShareSameMaterial = targetPrimitives.every(
        (p) => p.materialId === baseMaterial.id,
      );
      const usedOutsideTarget = doc.entities.some(
        (e) =>
          isPrimitiveEntity(e) &&
          !targetIdSet.has(e.id) &&
          e.materialId === baseMaterial.id,
      );
      const isPreset = DEFAULT_PRESET_MATERIAL_IDS.has(baseMaterial.id);

      const canUpdateInPlace =
        allTargetShareSameMaterial && !usedOutsideTarget && !isPreset;

      applyDocumentChange(
        (current) => {
          if (canUpdateInPlace) {
            return {
              ...current,
              materials: current.materials.map((m) =>
                m.id === baseMaterial.id
                  ? {
                      ...m,
                      color: patch.color ?? m.color,
                      roughness: patch.roughness ?? m.roughness,
                      metalness: patch.metalness ?? m.metalness,
                      name: patch.name ?? m.name,
                    }
                  : m,
              ),
            };
          }

          const customMatId = generateId('mat');
          const customMat: MaterialDef = {
            id: customMatId,
            name: patch.name ?? `Personalizado (${target.name})`,
            color: patch.color ?? baseMaterial.color,
            roughness: patch.roughness ?? baseMaterial.roughness,
            metalness: patch.metalness ?? baseMaterial.metalness,
          };

          return {
            ...current,
            materials: [...current.materials, customMat],
            entities: current.entities.map((e) =>
              targetIdSet.has(e.id) && isPrimitiveEntity(e)
                ? { ...e, materialId: customMatId }
                : e,
            ),
          };
        },
        { recordHistory: options?.recordHistory },
      );

      return true;
    },

    appendAiChatMessage: (message) => {
      applyDocumentChange(
        (current) => ({
          ...current,
          aiChatHistory: [...(current.aiChatHistory ?? []), message],
        }),
        { recordHistory: false },
      );
    },

    updateAiChatPlanStatus: (messageId, patch) => {
      applyDocumentChange(
        (current) => {
          const history = current.aiChatHistory ?? [];
          let changed = false;
          const nextHistory = history.map((msg) => {
            if (msg.id !== messageId || !msg.plan) return msg;
            changed = true;
            return {
              ...msg,
              plan: {
                ...msg.plan,
                ...patch,
              },
            };
          });
          if (!changed) return current;
          return {
            ...current,
            aiChatHistory: nextHistory,
          };
        },
        { recordHistory: false },
      );
    },

    clearAiChatHistory: () => {
      applyDocumentChange(
        (current) => {
          if (!current.aiChatHistory || current.aiChatHistory.length === 0) {
            return current;
          }
          const next = { ...current };
          delete next.aiChatHistory;
          return next;
        },
        { recordHistory: false },
      );
    },
  };
});
