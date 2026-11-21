# GEMINI.md — Reglas del workspace (`APP-RENDER-CHEPITA`)

Sigue obligatoriamente todas las directrices definidas en [AGENTS.md](./AGENTS.md) y la especificación funcional en [proyecto.md](./proyecto.md).

## Recordatorios críticos
1. **Arquitectura:** React + TypeScript + Vite + Zustand + Three.js encapsulado + CSS Modules (sin Tailwind). Mantén `src/domain/` 100% desacoplado de React y Three.js, pivote en base inferior (`Y = 0`), sin escala arbitraria en primitivas, lienzo inicial vacío y operaciones de árbol con *Duplicar* (desplazamiento lateral y sufijo `"copia"`) y *Eliminar* reversibles con *Undo*.
2. **`codebase-memory` (Graph-first):** Prioriza las herramientas del servidor MCP `codebase-memory` (`search_graph`, `trace_path`, `get_code_snippet`, `get_architecture`) para navegar el código.
3. **Reindexación obligatoria tras cada commit:** Cada vez que se realice un `git commit`, asegúrate de que el repositorio se reindexe en `codebase-memory` actualizando los cambios (`persistence: true`). El hook `.githooks/post-commit` lo ejecuta automáticamente; si no se disparó o el commit se hizo sin hooks, ejecuta `index_repository` (MCP) con `persistence: true` o `npm run reindex`.
