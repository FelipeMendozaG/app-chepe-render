import {
  SCHEMA_VERSION,
  type BoxGeometryParams,
  type CylinderGeometryParams,
  type DisplayUnit,
  type Entity,
  type GeometryParams,
  type MaterialDef,
  type PlaneGeometryParams,
  type PrimitiveType,
  type ProjectDocument,
  type QuickObjectPreset,
  type SphereGeometryParams,
} from './types';

export const DEFAULT_MATERIALS: readonly MaterialDef[] = [
  {
    id: 'mat-oak-natural',
    name: 'Roble natural',
    color: '#c9a575',
    roughness: 0.52,
    metalness: 0.0,
  },
  {
    id: 'mat-oak-edge',
    name: 'Canto roble',
    color: '#a98253',
    roughness: 0.6,
    metalness: 0.0,
  },
  {
    id: 'mat-white-matte',
    name: 'Blanco mate',
    color: '#f4f3ef',
    roughness: 0.72,
    metalness: 0.0,
  },
  {
    id: 'mat-warm-gray',
    name: 'Gris cálido',
    color: '#d8d4ca',
    roughness: 0.68,
    metalness: 0.0,
  },
  {
    id: 'mat-graphite',
    name: 'Grafito oscuro',
    color: '#343638',
    roughness: 0.35,
    metalness: 0.1,
  },
  {
    id: 'mat-steel',
    name: 'Acero',
    color: '#777b7d',
    roughness: 0.28,
    metalness: 0.7,
  },
  {
    id: 'mat-sage',
    name: 'Verde salvia',
    color: '#60785b',
    roughness: 0.68,
    metalness: 0.0,
  },
];

export const DEFAULT_MATERIAL_ID = DEFAULT_MATERIALS[0].id;

export const QUICK_OBJECT_PRESETS: readonly QuickObjectPreset[] = [
  {
    id: 'quick-board',
    category: 'boards',
    categoryLabel: 'Tableros y cajas',
    label: 'Tablero / Cubierta',
    defaultNamePrefix: 'Tablero',
    type: 'box',
    geometry: { width: 1.2, height: 0.02, depth: 0.6 },
    defaultMaterialId: 'mat-oak-natural',
    summaryHint: '120 × 2 × 60 cm',
  },
  {
    id: 'quick-box',
    category: 'boards',
    categoryLabel: 'Tableros y cajas',
    label: 'Caja / Cajón',
    defaultNamePrefix: 'Caja',
    type: 'box',
    geometry: { width: 0.4, height: 0.15, depth: 0.35 },
    defaultMaterialId: 'mat-white-matte',
    summaryHint: '40 × 15 × 35 cm',
  },
  {
    id: 'quick-panel',
    category: 'boards',
    categoryLabel: 'Tableros y cajas',
    label: 'Panel / Repisa / Faldón',
    defaultNamePrefix: 'Panel',
    type: 'box',
    geometry: { width: 0.8, height: 0.02, depth: 0.25 },
    defaultMaterialId: 'mat-oak-edge',
    summaryHint: '80 × 2 × 25 cm',
  },
  {
    id: 'quick-round-bar',
    category: 'bars',
    categoryLabel: 'Barras y soportes',
    label: 'Barra / Tubo redondo',
    defaultNamePrefix: 'Barra',
    type: 'cylinder',
    geometry: { radius: 0.015, height: 1.0, radialSegments: 32 },
    defaultMaterialId: 'mat-steel',
    summaryHint: 'Ø 3 × 100 cm',
  },
  {
    id: 'quick-rect-profile',
    category: 'bars',
    categoryLabel: 'Barras y soportes',
    label: 'Perfil / Barra rectangular',
    defaultNamePrefix: 'Perfil',
    type: 'box',
    geometry: { width: 0.04, height: 0.04, depth: 1.0 },
    defaultMaterialId: 'mat-graphite',
    summaryHint: '4 × 4 × 100 cm',
  },
  {
    id: 'quick-leg',
    category: 'bars',
    categoryLabel: 'Barras y soportes',
    label: 'Pata / Soporte estándar',
    defaultNamePrefix: 'Pata',
    type: 'cylinder',
    geometry: { radius: 0.025, height: 0.75, radialSegments: 32 },
    defaultMaterialId: 'mat-steel',
    summaryHint: 'Ø 5 × 75 cm',
  },
  {
    id: 'quick-sphere',
    category: 'shapes',
    categoryLabel: 'Formas base',
    label: 'Esfera',
    defaultNamePrefix: 'Esfera',
    type: 'sphere',
    geometry: { radius: 0.1, widthSegments: 32, heightSegments: 24 },
    defaultMaterialId: 'mat-sage',
    summaryHint: 'Ø 20 cm',
  },
  {
    id: 'quick-plane',
    category: 'shapes',
    categoryLabel: 'Formas base',
    label: 'Superficie / Plano',
    defaultNamePrefix: 'Plano',
    type: 'plane',
    geometry: { width: 1.0, depth: 1.0 },
    defaultMaterialId: 'mat-warm-gray',
    summaryHint: '100 × 100 cm',
  },
];

