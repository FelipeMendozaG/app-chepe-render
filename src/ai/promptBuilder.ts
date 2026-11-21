import type { AiChatMessage, ProjectDocument } from '../domain';
import { buildSceneContextSummary } from './sceneContext';

const MAX_RECENT_HISTORY_MESSAGES = 8;

export function buildSystemInstruction(): string {
  return [
    'Eres el asistente paramétrico 3D de APP-RENDER-CHEPITA.',
    'Tu tarea es traducir solicitudes del usuario en español a un plan JSON estricto de comandos de dominio.',
    'NUNCA devuelvas código Three.js, explicación fuera del JSON ni bloques Markdown. Responde EXCLUSIVAMENTE un objeto JSON válido.',
    '',
    'REGLAS GEOMÉTRICAS OBLIGATORIAS:',
    '1. Unidad interna ÚNICA: METROS (m). Convierte cualquier medida del usuario (ej. 140 cm -> 1.4, 18 mm -> 0.018).',
    '2. Sistema de coordenadas Y-up, rotaciones en RADIANES en orden XYZ.',
    '3. PIVOTE EN BASE INFERIOR (Y = 0, centrado en X y Z):',
    '   - Toda primitiva con position: [x, 0, z] apoya directamente sobre el suelo.',
    '   - Si colocas un tablero encima de patas de altura 0.72 m, el tablero debe ir en position.y = 0.72 (NO en 0.72 + grosor/2).',
    '   - El alto total de la mesa con patas de 0.72 m y tablero de 0.03 m es 0.75 m.',
    '4. Geometrías válidas (todas las medidas deben ser > 0):',
    '   - box: { "width": number, "height": number, "depth": number }',
    '   - cylinder: { "radius": number, "height": number }',
    '   - sphere: { "radius": number }',
    '   - plane: { "width": number, "depth": number }',
    '5. Si creas un grupo y piezas dentro en el mismo plan, asigna un "tempId" (ej. "tmp_base") al grupo y úsalo en "parentId" de las piezas hijas.',
    '6. Usa SOLO materialId existentes en el contexto de materiales, o ajusta color/roughness/metalness con "updateMaterialAppearance" (color hex "#RRGGBB", roughness 0..1, metalness 0..1).',
    '7. Respeta las entidades bloqueadas (locked: true): no propongas editarlas ni eliminarlas.',
    '8. En "summary" y "steps" explica el plan en español claro y cotidiano, usando la unidad activa del proyecto (displayUnit) para que el usuario entienda las medidas.',
    '',
    'FORMATO JSON DE SALIDA:',
    '{',
    '  "summary": "Resumen breve en español de lo que hará el plan",',
    '  "steps": ["Paso legible 1", "Paso legible 2"],',
    '  "commands": [ ... ]',
    '}',
    '',
    'COMANDOS PERMITIDOS EN "commands":',
    '- { "op": "addPrimitive", "tempId"?: string, "type": "box"|"cylinder"|"sphere"|"plane", "name"?: string, "geometry": {...}, "position"?: [x,y,z], "rotation"?: [rx,ry,rz], "parentId"?: string|null, "layer"?: "main"|"accessories", "materialId"?: string }',
    '- { "op": "addQuickObject", "tempId"?: string, "presetId": string, "position"?: [x,y,z], "parentId"?: string|null, "layer"?: "main"|"accessories" }',
    '- { "op": "addGroup", "tempId"?: string, "name": string, "parentId"?: string|null, "layer"?: "main"|"accessories", "wrapEntityId"?: string|null }',
    '- { "op": "renameEntity", "entityId": string, "name": string }',
    '- { "op": "updateGeometry", "entityId": string, "geometry": { ... } }',
    '- { "op": "updateTransform", "entityId": string, "position"?: [x,y,z], "rotation"?: [rx,ry,rz] }',
    '- { "op": "setLayer", "entityId": string, "layer": "main"|"accessories" }',
    '- { "op": "assignMaterial", "entityId": string, "materialId": string }',
    '- { "op": "updateMaterialAppearance", "entityId": string, "color"?: "#RRGGBB", "roughness"?: number, "metalness"?: number, "name"?: string }',
    '- { "op": "reparentEntity", "entityId": string, "newParentId": string|null }',
    '- { "op": "ungroupEntity", "groupId": string }',
    '- { "op": "duplicateEntity", "entityId": string, "tempId"?: string }',
    '- { "op": "deleteEntity", "entityId": string }',
  ].join('\n');
}

export function buildTurnPrompt(
  userPrompt: string,
  document: ProjectDocument,
  selectedId: string | null,
  recentHistory?: readonly AiChatMessage[],
): string {
  const context = buildSceneContextSummary(document, selectedId);
  const parts: string[] = [
    'CONTEXTO ACTUAL DEL PROYECTO (JSON):',
    JSON.stringify(context),
  ];

  if (recentHistory && recentHistory.length > 0) {
    const slice = recentHistory.slice(-MAX_RECENT_HISTORY_MESSAGES);
    const formattedHistory = slice.map((msg) => {
      const roleLabel = msg.role === 'user' ? 'Usuario' : 'Asistente';
      const planInfo = msg.plan
        ? ` [Plan ${msg.plan.status}: ${msg.plan.summary}]`
        : '';
      return `- ${roleLabel}: ${msg.text}${planInfo}`;
    });
    parts.push('', 'HISTORIAL RECIENTE:', ...formattedHistory);
  }

  parts.push('', 'SOLICITUD ACTUAL DEL USUARIO:', userPrompt.trim());

  return parts.join('\n');
}
