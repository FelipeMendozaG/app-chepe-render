# Especificación Consolidada de Requerimientos y UX — APP-RENDER-CHEPITA

**Versión:** 0.6 (Consolidación completa de requerimientos, UX, hallazgos del prototipo y decisiones técnicas para MVP)  
**Estado:** Definición cerrada y alineada para inicio de implementación del MVP  
**Enfoque:** Modelador 3D paramétrico genérico, web, local-first y amigable para usuarios sin experiencia previa en 3D  

---

## 1. Visión y principios del producto

**APP-RENDER-CHEPITA** es una aplicación web diseñada para que personas sin conocimientos previos de modelado 3D (personas que diseñan muebles para su hogar, carpinteros, diseñadores de interiores, estudiantes) puedan crear, modificar y visualizar objetos tridimensionales a escala real mediante **formularios sencillos**, **atajos de objetos rápidos** y **manipulación directa en el espacio 3D**.

### Principios rectores
1. **Simplicidad y lenguaje cotidiano:** La interfaz evita jerga técnica de ingeniería 3D. Utiliza términos claros como *Ancho*, *Alto*, *Profundidad*, *Espesor* y *Diámetro*, acompañados siempre de la unidad activa (`mm`, `cm` o `m`).
2. **Modelo de dominio como fuente de verdad:** Todas las dimensiones, jerarquías, materiales y reglas residen en un modelo lógico independiente. El motor gráfico (Three.js) actúa exclusivamente como adaptador de visualización.
3. **Coherencia bidireccional:** Modificar un número en un formulario actualiza inmediatamente el objeto y sus cotas en 3D; mover o escalar un objeto en la escena 3D actualiza automáticamente los parámetros dimensionales reales en los formularios.
4. **Local-first sin fricción:** Funciona íntegramente en el navegador del usuario (IndexedDB) sin requerir cuentas ni servidores, ofreciendo respaldo externo mediante archivos JSON nativos versionados.

---

## 2. Alcance consolidado por versiones

### 2.1 MVP — Editor paramétrico básico y amigable
* **Escena, entorno y navegación (RF-01):** Escena 3D interactiva (*desktop-first*) con rotación orbital, acercar/alejar, desplazamiento, vistas predefinidas (frontal, lateral, superior, isométrica), reinicio de vista con botón de estado activo, límites seguros de cámara (evitando atravesar el suelo o perder el objeto), suelo con sombras suaves y cuadrícula sin parpadeo (*z-fighting*).
* **Sistema de unidades y escala real (RF-02):** Soporte para `mm`, `cm` y `m`. Unidad interna única en **metros** (`1 unidad de mundo = 1 m`). Cambiar la unidad visual modifica solo las etiquetas y formularios, nunca la escala real del objeto.
* **Creación guiada mediante formularios (RF-03, RF-04):** Creación de primitivas base (**Caja / Tablero**, **Cilindro / Tubo**, **Esfera** y **Superficie / Plano**) a partir de formularios claros con valores iniciales sugeridos.
* **Objetos rápidos / Atajos de inserción (RF-04B):** Biblioteca visual de atajos predefinidos (tableros, cajas, barras redondas, perfiles rectangulares, patas/soportes) que el usuario puede insertar con **un clic** o **arrastrar directamente a la escena** (*drag-and-drop*), quedando como piezas paramétricas totalmente editables.
* **Composición jerárquica y subpiezas (RF-05):** Árbol de piezas y grupos con identificadores estables. Permite crear, renombrar, agrupar/desagrupar, eliminar, ocultar/mostrar y bloquear/desbloquear elementos. Soporte para subpiezas estructurales y de acabado (como faldones, travesaños, soportes o frentes de cajón) y **capas de contexto/accesorios (`layer: "accessories"`)** que pueden mostrarse u ocultarse con un clic. Transformar un grupo desplaza y rota todas sus piezas hijas.
* **Manipulación directa, cotas y ficha resumen (RF-07, RF-09):** Selección por clic en escena o árbol, resaltado visual, gizmos de *Mover*, *Rotar* y *Escalar*, cotas dinámicas con líneas de extensión y etiquetas siempre legibles, y una **ficha resumen en pantalla** con las dimensiones clave del proyecto u objeto seleccionado.
* **Materiales y apariencia (RF-08):** Asignación de colores, materiales predefinidos (ej. madera, metal, acabados de borde/canto) y ajuste sencillo de rugosidad y metalicidad sin alterar dimensiones. Aplicar un material a un grupo lo propaga en lote a todas sus piezas hijas.
* **Persistencia e historial (RF-10):** Guardado local en IndexedDB (crear, listar, renombrar, eliminar), aviso ante cambios sin guardar, exportación/importación de archivo JSON nativo versionado y *Deshacer / Rehacer* (`Undo / Redo`).
* **Validaciones y rendimiento (RF-12, RNF-01):** Mensajes de error claros en lenguaje sencillo, actualización incremental de piezas (sin reconstruir toda la escena) y liberación limpia de memoria gráfica.

