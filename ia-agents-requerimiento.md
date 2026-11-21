# Especificación de Requerimientos — Módulo de Agente de IA (APP-RENDER-CHEPITA)

**Módulo:** Asistente Inteligente Conversacional  
**Versión:** 1.1  
**Fase recomendada:** Versión 2 (Extensión sobre el núcleo paramétrico MVP)  
**Principio rector:** Agnóstico de proveedor (adaptador **Google Gemini** en v1), desacoplado del motor 3D y gobernado por el modelo de dominio  

---

## 1. Propósito y alcance del módulo

El **Módulo de Agente de IA** potencia la accesibilidad de **APP-RENDER-CHEPITA**, permitiendo que personas sin conocimientos de modelado 3D puedan generar, modificar, organizar y editar objetos tridimensionales a escala real mediante **indicaciones en lenguaje natural** desde un chat integrado.

Para preservar el carácter *local-first* y extensible de la aplicación:
* La arquitectura se diseña alrededor de una interfaz agnóstica (`AIProviderAdapter`), implementando en esta primera versión únicamente el adaptador nativo para **Google Gemini**.
* Todo cambio propuesto por el asistente pasa por un **plan revisable con confirmación explícita ("Aplicar")**, validado estrictamente contra el modelo de dominio y reversible en un solo paso con **Deshacer**.
* La lectura de bocetos a mano (entrada multimodal de imágenes) y los adaptadores para otros proveedores quedan registrados como **alcance diferido** para una iteración posterior.

---

## 2. Requisitos funcionales

### RF-IA-01. Configuración del proveedor y modelo de IA (Prerrequisito)
Antes de habilitar las solicitudes en el chat del asistente, la aplicación debe ofrecer un modal de **Configuración de IA** accesible desde el propio panel del asistente:

* **Arquitectura extensible con adaptador Google Gemini (v1):** Implementar el conector nativo para **Google Gemini** detrás de una interfaz común (`AIProviderAdapter`) preparada para sumar otros proveedores (OpenAI-compatible, Anthropic, Ollama/LM Studio) en futuras versiones sin alterar el dominio ni la UI.
* **Parámetros configurables por el usuario:**
  * Clave de API (`API Key`) de Gemini.
  * Selector o campo editable del identificador del modelo activo (ej. `gemini-2.5-flash`, `gemini-2.5-pro` u otro modelo compatible).
  * URL base opcional (`Base URL`, con valor por defecto oficial de Gemini).
  * Opción explícita de persistencia: checkbox **"Guardar solo en esta sesión"** (`sessionStorage`).
* **Prueba de conexión ("Probar modelo"):** Botón de verificación rápida que comprueba credenciales, disponibilidad del endpoint y capacidad de respuesta estructurada antes de activar el chat, informando con mensajes claros en lenguaje sencillo si ocurre un fallo (clave inválida, sin red, cuota excedida o modelo no disponible).
* **Almacenamiento local privado:** Las credenciales y ajustes de IA se almacenan exclusivamente en el almacenamiento aislado del navegador (`localStorage` / `IndexedDB` dedicado, o `sessionStorage` si el usuario marca solo esta sesión), con opción para editar o borrar la clave en cualquier momento, y **nunca se incluyen en el archivo `.chepita.json` del proyecto**.

### RF-IA-02. Agente de IA conversacional con plan confirmado
Una vez configurado y validado el modelo de Gemini, el usuario dispondrá de un panel de chat integrado para operar sobre la escena mediante lenguaje natural:

* **Ubicación en la interfaz (UX):**
  * Un botón **"Asistente IA"** en la `TopBar` abre y cierra un **drawer lateral derecho** deslizable.
  * Dentro de la cabecera del drawer existirá un botón de engranaje para abrir directamente el modal de **Configuración de IA** (y un indicador visual del estado de conexión/modelo activo).
