export const SCHEMA_VERSION = 1 as const;

export type DisplayUnit = 'mm' | 'cm' | 'm';

export type EntityLayer = 'main' | 'accessories';

export type PrimitiveType = 'box' | 'cylinder' | 'sphere' | 'plane';

export type EntityType = 'group' | PrimitiveType;

export type Vec3 = [number, number, number];

export interface Transform {
  position: Vec3;
  rotation: Vec3;
}

export interface BoxGeometryParams {
  width: number;
  height: number;
  depth: number;
}

export interface CylinderGeometryParams {
  radius: number;
  height: number;
  radialSegments?: number;
}

export interface SphereGeometryParams {
  radius: number;
  widthSegments?: number;
  heightSegments?: number;
}

export interface PlaneGeometryParams {
  width: number;
  depth: number;
}

export type GeometryParams =
  | BoxGeometryParams
  | CylinderGeometryParams
  | SphereGeometryParams
  | PlaneGeometryParams;

export interface MaterialDef {
  id: string;
  name: string;
  color: string;
  roughness: number;
  metalness: number;
}

export interface BaseEntity {
  id: string;
  name: string;
  parentId: string | null;
  layer: EntityLayer;
  visible: boolean;
  locked: boolean;
  transform: Transform;
}

export interface GroupEntity extends BaseEntity {
  type: 'group';
}

export interface BoxEntity extends BaseEntity {
  type: 'box';
  materialId: string;
  geometry: BoxGeometryParams;
}

export interface CylinderEntity extends BaseEntity {
  type: 'cylinder';
  materialId: string;
  geometry: CylinderGeometryParams;
}

export interface SphereEntity extends BaseEntity {
  type: 'sphere';
  materialId: string;
  geometry: SphereGeometryParams;
}

export interface PlaneEntity extends BaseEntity {
  type: 'plane';
  materialId: string;
  geometry: PlaneGeometryParams;
}

export type PrimitiveEntity =
  | BoxEntity
  | CylinderEntity
  | SphereEntity
  | PlaneEntity;

export type Entity = GroupEntity | PrimitiveEntity;

export interface ProjectMetadata {
  id: string;
  name: string;
  description: string;
  displayUnit: DisplayUnit;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectSettings {
  showGrid: boolean;
  showAxes: boolean;
  showDimensions: boolean;
  showSummaryCard: boolean;
  showAccessories: boolean;
  gridSpacing: number;
}

export interface ProjectDocument {
  schemaVersion: typeof SCHEMA_VERSION;
  project: ProjectMetadata;
  settings: ProjectSettings;
  materials: MaterialDef[];
  entities: Entity[];
  parameters: unknown[];
  constraints: unknown[];
}

export interface AABB {
  min: Vec3;
  max: Vec3;
}

export interface Dimensions3D {
  width: number;
  height: number;
  depth: number;
}

export type ValidationSeverity = 'error' | 'warning';

export interface ValidationIssue {
  severity: ValidationSeverity;
  code: string;
  field?: string;
  entityId?: string;
  message: string;
}

export type QuickObjectCategory = 'boards' | 'bars' | 'shapes' | 'accessories';

export interface CompositePresetPart {
  name: string;
  type: PrimitiveType;
  geometry: GeometryParams;
  materialId: string;
  position: Vec3;
  rotation?: Vec3;
}

export interface PrimitiveQuickObjectPreset {
  id: string;
  kind?: 'primitive';
  category: QuickObjectCategory;
  categoryLabel: string;
  label: string;
  defaultNamePrefix: string;
  type: PrimitiveType;
  geometry: GeometryParams;
  defaultMaterialId: string;
  defaultLayer?: EntityLayer;
  summaryHint: string;
}

export interface CompositeQuickObjectPreset {
  id: string;
  kind: 'composite';
  category: QuickObjectCategory;
  categoryLabel: string;
  label: string;
  defaultNamePrefix: string;
  type: 'group';
  defaultLayer: EntityLayer;
  bounds: Dimensions3D;
  parts: readonly CompositePresetPart[];
  summaryHint: string;
}

export type QuickObjectPreset =
  | PrimitiveQuickObjectPreset
  | CompositeQuickObjectPreset;

export function isCompositeQuickObjectPreset(
  preset: QuickObjectPreset,
): preset is CompositeQuickObjectPreset {
  return preset.kind === 'composite';
}

export type TransformToolMode = 'translate' | 'rotate' | 'scale';

export type CameraPreset = 'initial' | 'front' | 'side' | 'top' | 'isometric';

export function isGroupEntity(entity: Entity): entity is GroupEntity {
  return entity.type === 'group';
}

export function isPrimitiveEntity(entity: Entity): entity is PrimitiveEntity {
  return entity.type !== 'group';
}