### 2.2 Versiones posteriores (v2 y v3)
* **Versión 2 (Parametrización y documentación):** Grafo de dependencias entre parámetros, expresiones controladas, restricciones geométricas (igualdad, alineación, distancia fija), *snapping* a vértices/caras, patrones lineales y circulares, plantillas compuestas configurables (ej. escritorio en L con cajonero), vistas ortogonales, exportación 3D (GLB/glTF), imágenes, fichas dimensionales en PDF y listas de piezas en CSV.
* **Versión 3 (Capacidades CAD ligeras):** Nuevas geometrías, operaciones booleanas seleccionadas, herramientas de sección, plantillas reutilizables complejas y planos técnicos avanzados.

### 2.3 Exclusiones explícitas
* Escultura digital o modelado orgánico libre.
* Simulación física, análisis estructural o certificación de resistencia.
* Planos de fabricación CNC certificados (holguras, vetas, herrajes o despiece industrial en el MVP).
* Colaboración multiusuario en tiempo real o cuentas en la nube en el MVP.
* Funcionalidad de duplicar/clonar piezas o grupos y proyectos de ejemplo precargados en el MVP (la aplicación inicia en lienzo vacío).

---

## 3. Diseño de interfaz amigable (UX), objetos rápidos y formularios

### 3.1 Distribución limpia de pantalla
Para evitar la saturación habitual de los programas CAD, la pantalla se divide en áreas claras y respirables:

| Zona | Contenido principal | Propósito de usabilidad |
| :--- | :--- | :--- |
| **Barra superior** | *Nueva pieza*, *Nuevo grupo*, *Deshacer / Rehacer*, *Guardar / Abrir proyecto*, selector global de unidad (`mm / cm / m`) y botones con estado activo para *Vista inicial*, *Medidas* y *Accesorios*. | Poner las acciones frecuentes a un clic y mantener visible la unidad de medida activa y las capas en todo momento. |
| **Panel izquierdo (Árbol y Objetos rápidos)** | Pestaña o sección superior de **Objetos rápidos** (atajos visuales) y **Árbol jerárquico** de grupos, subpiezas y accesorios, con iconos para ocultar/mostrar y bloquear/desbloquear. | Permitir añadir piezas comunes al instante y entender de qué partes está compuesto el objeto. |
| **Área central (Escena 3D + Ficha resumen)** | Lienzo 3D a escala real con suelo y sombras suaves, cuadrícula, cotas exteriores con líneas guía, controles de cámara y una **tarjeta flotante compacta** con el resumen de medidas principales. | Brindar retroalimentación visual inmediata y lectura clara de dimensiones clave sin ruido visual. |
| **Panel derecho (Propiedades)** | Formulario contextual del elemento seleccionado: nombre, medidas principales, posición/rotación y selector de color o acabado. | Convertir la edición 3D en una ficha clara donde los números y la vista 3D siempre coinciden. |

### 3.2 Catálogo de Objetos rápidos (Atajos de inserción)
Permite a los usuarios sin experiencia empezar a construir sin tener que calcular proporciones desde cero:

| Categoría | Atajo rápido | Primitiva base | Medidas sugeridas por defecto (`cm`) |
| :--- | :--- | :--- | :--- |
| **Tableros y cajas** | Tablero / Cubierta | `box` | `120 × 2 × 60 cm` |
| **Tableros y cajas** | Caja / Cajón | `box` | `40 × 15 × 35 cm` |
| **Tableros y cajas** | Panel / Repisa / Faldón | `box` | `80 × 2 × 25 cm` |
| **Barras y soportes** | Barra / Tubo redondo | `cylinder` | `Ø 3 cm` diámetro × `100 cm` alto |
| **Barras y soportes** | Perfil / Barra rectangular | `box` | `4 × 4 × 100 cm` |
| **Barras y soportes** | Pata / Soporte estándar | `cylinder` | `Ø 5 cm` diámetro × `75 cm` alto |
| **Formas base** | Esfera | `sphere` | `20 cm` diámetro |
| **Formas base** | Superficie / Plano | `plane` | `100 × 100 cm` |

