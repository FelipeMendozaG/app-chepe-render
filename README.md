# APP-RENDER-CHEPITA

Modelador 3D paramétrico web, **local-first** y a escala real, diseñado para que personas sin experiencia previa en CAD puedan diseñar, ajustar y visualizar muebles u objetos tridimensionales mediante formularios sencillos, objetos rápidos y manipulación directa en 3D.

---

## Características principales

- **Escena 3D interactiva:** navegación orbital, zoom, desplazamiento, vistas predefinidas (*Inicial*, *Frontal*, *Lateral*, *Superior*, *Isométrica*), suelo con sombras suaves y cuadrícula de referencia.
- **Unidades y escala real:** soporte para `mm`, `cm` y `m` con unidad interna única en **metros** (`1 unidad = 1 m`) y pivote en la base inferior (`Y = 0`) para apoyo automático sobre el suelo.
- **Creación guiada y Objetos rápidos:**
  - Primitivas editables mediante formularios en lenguaje cotidiano: **Caja / Tablero**, **Cilindro / Tubo**, **Esfera** y **Superficie / Plano**.
  - Catálogo de **Objetos rápidos** insertables con un clic o arrastrando directamente al lienzo 3D (*drag-and-drop*).
- **Árbol jerárquico y capas:** agrupar/desagrupar, renombrar, ocultar/mostrar, bloquear/desbloquear, **duplicar** (piezas y grupos al lado del original con sufijo `"copia"`), **eliminar** y capa de **Accesorios** (`main` / `accessories`) con visibilidad rápida.
- **Manipulación directa y cotas:** gizmos de *Mover*, *Rotar* y *Escalar* (el escalado actualiza las dimensiones geométricas reales sin dejar escala arbitraria), cotas exteriores dinámicas y ficha resumen de medidas en pantalla.
- **Materiales y acabados:** presets (roble, blanco mate, acero, grafito, etc.) y personalización de color, rugosidad y metalicidad con propagación en lote a grupos.
- **Persistencia local e historial:** guardado local en **IndexedDB**, exportación/importación en formato **JSON nativo versionado (`schemaVersion: 1`)** y *Deshacer / Rehacer* (`Undo / Redo`) con transacciones.

---

## Stack tecnológico

- **Frontend:** React 19 + TypeScript + Vite
- **Estado:** Zustand (con historial *Undo / Redo* y transacciones)
- **Motor 3D:** Three.js encapsulado e imperativo (actualización incremental y `dispose()` limpio)
- **Estilos:** CSS puro / CSS Modules (sin Tailwind CSS)
- **Pruebas:** Vitest

---

## Arquitectura

El proyecto mantiene una separación estricta en capas bajo `src/`:

```text
src/
├── domain/       # Modelo de dominio puro (tipos, unidades, geometría/AABB, presets, validaciones, serializador JSON)
├── store/        # Estado reactivo con Zustand e historial Undo/Redo
├── engine/       # Adaptador Three.js encapsulado (cámara, mallas, gizmos, cotas, drag-and-drop)
├── persistence/  # Repositorio local en IndexedDB y respaldo JSON portátil
└── ui/           # Componentes React y estilos CSS Modules (TopBar, LeftPanel, Viewport, RightPanel, Modals)
```

---

## Inicio rápido

### Requisitos
- Node.js 18 o superior
- npm

### Instalación y ejecución

```bash
npm install
npm run dev
```

Abre la URL local que muestre Vite (por defecto `http://localhost:5173`).

---

## Comandos disponibles

| Comando | Descripción |
| :--- | :--- |
| `npm run dev` | Inicia el servidor de desarrollo Vite |
| `npm run typecheck` | Ejecuta verificación estricta de TypeScript (`tsc --noEmit`) |
| `npm test` | Ejecuta la suite de pruebas unitarias con Vitest |
| `npm run test:watch` | Ejecuta Vitest en modo observación |
| `npm run build` | Verifica tipos y genera el bundle de producción en `dist/` |
| `npm run preview` | Previsualiza localmente el build de producción |
| `npm run reindex` | Reindexa el repositorio en `codebase-memory` (`persistence: true`) |
| `npm run hooks:install` | Configura `git core.hooksPath` en `.githooks` |

---

## Documentación de referencia

- [`proyecto.md`](./proyecto.md) — Especificación funcional, UX y formato JSON nativo (v0.7).
- [`AGENTS.md`](./AGENTS.md) — Guía arquitectónica y reglas operativas del repositorio.
- [`escritorio_en_L_render_3d.html`](./escritorio_en_L_render_3d.html) — Prototipo visual de referencia.