export const PRIMITIVE_LABELS: Record<PrimitiveType, string> = {
  box: 'Caja / Tablero / Barra rectangular',
  cylinder: 'Cilindro / Barra redonda / Tubo',
  sphere: 'Esfera',
  plane: 'Superficie / Panel',
};

export const PRIMITIVE_DEFAULT_PREFIX: Record<PrimitiveType, string> = {
  box: 'Caja',
  cylinder: 'Cilindro',
  sphere: 'Esfera',
  plane: 'Plano',
};

export function getDefaultGeometryForPrimitive(type: 'box'): BoxGeometryParams;
export function getDefaultGeometryForPrimitive(
  type: 'cylinder',
): CylinderGeometryParams;
export function getDefaultGeometryForPrimitive(
  type: 'sphere',
): SphereGeometryParams;
export function getDefaultGeometryForPrimitive(
  type: 'plane',
): PlaneGeometryParams;
export function getDefaultGeometryForPrimitive(
  type: PrimitiveType,
): GeometryParams;
export function getDefaultGeometryForPrimitive(
  type: PrimitiveType,
): GeometryParams {
  switch (type) {
    case 'box':
      return { width: 0.6, height: 0.4, depth: 0.4 };
    case 'cylinder':
      return { radius: 0.1, height: 0.6, radialSegments: 32 };
    case 'sphere':
      return { radius: 0.15, widthSegments: 32, heightSegments: 24 };
    case 'plane':
      return { width: 1.0, depth: 1.0 };
  }
}

export function getQuickObjectPreset(
  presetId: string,
): QuickObjectPreset | undefined {
  return QUICK_OBJECT_PRESETS.find((preset) => preset.id === presetId);
}

export function generateId(prefix: string): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }
  const random = Math.random().toString(36).slice(2, 10);
  const stamp = Date.now().toString(36);
  return `${prefix}-${stamp}-${random}`;
}

export function generateCorrelativeName(
  baseName: string,
  entities: readonly Entity[],
): string {
  const escaped = baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^${escaped}\\s+(\\d+)$`, 'i');
  let maxNumber = 0;

  for (const entity of entities) {
    const match = entity.name.trim().match(pattern);
    if (match) {
      const value = Number.parseInt(match[1], 10);
      if (value > maxNumber) {
        maxNumber = value;
      }
    }
  }

  return `${baseName} ${maxNumber + 1}`;
}

export function generateCopyName(
  sourceName: string,
  entities: readonly Entity[],
): string {
  const trimmed = sourceName.trim();
  const baseName = trimmed.replace(/\s+copia(?:\s+\d+)?$/i, '').trim() || trimmed;
  const existing = new Set(entities.map((e) => e.name.trim().toLowerCase()));

  const firstCandidate = `${baseName} copia`;
  if (!existing.has(firstCandidate.toLowerCase())) {
    return firstCandidate;
  }

  let index = 2;
  while (existing.has(`${baseName} copia ${index}`.toLowerCase())) {
    index += 1;
  }
  return `${baseName} copia ${index}`;
}

export function createEmptyProjectDocument(options?: {
  name?: string;
  description?: string;
  displayUnit?: DisplayUnit;
}): ProjectDocument {
  const now = new Date().toISOString();
  return {
    schemaVersion: SCHEMA_VERSION,
    project: {
      id: generateId('prj'),
      name: options?.name?.trim() || 'Nuevo proyecto',
      description: options?.description?.trim() || '',
      displayUnit: options?.displayUnit ?? 'cm',
      createdAt: now,
      updatedAt: now,
    },
    settings: {
      showGrid: true,
      showAxes: true,
      showDimensions: true,
      showSummaryCard: true,
      showAccessories: true,
      gridSpacing: 0.1,
    },
    materials: DEFAULT_MATERIALS.map((mat) => ({ ...mat })),
    entities: [],
    parameters: [],
    constraints: [],
  };
}
