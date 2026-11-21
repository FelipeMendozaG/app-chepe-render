# CLAUDE.md

@AGENTS.md

## Notas específicas para Claude Code
- Usa `.mcp.json` en la raíz para conectar con el servidor MCP `codebase-memory`.
- Tras cada `git commit`, verifica que `.githooks/post-commit` haya ejecutado la reindexación o corre `npm run reindex` / `index_repository` (`persistence: true`) inmediatamente.
