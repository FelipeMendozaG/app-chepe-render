# Instrucciones de repositorio — APP-RENDER-CHEPITA

Lee y sigue todas las reglas de `AGENTS.md` y la especificación en `proyecto.md`.

- **Stack:** React + TypeScript + Vite + Zustand + Three.js encapsulado + CSS Modules (sin Tailwind).
- **Reglas de dominio:** Unidad interna en metros, pivote de primitivas en base inferior (`Y = 0`), sin escala arbitraria, `layer: "main" | "accessories"`, propagación en lote de material en grupos, inicio en lienzo vacío y sin *Duplicar* en el MVP.
- **Validación:** Ejecuta `npm run typecheck`, `npm test` y `npm run build` antes de concluir cambios.
- **`codebase-memory` y commits:** Usa `codebase-memory` (`.vscode/mcp.json`) con enfoque *graph-first*. **Cada vez que se haga un `git commit`, debe reindexarse el proyecto** (`.githooks/post-commit` o `npm run reindex` / MCP `index_repository` con `persistence: true`).