**Comportamiento de los objetos rápidos:**
* **Inserción en 1 clic:** Crea la pieza apoyada en el suelo (`Y = 0`) cerca del centro libre de la escena, le asigna un nombre correlativo claro (ej. *Tablero 1*, *Barra 2*), la selecciona y abre su formulario de propiedades.
* **Arrastrar a escena (*Drag-and-drop*):** Al arrastrar un atajo hacia el lienzo 3D, muestra una previsualización fantasma que sigue el cursor y se apoya sobre el suelo (`Y = 0`) o sobre caras superiores horizontales de piezas existentes.

### 3.3 Formularios de creación y edición por primitiva
Los formularios traducen los conceptos geométricos a lenguaje cotidiano y ocultan detalles técnicos (como segmentación de malla) bajo un desplegable opcional de *"Opciones avanzadas"*:

| Primitiva interna | Nombre visible en UI | Campos principales del formulario |
| :--- | :--- | :--- |
| `box` | **Caja / Tablero / Barra rectangular** | Ancho, Alto (o Espesor), Profundidad |
| `cylinder` | **Cilindro / Barra redonda / Tubo** | Diámetro (con opción a Radio), Alto |
| `sphere` | **Esfera** | Diámetro (con opción a Radio) |
| `plane` | **Superficie / Panel** | Ancho, Largo |

### 3.4 Reglas de interacción, visualización y ergonomía
* **Pivote en base inferior (`Y = 0`) y apoyo automático:** El origen local de toda primitiva se sitúa en el **centro de su base inferior (`Y = 0`, centrado en `X` y `Z`)**. Así, una pieza nueva en `position.y = 0` apoya automáticamente sobre el suelo y al modificar su *Alto* crece hacia arriba sin hundirse.
* **Cotas exteriores legibles:** Las cotas generales y de piezas seleccionadas se dibujan con líneas de extensión separadas del objeto, marcas de extremo y etiquetas tipo tarjeta que permanecen legibles sin quedar ocultas detrás de las piezas.
* **Entorno visual limpio:** El suelo receptor de sombras y la cuadrícula mantienen una separación vertical mínima para evitar parpadeos gráficos (*z-fighting*), y la cámara cuenta con límites seguros para no atravesar el suelo.
* **Comportamiento al escalar:** Usar el gizmo de *Escalar* sobre una primitiva modifica directamente sus parámetros dimensionales reales en el formulario y restablece la escala visual a `1`, respetando la naturaleza de cada forma: `box` escala en ancho/alto/profundidad, `cylinder` escala radialmente uniforme en `X/Z` y libre en `Y`, `sphere` escala de forma uniforme en los 3 ejes y `plane` escala en sus 2 ejes horizontales (`X/Z`). En grupos, el gizmo de *Escalar* permanece deshabilitado.
* **Edición de grupos:** Al seleccionar un grupo completo, el panel derecho permite editar su *Nombre*, *Posición* y *Rotación*, aplicar un material en lote a todas sus piezas hijas y consultar sus **medidas envolventes totales** (ancho, alto y profundidad del conjunto) en modo solo lectura.
* **Piezas bloqueadas (`locked`):** Una pieza bloqueada puede seleccionarse para consultar sus cotas, pero sus campos del formulario pasan a solo lectura y sus gizmos 3D se desactivan para prevenir movimientos accidentales.

### 3.5 Validaciones y mensajes al usuario
* **Errores bloqueantes (impiden aplicar el cambio):**
  * Medidas iguales o menores a cero (`≤ 0`).
  * Campos numéricos vacíos o con caracteres no válidos.
  * Nombre de pieza o proyecto vacío.
  * *Ejemplo de mensaje:* *"El ancho debe ser mayor que 0 cm para generar la pieza."*
* **Advertencias informativas (permiten continuar con aviso suave):**
  * Dimensiones extremadamente pequeñas o grandes respecto a la escala habitual (ej. `< 1 mm` o `> 50 m`).
  * Piezas dentro de un mismo grupo que quedan flotando sin contacto o superpuestas, evaluadas mediante una comprobación ligera por *Bounding Box* (AABB) con tolerancia y mostradas como aviso discreto en el panel derecho.

---

## 4. Flujos paso a paso de los casos de uso principales

