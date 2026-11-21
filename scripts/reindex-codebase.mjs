import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..').replace(/\\/g, '/');

const payload = JSON.stringify({
  repo_path: repoRoot,
  mode: 'full',
  persistence: true,
});

const result = spawnSync(
  'codebase-memory-mcp',
  ['cli', '--quiet', 'index_repository', payload],
  {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);

if (result.error) {
  if (result.error.code === 'ENOENT') {
    console.warn(
      '[codebase-memory] No se encontró "codebase-memory-mcp" en el PATH. Omite reindexación automática.',
    );
    process.exit(0);
  }
  console.error('[codebase-memory] Error al ejecutar reindexación:', result.error.message);
  process.exit(1);
}

if (result.status !== 0) {
  if (result.stderr?.trim()) {
    console.error(result.stderr.trim());
  }
  if (result.stdout?.trim()) {
    console.error(result.stdout.trim());
  }
  console.error(`[codebase-memory] Reindexación finalizó con código ${result.status}.`);
  process.exit(result.status ?? 1);
}

console.log('[codebase-memory] Proyecto reindexado correctamente (.codebase-memory/graph.db.zst actualizado).');