* **Plan previo y confirmación obligatoria ("Aplicar"):**
  * Ante cada solicitud del usuario, el agente **no modifica la escena automáticamente**; en su lugar, muestra en el chat un **plan/resumen legible** de los cambios propuestos (piezas a crear, medidas, materiales, agrupaciones, ediciones o eliminaciones) junto a un botón **"Aplicar"**.
  * El usuario decide si aplica el plan a la escena 3D o si reformula la solicitud.
* **Catálogo completo de comandos de dominio:** El agente **no** generará código Three.js ni mallas sueltas; traducirá cada intención a comandos estructurados de dominio respetando la unidad interna en **metros**, rotaciones en **radianes (`XYZ`)** y el pivote en base inferior (**`Y = 0`**):
  * Crear primitivas (`box`, `cylinder`, `sphere`, `plane`), grupos y objetos rápidos.
  * Editar dimensiones geométricas, posición, rotación, nombre y capa (`main` | `accessories`).
  * Asignar materiales del catálogo o personalizar color, rugosidad y metalicidad.
  * Agrupar, desagrupar y reparentar entidades.
  * Duplicar y eliminar entidades/grupos.
  * Soporte de identificadores temporales (`tempId`) para referenciar piezas o grupos creados dentro del mismo plan.
* **Validación estricta y fallo inmediato (sin reintentos automáticos):**
  * Todo plan generado se valida contra las reglas del dominio (`src/domain/validation.ts`: medidas mayores a cero, referencias válidas, ciclos de jerarquía, entidades bloqueadas) antes de habilitar **"Aplicar"**.
  * Si el modelo devuelve un JSON inválido, referencias inexistentes o parámetros inválidos, el sistema **falla de inmediato sin reintentos automáticos** y muestra un mensaje claro en lenguaje sencillo para que el usuario reformule su petición.
* **Transacción atómica y reversibilidad (`Undo / Redo`):**
  * Al pulsar **"Aplicar"**, todos los comandos del plan se ejecutan como una **única transacción atómica** en el store (`beginTransaction` / `commitTransaction`, con `cancelTransaction` ante cualquier fallo).
  * Toda la intervención del asistente queda registrada como un único paso en el historial, permitiendo revertirla por completo con un clic en **Deshacer**.

### RF-IA-03. Persistencia del historial de chat en el proyecto
El historial de conversación del asistente forma parte del contexto de diseño del proyecto:

* **Almacenamiento en `.chepita.json`:** El historial de chat se guarda dentro del documento del proyecto mediante un campo opcional retrocompatible con `schemaVersion: 1` (ej. `aiChatHistory`), de modo que los archivos exportados previos sigan importándose sin errores.
* **Nivel de detalle persistido:** Por cada mensaje se almacena rol (`user` / `assistant`), texto, timestamp, resumen del plan propuesto y estado del plan (`pendiente` / `aplicado` / `error`).
* **Exclusión estricta de secretos:** En ningún caso se guardan `API Key`, cabeceras de autenticación ni configuración privada del proveedor dentro de `aiChatHistory` ni del `.chepita.json`.
* **Estado de cambios sin guardar (`isDirty`):** Añadir mensajes al historial o aplicar un plan marca el proyecto con cambios sin guardar (`isDirty`).

---

## 3. Alcance diferido (Futuras iteraciones)

Las siguientes capacidades quedan explícitamente **fuera de esta versión** y se abordarán en una iteración posterior:
* **Lectura de bocetos a mano (multimodal / visión):** Carga de fotografías o imágenes de bocetos dibujados a mano, extracción de cotas manuscritas y declaración de supuestos inferidos.
* **Adaptadores de otros proveedores:** Conectores para OpenAI-compatible (OpenAI, Groq, OpenRouter, Ollama, LM Studio) y Anthropic.

---

## 4. Requisitos no funcionales

