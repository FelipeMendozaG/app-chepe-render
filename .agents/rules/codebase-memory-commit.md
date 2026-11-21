# Regla de `codebase-memory` y reindexación en cada commit

1. **Exploración *graph-first*:** Antes de recorrer múltiples archivos manualmente, consulta el índice de `codebase-memory` (`get_architecture`, `search_graph`, `trace_path`, `get_code_snippet`, `query_graph`).
2. **Reindexación obligatoria tras cada `git commit`:**
   - Todo `git commit` debe dejar actualizado el índice de `codebase-memory` y el archivo persistente `.codebase-memory/graph.db.zst`.
   - El hook versionado `.githooks/post-commit` ejecuta `node scripts/reindex-codebase.mjs` automáticamente.
   - Si el commit se realizó desde un agente o sin hooks activos, el agente debe invocar inmediatamente `index_repository` con `{"repo_path": "<ruta-del-repo>", "mode": "full", "persistence": true}` o ejecutar `npm run reindex`.