### Caso de uso 1: Crear una pieza mediante Objeto rápido o formulario
* **Vía Objeto rápido (atajo):**
  1. El usuario elige un atajo del panel de **Objetos rápidos** (ej. *Tablero*, *Barra redonda* o *Caja*) y hace clic sobre él o lo arrastra a la escena 3D.
  2. El sistema inserta la pieza apoyada en el suelo con sus medidas sugeridas, le asigna un nombre correlativo y la selecciona automáticamente.
  3. Si desea ajustar medidas, las modifica directamente en el formulario de propiedades abierto a la derecha.
* **Vía formulario personalizado:**
  1. El usuario pulsa *"Nueva pieza"* y selecciona la forma base (*Caja / Tablero*, *Cilindro*, *Esfera* o *Plano*).
  2. Introduce sus medidas en la unidad activa (`mm`, `cm` o `m`) y un nombre opcional.
  3. El sistema valida los datos (bloqueando valores `≤ 0` con mensajes claros), convierte internamente a metros y renderiza la pieza apoyada en el suelo con sus cotas.

### Caso de uso 2: Editar dimensiones y ver cambios en tiempo real
* **Desde el panel de propiedades (precisión numérica):**
  1. El usuario selecciona una pieza en la escena 3D o en el árbol lateral.
  2. Modifica una medida en el formulario (por ejemplo, cambia el ancho de `180 cm` a `200 cm`).
  3. La pieza, sus cotas y la ficha resumen de medidas se actualizan de forma incremental sin recargar la escena ni mover la cámara.
* **Desde la escena 3D (manipulación directa):**
  1. El usuario elige la herramienta *Mover*, *Rotar* o *Escalar* y arrastra los controles sobre la pieza.
  2. Al soltar el control, los nuevos valores de posición, rotación o dimensiones reales se reflejan automáticamente en el panel de propiedades y en las cotas.

### Caso de uso 3: Componer un objeto agrupando piezas y capas de contexto (ej. escritorio)
1. **Crear partes base:** El usuario crea las piezas principales y estructurales mediante formularios u objetos rápidos (ej. cubierta principal, retorno, faldones de refuerzo, patas y módulos de cajones).
2. **Acomodar piezas:** Posiciona cada parte mediante coordenadas numéricas o arrastre en 3D guiándose por las cotas exteriores y la cuadrícula.
3. **Agrupar conjunto y accesorios:** Agrupa las piezas del mueble bajo un conjunto (ej. *"Escritorio"*) y, si lo desea, organiza elementos de contexto (ej. monitores, libros o decoración) en un subgrupo de *"Accesorios"* que puede ocultarse con un botón rápido.
4. **Editar conjunto o detalle:** Mover o rotar el grupo desplaza todas sus piezas juntas; para ajustar una sola pieza, el usuario la selecciona dentro del árbol o bloquea/oculta las demás para trabajar sin estorbos.

### Caso de uso 4: Cambiar material y apariencia visual
1. **Seleccionar pieza o grupo:** El usuario elige el elemento, subpieza (ej. cubierta principal o canto/borde) o grupo al que desea darle acabado.
2. **Elegir apariencia:** Selecciona un color o material predefinido (ej. *Roble natural*, *Blanco mate*, *Acero*) y ajusta controles sencillos de **rugosidad** y **metalicidad**.
3. **Aplicar sin alterar medidas:** El cambio visual se refleja de inmediato manteniendo intactas las dimensiones reales y la posición de cada pieza. Si se seleccionó un grupo, el material se propaga en lote a todas sus piezas hijas.

### Caso de uso 5: Guardar, reabrir y respaldar un proyecto
1. **Guardar en el navegador:** El usuario pulsa *"Guardar"*, indica nombre y descripción, y el sistema almacena localmente el proyecto en IndexedDB.
2. **Protección ante cambios sin guardar:** Si intenta abrir otro proyecto o cerrar la pestaña con cambios pendientes, la aplicación muestra un aviso de confirmación.
3. **Reabrir proyecto:** Al regresar en otra sesión, el usuario selecciona su proyecto del listado local y recupera todas sus piezas, grupos, capas, materiales, unidades y cotas.
4. **Respaldo portátil (JSON nativo):** El usuario puede descargar el archivo `.json` del proyecto para guardarlo como respaldo externo o cargarlo en otro equipo.

---

## 5. Estructura conceptual del formato nativo JSON (`schemaVersion: 1`)

Para garantizar la independencia respecto al motor gráfico y permitir la evolución hacia futuras versiones, todo proyecto se almacena bajo las siguientes reglas de datos:

