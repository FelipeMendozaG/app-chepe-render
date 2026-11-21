import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

const check = spawnSync('git', ['rev-parse', '--is-inside-work-tree'], {
  cwd: repoRoot,
  encoding: 'utf8',
});

if (check.status !== 0) {
  console.log('[hooks] No es un repositorio git todavía; omite configuración de core.hooksPath.');
  process.exit(0);
}

const config = spawnSync('git', ['config', 'core.hooksPath', '.githooks'], {
  cwd: repoRoot,
  encoding: 'utf8',
});

if (config.status !== 0) {
  console.warn('[hooks] No se pudo configurar core.hooksPath:', config.stderr?.trim());
  process.exit(0);
}

console.log('[hooks] Git core.hooksPath configurado en .githooks');
