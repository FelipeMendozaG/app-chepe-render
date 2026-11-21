# AGENTS.md — Guía Universal para Agentes de IA (`APP-RENDER-CHEPITA`)

Este archivo es la **fuente única de verdad** de instrucciones operativas y arquitectónicas para cualquier agente de IA que trabaje en este repositorio (Antigravity, Claude Code, Codex CLI, Gemini CLI, Cursor, Windsurf, Copilot, Cline, Roo Code, OpenCode, Zed, etc.).

La especificación funcional y UX vigente reside en [`proyecto.md`](./proyecto.md) (v0.6).

---

## 1. Arquitectura y principios obligatorios

1. **Separación estricta de 4 capas:**
   - `src/domain/`: Modelo de dominio puro, 100% independiente de React y Three.js (tipos JSON `schemaVersion: 1`, unidades, validaciones, AABB, presets, serializador).
   - `src/store/`: Estado reactivo con **Zustand** + historial *Undo/Redo* con transacciones.
   - `src/engine/`: Adaptador **Three.js encapsulado e imperativo** (suscripción incremental, sin reconstruir toda la escena y con `dispose()` limpio de geometrías/materiales/texturas).
   - `src/persistence/`: Guardado local en **IndexedDB** y respaldo JSON portátil.
   - `src/ui/`: Interfaz **React + CSS puro / CSS Modules** (sin Tailwind CSS), manteniendo la estética cálida del prototipo [`escritorio_en_L_render_3d.html`](./escritorio_en_L_render_3d.html) (conservar ese HTML intacto).
2. **Modelo de dominio como fuente de verdad:**
   - Unidad interna única: **metros (`m`)**; rotaciones internas en **radianes** (orden `XYZ`, sistema `Y-up`).
   - **Pivote en base inferior (`Y = 0`, centrado en `X/Z`):** toda primitiva con `position.y = 0` apoya sobre el suelo y al aumentar su *Alto* crece hacia arriba sin hundirse.
   - **Sin escala arbitraria en primitivas:** el gizmo *Escalar* modifica las dimensiones geométricas reales y restablece `scale` a `[1, 1, 1]` (`cylinder`: uniforme en `XZ` y libre en `Y`; `sphere`: uniforme en `XYZ`; `plane`: solo `X/Z`; `group`: deshabilitado).
   - **Capa de accesorios:** cada entidad/grupo define `layer: "main" | "accessories"`, controlado por `settings.showAccessories`.
   - **Materiales en grupos:** aplicar un material a un grupo lo propaga en lote a sus piezas hijas.
   - **Alcance estricto MVP:** lienzo vacío al iniciar (sin proyecto de ejemplo precargado); **sin** funcionalidad de *Duplicar* en el MVP (sí incluir *Eliminar* reversible con *Undo*).

---

## 2. Comandos del proyecto

```bash
npm run dev           # Servidor de desarrollo Vite
npm run typecheck     # Verificación estricta de TypeScript (tsc --noEmit)
npm test              # Pruebas unitarias con Vitest (vitest run)
npm run build         # Typecheck + build de producción Vite
npm run reindex       # Reindexa el proyecto en codebase-memory (persistence: true)
npm run hooks:install # Configura git core.hooksPath en .githooks
```

Antes de cerrar cualquier cambio de código, ejecutar al menos `npm run typecheck`, `npm test` y `npm run build`.

---

## 3. Reglas obligatorias de `codebase-memory`

Este repositorio incluye configuración MCP de `codebase-memory` (`.mcp.json`, `.vscode/mcp.json`, `.cursor/mcp.json`) e índice persistente en `.codebase-memory/graph.db.zst`.

### 3.1 Flujo de exploración (*Graph-first*)
Cuando el servidor MCP `codebase-memory` esté disponible:
- Usa `get_architecture` para panorama estructural.
- Usa `search_graph` para buscar símbolos, `trace_path` para relaciones/llamadas, `get_code_snippet` para leer código puntual y `query_graph` para consultas multi-salto.
- Usa `search_code` o grep solo para literales o vacíos de cobertura.

### 3.2 Regla obligatoria: reindexar en cada commit
> **REGLA ESTRICTA:** Cada vez que se realice un `git commit` en este repositorio, **el proyecto DEBE reindexarse en `codebase-memory` con `persistence: true`** para mantener sincronizados el grafo local y `.codebase-memory/graph.db.zst` con los últimos cambios.

* **Mecanismo automático:** El hook versionado [`.githooks/post-commit`](./.githooks/post-commit) ejecuta automáticamente `node scripts/reindex-codebase.mjs` después de cada commit (activado mediante `git config core.hooksPath .githooks` o `npm run hooks:install`).
* **Verificación obligatoria del agente:** Si un agente ejecuta `git commit` (o si el entorno omite hooks, p. ej. `--no-verify` o sandbox sin hook), el agente **debe** invocar explícitamente la herramienta MCP `index_repository` con `{"repo_path": "<ruta-del-repo>", "mode": "full", "persistence": true}` o ejecutar `npm run reindex` inmediatamente después del commit y confirmar que la reindexación finalizó correctamente.
