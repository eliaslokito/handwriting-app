# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Iniciar el servidor de desarrollo (escaneando QR con Expo Go)
npx expo start

# Limpiar caché de Metro y Babel antes de arrancar (obligatorio tras cambios en babel.config.js)
npx expo start --clear

# Arrancar directamente en emulador/dispositivo
npx expo start --android
npx expo start --ios

# Versión web (solo para pruebas de UI, no soporta Skia canvas)
npx expo start --web
```

Git configurado con remote `origin` → `https://github.com/eliaslokito/handwriting-app`  
Rama principal: `master`. Push directo: `git push`.  
No hay linter ni test runner configurados.

## Arquitectura

App **React Native + Expo SDK 56** sin backend — toda la lógica y los datos son locales.

### Flujo de navegación

```
App.js → AppProvider (contexto global)
           └── AppNavigator
                 ├── Onboarding  ← primer arranque (onboardingComplete === false)
                 └── Main        ← pantalla principal
                       ├── Preview   ← recibe { text, sheetFormat, fontSize } por route.params
                       └── Profile   ← gestión de la fuente de letra capturada
```

`AppNavigator` decide la ruta inicial leyendo `onboardingComplete` del contexto. `isLoading: true` muestra un spinner mientras se cargan los datos del disco.

### Estado global — `AppContext.js`

Patrón `useReducer` + `Context`. Estado:

```js
{
  strokes: { 'A': ['dataUrl1', ...], 'b': [...], ... }, // PNG base64 por carácter
  onboardingComplete: boolean,
  isLoading: boolean,
}
```

**Acciones del reducer:** `LOAD_DATA`, `ADD_STROKE`, `DELETE_STROKE`, `COMPLETE_ONBOARDING`, `RESET`.

Persistencia automática con la **nueva API de expo-file-system SDK 56**:
- Lectura: `await new File(Paths.document, 'handwriting_font.json').text()`
- Escritura: `new File(Paths.document, 'handwriting_font.json').write(json)` (síncrono)
- `readAsStringAsync` / `writeAsStringAsync` están **deprecados** en SDK 56 — no usarlos.

API pública: `addStroke(char, dataUrl)`, `deleteStroke(char, index)`, `completeOnboarding()`, `resetAll()`, `strokesFor(char)`, `capturedCount()`, `progress()`.

### Canvas de dibujo — `DrawingCanvas.js`

Componente `forwardRef` con dos modos: **Dibujo** y **Goma**.

**API expuesta por `ref`:**
- `clear()` — limpia todos los paths y fuerza re-render
- `toDataUrl()` → `Promise<string|null>` — exporta PNG base64 recortado al bounding box del trazo (crop con `makeImageSnapshot({x, y, width, height})` usando `path.getBounds()`)
- `hasStrokes()` → `boolean`

**Modo Dibujo:**
- `PanResponder` (no `onTouchStart/Move/End`) para compatibilidad con S Pen y Apple Pencil en tablet
- Durante el trazo activo (`onMove`): `redraw()` — repinta el canvas nativo sin re-render de React (rápido)
- Al levantar la pluma (`onRelease`): `forceRender()` via `useReducer dispatch` — dispara re-render de React para que `pathsRef.current.map()` se re-evalúe y el path aparezca en el árbol JSX de Skia
- Los paths se acumulan en `pathsRef.current` entre levantadas de pluma; `clear()` es lo único que los borra

**Por qué `forceRender` y no solo `redraw()`:**  
`redraw()` repinta el canvas nativo con el árbol de draw commands ya comprometido por React — no re-evalúa closures JSX. Sin `forceRender`, los paths completados no aparecen en `pathsRef.current.map()` y la pantalla queda vacía al levantar la pluma.

**Modo Goma:**
- Prop `isErasing: boolean` controla el modo
- Círculo semitransparente (`radius = 22px`) sigue el dedo mientras toca la pantalla
- En `onMove`: elimina de `pathsRef.current` todos los paths cuyo bounding box (expandido por `STROKE_WIDTH/2`) intersecta el círculo
- Detección de **botón lateral S Pen**: `e.nativeEvent.buttons === 2` en `onPanResponderGrant` → llama `onToggleEraser`
- **Apple Pencil doble toque**: requiere `UIPencilInteraction` nativo — no disponible en Expo Managed Workflow

**Props:** `width`, `height`, `isErasing`, `onStrokeEnd`, `onToggleEraser`

### Onboarding — `OnboardingScreen.js`

Captura guiada de los 88 caracteres organizados en **4 tabs de sección**:

| Tab | Chars | Offset en ALL_CHARS |
|-----|-------|---------------------|
| Mayúsculas | A-Z (26) | 0 |
| Minúsculas | a-z (26) | 26 |
| Números | 0-9 (10) | 52 |
| Puntuación | 24 símbolos | 62 |

`activeGroupIdx` se deriva de `currentIdx` (no es estado propio). Prev/Next navegan dentro del grupo activo. El scroll de la barra de caracteres se resetea al cambiar de tab.

Cada carácter acepta 1–3 variaciones (`MIN_VARIATIONS = 1`, `MAX_VARIATIONS = 3`). Los thumbnails guardados muestran el PNG recortado al bounding box (88×88px).

Toggle **Dibujar / Goma** como segmented control encima del canvas. Modo goma gestionado por `isErasing` state local; el S Pen lo alterna via `onToggleEraser`.

### Renderizador de apuntes — `PreviewScreen.js`

