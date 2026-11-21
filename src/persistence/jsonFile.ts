import {
  deserializeProject,
  serializeProject,
  type DeserializeResult,
  type ProjectDocument,
} from '../domain';

export function buildProjectFilename(projectName: string): string {
  const slug = projectName
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${slug || 'proyecto-3d'}.chepita.json`;
}

export function downloadProjectJson(doc: ProjectDocument): void {
  const json = serializeProject(doc);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = buildProjectFilename(doc.project.name);
  document.body.appendChild(link);
  link.click();
  link.remove();

  // Revoke object URL on next tick
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function parseProjectJsonFile(
  file: File,
): Promise<DeserializeResult> {
  try {
    const text = await file.text();
    return deserializeProject(text);
  } catch {
    return {
      ok: false,
      error: 'No se pudo leer el archivo seleccionado.',
    };
  }
}
