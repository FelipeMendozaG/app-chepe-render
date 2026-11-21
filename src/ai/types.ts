import type {
  AiChatMessage,
  EntityLayer,
  GeometryParams,
  PrimitiveType,
  ProjectDocument,
  Vec3,
} from '../domain';
import type { AiProviderConfig } from '../persistence';

export interface AiAddPrimitiveCommand {
  op: 'addPrimitive';
  tempId?: string;
  type: PrimitiveType;
  name?: string;
  geometry: GeometryParams;
  position?: Vec3;
  rotation?: Vec3;
  parentId?: string | null;
  layer?: EntityLayer;
  materialId?: string;
}

export interface AiAddQuickObjectCommand {
  op: 'addQuickObject';
  tempId?: string;
  presetId: string;
  position?: Vec3;
  parentId?: string | null;
  layer?: EntityLayer;
}

export interface AiAddGroupCommand {
  op: 'addGroup';
  tempId?: string;
  name: string;
  parentId?: string | null;
  layer?: EntityLayer;
  wrapEntityId?: string | null;
}

export interface AiRenameEntityCommand {
  op: 'renameEntity';
  entityId: string;
  name: string;
}

export interface AiUpdateGeometryCommand {
  op: 'updateGeometry';
  entityId: string;
  geometry: Record<string, number>;
}

export interface AiUpdateTransformCommand {
  op: 'updateTransform';
  entityId: string;
  position?: Vec3;
  rotation?: Vec3;
}

export interface AiSetLayerCommand {
  op: 'setLayer';
  entityId: string;
  layer: EntityLayer;
}

export interface AiAssignMaterialCommand {
  op: 'assignMaterial';
  entityId: string;
  materialId: string;
}

export interface AiUpdateMaterialAppearanceCommand {
  op: 'updateMaterialAppearance';
  entityId: string;
  color?: string;
  roughness?: number;
  metalness?: number;
  name?: string;
}

export interface AiReparentEntityCommand {
  op: 'reparentEntity';
  entityId: string;
  newParentId: string | null;
}

export interface AiUngroupEntityCommand {
  op: 'ungroupEntity';
  groupId: string;
}

export interface AiDuplicateEntityCommand {
  op: 'duplicateEntity';
  entityId: string;
  tempId?: string;
}

export interface AiDeleteEntityCommand {
  op: 'deleteEntity';
  entityId: string;
}

export type AiCommand =
  | AiAddPrimitiveCommand
  | AiAddQuickObjectCommand
  | AiAddGroupCommand
  | AiRenameEntityCommand
  | AiUpdateGeometryCommand
  | AiUpdateTransformCommand
  | AiSetLayerCommand
  | AiAssignMaterialCommand
  | AiUpdateMaterialAppearanceCommand
  | AiReparentEntityCommand
  | AiUngroupEntityCommand
  | AiDuplicateEntityCommand
  | AiDeleteEntityCommand;

export interface AiProposedPlan {
  summary: string;
  steps: string[];
  commands: AiCommand[];
}

export interface AiConnectionTestResult {
  ok: boolean;
  message: string;
  latencyMs?: number;
}

export interface AiPlanRequest {
  userPrompt: string;
  document: ProjectDocument;
  selectedId: string | null;
  recentHistory?: readonly AiChatMessage[];
  signal?: AbortSignal;
}

export type AiRawPlanResponse =
  | { ok: true; rawText: string }
  | { ok: false; error: string };

export interface AIProviderAdapter {
  readonly providerId: string;
  testConnection(
    config: AiProviderConfig,
    signal?: AbortSignal,
  ): Promise<AiConnectionTestResult>;
  generatePlan(
    config: AiProviderConfig,
    request: AiPlanRequest,
  ): Promise<AiRawPlanResponse>;
}