* **Unidades internas y pivote:** Todas las longitudes se guardan siempre en **metros (`m`)** y las rotaciones en **radianes** (orden `XYZ`, sistema `Y-up`). La propiedad `transform.position` de cada primitiva referencia el **centro de su base inferior (`Y = 0`)**. La unidad elegida por el usuario (`displayUnit`) se guarda como preferencia de visualización.
* **Jerarquía plana por referencia y capas:** Las entidades (grupos y primitivas) se almacenan en una lista plana vinculadas mediante `parentId` e identificadores únicos estables (`id`), lo que simplifica las operaciones de agrupar, desagrupar, eliminar y *Deshacer / Rehacer*. Cada entidad incluye `layer: "main" | "accessories"`, controlado globalmente por `settings.showAccessories`.
* **Sin escala arbitraria en primitivas:** Las primitivas almacenan únicamente sus dimensiones geométricas reales y su `transform` (`position` y `rotation`), asegurando que nunca existan discrepancias entre el tamaño visual y las cotas:
  * `box`: `{ width, height, depth }`
  * `cylinder`: `{ radius, height, radialSegments? }` (en UI se presenta como *Diámetro* con opción a *Radio*)
  * `sphere`: `{ radius, widthSegments?, heightSegments? }` (en UI se presenta como *Diámetro* con opción a *Radio*)
  * `plane`: `{ width, depth }` (orientado horizontalmente sobre el plano `XZ` en `Y = 0`)
* **Extensibilidad:** El documento incluye la propiedad `schemaVersion` y secciones reservadas para parámetros globales y restricciones de la versión 2.

```json
{
  "schemaVersion": 1,
  "project": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Escritorio esquinero en L",
    "description": "Modelo a escala real con cubierta, faldón y cajonero",
    "displayUnit": "cm",
    "createdAt": "2026-11-21T06:00:00.000Z",
    "updatedAt": "2026-11-21T06:15:00.000Z"
  },
  "settings": {
    "showGrid": true,
    "showAxes": true,
    "showDimensions": true,
    "showSummaryCard": true,
    "showAccessories": true,
    "gridSpacing": 0.1
  },
  "materials": [
    {
      "id": "mat-oak-01",
      "name": "Roble natural",
      "color": "#c9a575",
      "roughness": 0.52,
      "metalness": 0.0
    },
    {
      "id": "mat-white-01",
      "name": "Estructura blanca",
      "color": "#f4f3ef",
      "roughness": 0.72,
      "metalness": 0.0
    }
  ],
  "entities": [
    {
      "id": "grp-desk-01",
      "type": "group",
      "name": "Escritorio en L",
      "parentId": null,
      "layer": "main",
      "visible": true,
      "locked": false,
      "transform": {
        "position": [0, 0, 0],
        "rotation": [0, 0, 0]
      }
    },
    {
      "id": "ent-top-01",
      "type": "box",
      "name": "Cubierta principal",
      "parentId": "grp-desk-01",
      "layer": "main",
      "visible": true,
      "locked": false,
      "materialId": "mat-oak-01",
      "transform": {
        "position": [0, 0.732, 0],
        "rotation": [0, 0, 0]
      },
      "geometry": {
        "width": 1.8,
        "height": 0.018,
        "depth": 0.6
      }
    },
    {
      "id": "ent-apron-01",
      "type": "box",
      "name": "Faldón frontal",
      "parentId": "grp-desk-01",
      "layer": "main",
      "visible": true,
      "locked": false,
      "materialId": "mat-oak-01",
      "transform": {
        "position": [0, 0.677, 0.285],
        "rotation": [0, 0, 0]
      },
      "geometry": {
        "width": 1.8,
        "height": 0.055,
        "depth": 0.035
      }
    }
  ],
  "parameters": [],
  "constraints": []
}
```

---

## 6. Decisiones técnicas de implementación (MVP)

* **Stack frontend:** **React + TypeScript + Vite + Zustand + Three.js encapsulado** (motor 3D imperativo desacoplado de React que sincroniza cambios incrementales desde el store y libera recursos WebGL con `dispose()`).
* **Estilos:** **CSS puro / CSS Modules**, manteniendo la estética limpia y cálida del prototipo de referencia.
* **Estado inicial:** La aplicación abre en un **lienzo vacío** sin proyecto de ejemplo precargado.
* **Operaciones de árbol en MVP:** Crear, renombrar, agrupar/desagrupar, ocultar/mostrar, bloquear/desbloquear, asignar a capa `accessories` y **eliminar** (reversible mediante *Deshacer / Rehacer*). La función de **duplicar** queda excluida del MVP.