### RNF-IA-01. Desacoplamiento arquitectónico (`src/ai/` y `AIProviderAdapter`)
* La comunicación HTTP con Gemini, el formateo de prompts, el parseo de respuestas estructuradas y el ejecutor de comandos residirán en un módulo dedicado (`src/ai/`), exponiendo la interfaz `AIProviderAdapter`.
* `src/domain/` permanecerá 100 % libre de dependencias de red, React y Three.js.
* `src/engine/` no recibirá lógica específica de IA; reaccionará de forma normal a las mutaciones del store de Zustand.
* Agregar nuevos proveedores en el futuro no requerirá modificar el modelo de dominio, los formularios ni el adaptador de Three.js.

### RNF-IA-02. Disponibilidad opcional (sin bloquear el modo offline)
* Si el usuario no configura ninguna `API Key` o trabaja sin conexión a internet, el editor 3D manual (formularios, objetos rápidos, gizmos, cotas y persistencia local) seguirá funcionando al 100 % sin restricciones.

### RNF-IA-03. Privacidad y consentimiento explícito
* El contexto resumido del proyecto actual (entidades, jerarquía, medidas, posición/rotación, entidad seleccionada, unidad activa y catálogo de materiales) solo se enviará al endpoint de Gemini cuando el usuario envíe explícitamente un mensaje en el chat.

---

## 5. Flujo de usuario paso a paso

1. **Acceso y configuración:** El usuario pulsa **"Asistente IA"** en la `TopBar` para abrir el drawer lateral derecho, abre el engranaje de **Configuración de IA**, introduce su `API Key` de Gemini y modelo, decide si guardarla en el navegador o solo en la sesión actual, y pulsa **"Probar modelo"** hasta confirmar conexión válida.
2. **Solicitud por texto:** Escribe una indicación en el chat (ej. *"crea una mesa de 140 × 70 × 75 cm con cubierta de roble y 4 patas metálicas agrupadas como Base"*).
3. **Validación y propuesta de plan:** El sistema interpreta la solicitud mediante Gemini, valida los comandos contra el dominio y muestra en el chat un resumen claro del plan propuesto con el botón **"Aplicar"** (o un error claro sin reintentos si la respuesta fue inválida).
4. **Aplicación atómica y ajuste manual:** El usuario pulsa **"Aplicar"** para construir o modificar la escena en una única transacción; luego puede refinar cualquier pieza con formularios/gizmos o revertir toda la operación con un clic en **Deshacer**.
5. **Guardado portátil:** Al guardar o exportar el proyecto (`.chepita.json`), el historial del chat se conserva junto al modelo 3D sin exponer ninguna credencial.

---

## 6. Criterios de aceptación

1. **Configuración segura de Gemini:** El usuario puede configurar su `API Key` y modelo de Gemini, probar la conexión, elegir persistencia normal o solo por sesión y borrar las credenciales en cualquier momento; las claves nunca aparecen en el `.chepita.json` exportado.
2. **Plan confirmado antes de mutar:** Toda solicitud válida en el chat muestra primero un resumen del plan propuesto con botón **"Aplicar"** sin alterar la escena hasta recibir confirmación del usuario.
3. **Construcción y edición contextual completa:** Al aplicar un plan, el sistema ejecuta creación, edición, agrupación, materiales, duplicado o eliminación respetando medidas en metros y apoyo en `Y = 0`, registrando todo el lote como una sola acción reversible con **Deshacer**.
4. **Validación estricta sin reintentos ocultos:** Si el modelo devuelve un JSON malformado, referencias inválidas o medidas `<= 0`, el sistema informa de inmediato en lenguaje sencillo sin aplicar cambios parciales ni bloquear el editor manual.
5. **Persistencia del chat retrocompatible:** Al guardar/exportar y volver a abrir un proyecto `.chepita.json`, se recupera el historial de mensajes y el estado de sus planes sin romper la carga de archivos `schemaVersion: 1` anteriores sin historial.