Recibe `{ text, sheetFormat, fontSize }` por `route.params`. Tokeniza el texto carácter a carácter en `buildRenderData()`:
1. Toma trazo aleatorio de `strokesFor(char)` (fallback a minúscula si no hay mayúscula)
2. Variación aleatoria: rotación ±2°, offset ±2px (para que no parezca robótico)
3. Wrapping automático de línea por ancho de pantalla

**Estado incompleto:** `CharacterToken` muestra el carácter como `<Text>` (fallback) en lugar de renderizar el PNG con Skia. `handleExport` referencia `MediaLibrary` sin importarlo.

### Constantes críticas

- `src/constants/theme.js` — **todos** los colores, tipografía, tamaños, espaciados, radios y bordes. **Nunca hardcodear valores de diseño.**
- `src/constants/characters.js` — define los 88 caracteres (`ALL_CHARS`), grupos (`CHARACTER_GROUPS`) y offsets. `MAX_VARIATIONS = 3`, `MIN_VARIATIONS = 1`.
- `GROUP_OFFSETS` se computa en `OnboardingScreen.js` a nivel de módulo (no exportado).

---

## Estado actual de cada pantalla

### OnboardingScreen — Funcional
- Tabs por sección (Mayúsculas / Minúsculas / Números / Puntuación)
- Canvas multi-trazo: levantar la pluma y seguir dibujando hasta "Guardar trazo"
- Bounding box crop automático al guardar cada trazo
- Thumbnails grandes (88×88) con PNG recortado
- Goma de borrar con cursor visual + detección de botón S Pen
- `writeAsStringAsync` deprecation: resuelto con nueva API `File`

### MainScreen — Funcional
- Área de texto + selector de formato (rayada/cuadriculada/en blanco) + tamaño de letra
- Navega a Preview pasando parámetros por `route.params`

### PreviewScreen — Parcialmente funcional (MVP)
- Tokenización y layout del texto: funciona
- Renderizado de trazos: usa `<Text>` como fallback — **pendiente Skia**
- Exportación PNG/JPG/PDF: botones presentes pero sin implementación real — **pendiente**

### ProfileScreen — Funcional
- Resumen de caracteres capturados con barras de progreso
- Botón de reset que vuelve al Onboarding

---

## Problemas resueltos en esta sesión

| Problema | Solución |
|----------|----------|
| `babel.config.js` vacío → error de Babel/Flow | Configurado con `babel-preset-expo` + plugin de Reanimated |
| `babel-preset-expo` no instalado | `npm install babel-preset-expo` |
| Lista de 86 chars en Onboarding inutilizable | Reemplazada por 4 tabs de sección |
| Thumbnails tiny (canvas completo shrinkado) | `makeImageSnapshot(rect)` con bounding box de `path.getBounds()` |
| Multi-trazo no funciona en tablet | `PanResponder` en vez de `onTouchStart/Move/End` + `forceRender` al levantar la pluma |
| `redraw()` no actualiza paths completados | `useReducer dispatch` (forceRender) obliga re-render de React tras cada stroke |
| `writeAsStringAsync` / `readAsStringAsync` deprecated | Migrado a `new File(Paths.document, name).text()` / `.write()` |
| Warning `InteractionManager` deprecated (React Navigation) | `LogBox.ignoreLogs(['InteractionManager'])` en App.js |
| `cropStroke.js` usa `document.createElement` (API DOM) | Crop integrado directamente en `DrawingCanvas.toDataUrl()` con Skia |
| Sin goma de borrar | Implementada con círculo cursor + hit test por bounding box + toggle S Pen |

---

## Pendientes

1. **PreviewScreen — Renderizado real de trazos**  
   `CharacterToken` debe renderizar el `dataUrl` como `<SkiaImage>` en lugar del `<Text>` de fallback. Hay que cargar el PNG base64 como imagen Skia y escalarlo al tamaño del carácter con rotación.

2. **PreviewScreen — Exportación real**  
   Importar `expo-media-library`, envolver la hoja en `<ViewShot ref>` de `react-native-view-shot`, y guardar en galería. PDF requiere librería adicional (ej. `react-native-pdf-lib` o generación en base a canvas Skia).

3. **Fuentes Instrument**  
   Cargar `InstrumentSerif-Regular/Italic` e `InstrumentSans-Regular/Medium` con `expo-font`. Los tokens ya están en `theme.js` (`typography.serif`, `typography.sansMedium`, etc.) pero las fuentes no se cargan en runtime.

4. **Apple Pencil doble toque**  
   Requiere `UIPencilInteraction` nativo (iOS). No disponible en Expo Managed Workflow. Opciones: (a) `expo-modules` custom native module, (b) migrar a Expo Bare Workflow.

5. **Goma de precisión**  
   El hit test actual usa el bounding box del path (aproximación). Para borrar con precisión de pixel — especialmente en paths largos o diagonales donde el bbox es mucho mayor que el trazo — habría que muestrear puntos del path o usar `Path.op(Intersect)` con el círculo de la goma.

6. **`cropStroke.js`**  
   El archivo existe pero usa API DOM (`document.createElement`). No se usa en ningún lado — puede eliminarse o reescribirse si se necesita crop fuera del canvas.

---

## Reglas de código

- Todos los valores de diseño vienen de `src/constants/theme.js` (`colors`, `spacing`, `fontSizes`, `radius`, `borderWidth`).
- Los estilos siempre en `StyleSheet.create()` al final del archivo.
- Solo `console.warn` para errores esperados; no `console.log` en código de producción.
- Todo el código debe ser limpio y comentado en español: cada función y componente debe tener un comentario corto explicando qué hace.
- Después de cada tarea completada, hacer un commit con mensaje descriptivo en español (ej: `feat: agregar crop automático a thumbnails de trazos`).
