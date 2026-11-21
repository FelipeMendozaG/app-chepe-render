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
  // Accesorios y objetos de contexto compuestos (capa "accessories")
  {
    id: 'quick-laptop',
    kind: 'composite',
    category: 'accessories',
    categoryLabel: 'Accesorios y contexto',
    label: 'Laptop',
    defaultNamePrefix: 'Laptop',
    type: 'group',
    defaultLayer: 'accessories',
    bounds: { width: 0.32, height: 0.22, depth: 0.23 },
    summaryHint: '32 × 22 × 23 cm',
    parts: [
      {
        name: 'Base',
        type: 'box',
        geometry: { width: 0.32, height: 0.012, depth: 0.22 },
        materialId: 'mat-steel',
        position: [0, 0, 0],
      },
      {
        name: 'Teclado',
        type: 'box',
        geometry: { width: 0.28, height: 0.002, depth: 0.11 },
        materialId: 'mat-graphite',
        position: [0, 0.012, -0.02],
      },
      {
        name: 'Pantalla',
        type: 'box',
        geometry: { width: 0.32, height: 0.208, depth: 0.008 },
        materialId: 'mat-graphite',
        position: [0, 0.012, -0.106],
        rotation: [-0.18, 0, 0],
      },
    ],
  },
  {
    id: 'quick-monitor',
    kind: 'composite',
    category: 'accessories',
    categoryLabel: 'Accesorios y contexto',
    label: 'Monitor',
    defaultNamePrefix: 'Monitor',
    type: 'group',
    defaultLayer: 'accessories',
    bounds: { width: 0.54, height: 0.42, depth: 0.18 },
    summaryHint: '54 × 42 × 18 cm',
    parts: [
      {
        name: 'Base',
        type: 'box',
        geometry: { width: 0.24, height: 0.012, depth: 0.18 },
        materialId: 'mat-graphite',
        position: [0, 0, 0],
      },
      {
        name: 'Soporte',
        type: 'box',
        geometry: { width: 0.045, height: 0.118, depth: 0.035 },
        materialId: 'mat-steel',
        position: [0, 0.012, -0.04],
      },
      {
        name: 'Pantalla',
        type: 'box',
        geometry: { width: 0.54, height: 0.29, depth: 0.024 },
        materialId: 'mat-graphite',
        position: [0, 0.13, -0.04],
      },
    ],
  },
  {
    id: 'quick-desktop-pc',
    kind: 'composite',
    category: 'accessories',
    categoryLabel: 'Accesorios y contexto',
    label: 'PC de escritorio',
    defaultNamePrefix: 'PC de escritorio',
    type: 'group',
    defaultLayer: 'accessories',
    bounds: { width: 0.21, height: 0.45, depth: 0.44 },
    summaryHint: '21 × 45 × 44 cm',
    parts: [
      {
        name: 'Base',
        type: 'box',
        geometry: { width: 0.19, height: 0.015, depth: 0.4 },
        materialId: 'mat-graphite',
        position: [0, 0, 0],
      },
      {
        name: 'Gabinete',
        type: 'box',
        geometry: { width: 0.21, height: 0.435, depth: 0.42 },
        materialId: 'mat-graphite',
        position: [0, 0.015, -0.01],
      },
      {
        name: 'Panel frontal',
        type: 'box',
        geometry: { width: 0.21, height: 0.435, depth: 0.02 },
        materialId: 'mat-steel',
        position: [0, 0.015, 0.21],
      },
    ],
  },
  {
    id: 'quick-plant',
    kind: 'composite',
    category: 'accessories',
    categoryLabel: 'Accesorios y contexto',
    label: 'Maceta con planta',
    defaultNamePrefix: 'Maceta',
    type: 'group',
    defaultLayer: 'accessories',
    bounds: { width: 0.18, height: 0.33, depth: 0.18 },
    summaryHint: '18 × 33 × 18 cm',
    parts: [
      {
        name: 'Maceta',
        type: 'cylinder',
        geometry: { radius: 0.085, height: 0.16, radialSegments: 24 },
        materialId: 'mat-oak-edge',
        position: [0, 0, 0],
      },
      {
        name: 'Sustrato',
        type: 'cylinder',
        geometry: { radius: 0.075, height: 0.01, radialSegments: 24 },
        materialId: 'mat-graphite',
        position: [0, 0.16, 0],
      },
      {
        name: 'Follaje',
        type: 'sphere',
        geometry: { radius: 0.08, widthSegments: 24, heightSegments: 18 },
        materialId: 'mat-sage',
        position: [0, 0.17, 0],
      },
    ],
  },
  {
    id: 'quick-lamp',
    kind: 'composite',
    category: 'accessories',
    categoryLabel: 'Accesorios y contexto',
    label: 'Lámpara de escritorio',
    defaultNamePrefix: 'Lámpara',
    type: 'group',
    defaultLayer: 'accessories',
    bounds: { width: 0.16, height: 0.38, depth: 0.22 },
    summaryHint: '16 × 38 × 22 cm',
    parts: [
      {
        name: 'Base',
        type: 'cylinder',
        geometry: { radius: 0.08, height: 0.02, radialSegments: 24 },
        materialId: 'mat-graphite',
        position: [0, 0, -0.03],
      },
      {
        name: 'Mástil',
        type: 'cylinder',
        geometry: { radius: 0.009, height: 0.34, radialSegments: 16 },
        materialId: 'mat-steel',
        position: [0, 0.02, -0.05],
      },
      {
        name: 'Brazo',
        type: 'box',
        geometry: { width: 0.018, height: 0.018, depth: 0.12 },
        materialId: 'mat-steel',
        position: [0, 0.36, 0.001],
      },
      {
        name: 'Pantalla',
        type: 'cylinder',
        geometry: { radius: 0.055, height: 0.09, radialSegments: 24 },
        materialId: 'mat-warm-gray',
        position: [0, 0.27, 0.055],
      },
    ],
  },
  {
    id: 'quick-mug',
    kind: 'composite',
    category: 'accessories',
    categoryLabel: 'Accesorios y contexto',
    label: 'Taza',
    defaultNamePrefix: 'Taza',
    type: 'group',
    defaultLayer: 'accessories',
    bounds: { width: 0.11, height: 0.1, depth: 0.09 },
    summaryHint: '11 × 10 × 9 cm',
    parts: [
      {
        name: 'Cuerpo',
        type: 'cylinder',
        geometry: { radius: 0.042, height: 0.1, radialSegments: 24 },
        materialId: 'mat-white-matte',
        position: [0, 0, 0],
      },
      {
        name: 'Asa',
        type: 'box',
        geometry: { width: 0.028, height: 0.056, depth: 0.012 },
        materialId: 'mat-white-matte',
        position: [0.056, 0.022, 0],
      },
    ],
  },
  {
    id: 'quick-keyboard-mouse',
    kind: 'composite',
    category: 'accessories',
    categoryLabel: 'Accesorios y contexto',
    label: 'Teclado y mouse',
    defaultNamePrefix: 'Teclado y mouse',
    type: 'group',
    defaultLayer: 'accessories',
    bounds: { width: 0.54, height: 0.03, depth: 0.13 },
    summaryHint: '54 × 3 × 13 cm',
    parts: [
      {
        name: 'Teclado',
        type: 'box',
        geometry: { width: 0.42, height: 0.018, depth: 0.13 },
        materialId: 'mat-graphite',
        position: [-0.06, 0, 0],
      },
      {
        name: 'Mouse',
        type: 'box',
        geometry: { width: 0.065, height: 0.032, depth: 0.11 },
        materialId: 'mat-graphite',
        position: [0.23, 0, 0],
      },
    ],
  },
  {
    id: 'quick-books',
    kind: 'composite',
    category: 'accessories',
    categoryLabel: 'Accesorios y contexto',
    label: 'Libros apilados',
    defaultNamePrefix: 'Libros',
    type: 'group',
    defaultLayer: 'accessories',
    bounds: { width: 0.24, height: 0.1, depth: 0.17 },
    summaryHint: '24 × 10 × 17 cm',
    parts: [
      {
        name: 'Libro inferior',
        type: 'box',
        geometry: { width: 0.24, height: 0.036, depth: 0.17 },
        materialId: 'mat-sage',
        position: [0, 0, 0],
      },
      {
        name: 'Libro medio',
        type: 'box',
        geometry: { width: 0.22, height: 0.032, depth: 0.16 },
        materialId: 'mat-oak-natural',
        position: [0, 0.036, 0],
      },
      {
        name: 'Libro superior',
        type: 'box',
        geometry: { width: 0.2, height: 0.03, depth: 0.15 },
        materialId: 'mat-white-matte',
        position: [0, 0.068, 0],
      },
    ],
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
