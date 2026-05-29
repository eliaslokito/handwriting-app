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
  strokes: { 'A': [stroke, ...], 'b': [...], ... }, // array de strokes por carácter
  onboardingComplete: boolean,
  isLoading: boolean,
}
```

**Formato de stroke (formato actual — vectorial):**
```js
{
  dataUrl: string,           // PNG base64 recortado al bbox (thumbnail)
  paths: [
    { pts: [[x, y], ...], w: number }  // puntos crudos + grosor
  ],
  bbox: { x, y, w, h }      // bounding box del trazo en coords del canvas
}
```

**Retrocompatibilidad:** strokes viejos pueden ser:
- `string` — solo dataUrl PNG (formato original, sin vector)
- `{ dataUrl, paths: [{svg, sw}] }` — formato intermedio con SVG strings

Los helpers `getStrokeDataUrl(stroke)` y `getStrokePaths(stroke)` en `OnboardingScreen.js` manejan todos los formatos. `loadPaths()` en `DrawingCanvas` detecta `{pts,w}` vs `{svg,sw}` automáticamente.

**Acciones del reducer:** `LOAD_DATA`, `ADD_STROKE`, `DELETE_STROKE`, `REPLACE_STROKE`, `COMPLETE_ONBOARDING`, `RESET`.

Persistencia automática con la **nueva API de expo-file-system SDK 56**:
- Lectura: `await new File(Paths.document, 'handwriting_font.json').text()`
- Escritura: `new File(Paths.document, 'handwriting_font.json').write(json)` (síncrono)
- `readAsStringAsync` / `writeAsStringAsync` están **deprecados** en SDK 56 — no usarlos.

API pública: `addStroke(char, stroke)`, `deleteStroke(char, index)`, `replaceStroke(char, index, stroke)`, `completeOnboarding()`, `resetAll()`, `strokesFor(char)`, `capturedCount()`, `progress()`.

### Canvas de dibujo — `DrawingCanvas.js`

Componente `forwardRef` con dos modos: **Dibujo** y **Goma**.

**Estructura interna de paths:**
```js
pathsRef.current = [{ path: SkiaPath, sw: number, pts: [[x,y], ...] }, ...]
```
- `path` — objeto Skia para renderizado en tiempo real
- `sw` — grosor del trazo (cada path conserva el suyo independientemente)
- `pts` — puntos crudos redondeados a 1 decimal para serialización vectorial

**API expuesta por `ref`:**
- `clear()` — limpia todos los paths, `currentPts` y fuerza re-render
- `toDataUrl()` → `Promise<string|null>` — PNG base64 recortado al bounding box
- `hasStrokes()` → `boolean`
- `getPaths()` → `{ paths: [{pts, w}], bbox: {x,y,w,h} | null }` — serializa paths actuales al formato vectorial con bbox calculado desde puntos
- `loadPaths(pathsData)` → `void` — carga paths serializados; acepta `{pts,w}` (nuevo) y `{svg,sw}` (legado)

**Función pura `computeBbox(pathItems)`** — calcula bbox expandido por `sw/2` para que incluya el grosor del trazo.

**Modo Dibujo:**
- `PanResponder` (no `onTouchStart/Move/End`) para compatibilidad con S Pen y Apple Pencil
- `onGrant`: crea Skia Path, inicializa `currentPts`, llama `forceRender()` para meter `<Path>` en el árbol de Skia **antes** del primer `redraw()` — sin esto el trazo no aparece en tiempo real
- `onMove`: `lineTo(x,y)` + push a `currentPts` + `redraw()` (sin re-render, rápido)
- `onRelease`: sella el path en `pathsRef` con `{path, sw, pts}`, llama `forceRender()`

**Modo Goma:**
- Círculo semitransparente (`eraserRadius` px) sigue el dedo
- `pathHitTest()` expande el bbox de cada path por `sw/2` para hit testing
- Detección de **botón lateral S Pen**: `e.nativeEvent.buttons === 2` → llama `onToggleEraser`

**Props:** `width`, `height`, `isErasing`, `onStrokeEnd`, `onToggleEraser`, `strokeWidth`, `eraserRadius`

### Slider de grosor — `SizeSlider.js`

Componente slider vertical (PanResponder delta-based). Drag hacia arriba = más grosor.

- **Props:** `value`, `min`, `max`, `onValueChange`, `label`, `isEraser`
- **Lápiz:** rango 1–12px, preview = círculo relleno escalado
- **Goma:** rango 3–40px, preview = círculo con borde (como el cursor de la goma)
- Lápiz y goma tienen sliders completamente independientes — cambiar uno no afecta al otro

### Onboarding — `OnboardingScreen.js`

Captura guiada de los 88 caracteres organizados en **4 tabs de sección**:

| Tab | Chars | Offset en ALL_CHARS |
|-----|-------|---------------------|
| Mayúsculas | A-Z (26) | 0 |
| Minúsculas | a-z (26) | 26 |
| Números | 0-9 (10) | 52 |
| Puntuación | 24 símbolos | 62 |

**Tabs con indicador animado:** `Animated.spring(translateX)` con un `Animated.View position:absolute` que se desliza detrás de los botones de tab. El indicador se posiciona en `onLayout` sin animación para evitar deslizamiento inicial.

**Herramientas (íconos ✏ y ○):**
- Primer toque en ícono inactivo → selecciona herramienta, cierra slider
- Segundo toque en ícono activo → despliega su slider con `Animated.timing` (220 ms apertura, 170 ms cierre)
- Solo un slider visible a la vez (`sliderFor: 'pen' | 'eraser' | null`)
- S Pen botón lateral detectado en `DrawingCanvas` → llama `onToggleEraser` → cierra slider

**Selección de trazos guardados:**
- `selectedStrokeIdx` controla selección exclusiva (un trazo a la vez)
- Al tocar un thumbnail → `canvasRef.current.loadPaths(getStrokePaths(stroke))` restaura los paths Skia exactos para edición con goma
- `StrokeThumbnail` es completamente controlado por el padre (`isSelected`, `onPress`, `onDelete`)
- Al guardar en modo edición → `replaceStroke()` reemplaza el slot con el nuevo trazo

**Navegación:** flechas ‹ › pegadas a los lados del carácter de referencia (charNav con `justifyContent: center`, charDisplay sin `flex:1`).

**Guardar trazo:**
```js
const dataUrl = await canvasRef.current.toDataUrl();       // PNG thumbnail
const { paths, bbox } = canvasRef.current.getPaths();      // datos vectoriales
addStroke(char, { dataUrl, paths, bbox });                 // persiste en AppContext
```

Cada carácter acepta 1–3 variaciones (`MIN_VARIATIONS = 1`, `MAX_VARIATIONS = 3`).

### Renderizador de apuntes — `PreviewScreen.js`

Recibe `{ text, sheetFormat, fontSize }` por `route.params`. Tokeniza el texto carácter a carácter en `buildRenderData()` y lo renderiza vectorialmente con Skia.

**`catmullRomToSkia(pts)`** — convierte puntos crudos `[[x,y],...]` a SkiaPath con curvas cúbicas suavizadas (interpolación Catmull-Rom). Para cada segmento `i→i+1` deriva los handles bezier de los puntos vecinos `p[i-1]` y `p[i+2]`; usa puntos fantasma reflejados en los extremos.

**`computeTransform(bbox, size)`** — mapea el bbox del trazo original al cuadrado de `size` px:
- Escala uniforme (aspect-ratio preservado) con margen visual del 15%
- Alinea el contenido al 10% desde el top para respetar baseline y descendentes

**`CharacterToken`** — renderizado por carácter:
1. Sin trazo capturado → `<Text>` semitransparente
2. Trazo con `pts` válidos y `bbox` → `<Canvas><Group transform><Path>` con Catmull-Rom
3. Trazo sin vector (datos legados) → `<Text>` semitransparente
- `useMemo` en `skPaths` para no reconstruir los paths Skia en cada render

**Nota sobre escala de strokeWidth:** Con `<Group transform>`, el `strokeWidth` se escala proporcionalmente con el carácter. Un trazo de 2.5px a escala ~0.1 queda en ~0.25px — muy fino. Monitorear y ajustar `computeTransform` (factor `0.85`) si los trazos quedan invisibles en tamaños pequeños.

**Exportación PNG/JPG/PDF:** botones presentes pero sin implementación real — **pendiente**.

### Constantes críticas

- `src/constants/theme.js` — **todos** los colores, tipografía, tamaños, espaciados, radios y bordes. **Nunca hardcodear valores de diseño.**
- `src/constants/characters.js` — define los 88 caracteres (`ALL_CHARS`), grupos (`CHARACTER_GROUPS`) y offsets. `MAX_VARIATIONS = 3`, `MIN_VARIATIONS = 1`.
- `GROUP_OFFSETS` se computa en `OnboardingScreen.js` a nivel de módulo (no exportado).

---

## Estado actual de cada pantalla

### OnboardingScreen — Funcional
- Tabs con indicador deslizante animado (spring)
- Íconos ✏ / ○ para lápiz y goma; sliders verticales independientes que se despliegan con animación al segundo toque
- Flechas ‹ › pegadas al carácter de referencia
- Canvas multi-trazo: levantar la pluma y seguir dibujando hasta "Guardar trazo"
- Trazo en tiempo real (forceRender en onGrant para meter el path en el árbol de Skia)
- Selección de trazo guardado: carga los paths Skia exactos para edición con goma
- Bounding box crop automático al guardar cada trazo
- Formato vectorial con bbox — listo para renderizado escalable en Preview
- Goma de borrar con cursor visual + detección de botón S Pen
- Botón "Continuar →" fijo en esquina inferior derecha

### MainScreen — Funcional
- Área de texto + selector de formato (rayada/cuadriculada/en blanco) + tamaño de letra
- Navega a Preview pasando parámetros por `route.params`

### PreviewScreen — Funcional (renderizado vectorial implementado)
- Tokenización y layout del texto: funciona
- Renderizado de trazos: `CharacterToken` usa `<Canvas><Group><Path>` con suavizado Catmull-Rom
- Escala y posicionamiento desde bbox almacenado en el stroke
- Fallback de texto para strokes sin datos vectoriales (datos legados)
- Exportación PNG/JPG/PDF: botones presentes pero sin implementación real — **pendiente**

### ProfileScreen — Funcional
- Resumen de caracteres capturados con barras de progreso
- Botón de reset que vuelve al Onboarding

---

## Problemas resueltos

| Problema | Solución |
|----------|----------|
| `babel.config.js` vacío → error de Babel/Flow | Configurado con `babel-preset-expo` + plugin de Reanimated |
| Lista de 86 chars en Onboarding inutilizable | Reemplazada por 4 tabs de sección |
| Thumbnails tiny | `makeImageSnapshot(rect)` con bounding box de `path.getBounds()` |
| Multi-trazo no funciona en tablet | `PanResponder` + `forceRender` al levantar la pluma |
| `redraw()` no actualiza paths completados | `useReducer dispatch` (forceRender) obliga re-render de React |
| Trazo no aparece en tiempo real | `forceRenderRef.current()` en `onPanResponderGrant` modo dibujo para meter `<Path>` en árbol Skia antes del primer `redraw()` |
| `writeAsStringAsync` / `readAsStringAsync` deprecated | Migrado a `new File(Paths.document, name).text()` / `.write()` |
| Warning `InteractionManager` deprecated | `LogBox.ignoreLogs(['InteractionManager'])` en App.js |
| `cropStroke.js` usa API DOM | Crop integrado directamente en `DrawingCanvas.toDataUrl()` con Skia |
| Sin goma de borrar | Implementada con círculo cursor + hit test por bounding box |
| Cambiar grosor modifica trazos existentes | `pathsRef` almacena `sw` por path; cada trazo conserva su grosor al guardarse |
| Selección de trazo para edición borraba el canvas | `loadPaths()` restaura Skia paths exactos desde puntos serializados |
| PreviewScreen solo mostraba fallback de texto | `CharacterToken` implementado con `catmullRomToSkia` + `computeTransform` + Skia `<Group>` |
| Tabs cambiaban de golpe | Indicador `Animated.spring` con `translateX` + `useNativeDriver: true` |

---

## Pendientes

1. **PreviewScreen — Exportación real**  
   Importar `expo-media-library`, envolver la hoja en `<ViewShot ref>` de `react-native-view-shot`, y guardar en galería. PDF requiere librería adicional.

2. **Fuentes Instrument**  
   Cargar `InstrumentSerif-Regular/Italic` e `InstrumentSans-Regular/Medium` con `expo-font`. Los tokens ya están en `theme.js` pero las fuentes no se cargan en runtime.

3. **Ajuste visual de strokeWidth en Preview**  
   Con `<Group transform>` el strokeWidth se escala junto con el carácter. A tamaños pequeños (28px) los trazos pueden quedar muy finos. Evaluar empíricamente y ajustar el factor `0.85` en `computeTransform` o aplicar `Math.max(0.5, sw)` al strokeWidth.

4. **Presión táctil**  
   El formato vectorial ya permite `[x, y, p]` como tercer elemento. Capturar `e.nativeEvent.force` (iOS) y `e.nativeEvent.pressure` (Android/S Pen) en `DrawingCanvas` y persistir cuando > 0. Usar para variar el strokeWidth en `catmullRomToSkia`.

5. **Apple Pencil doble toque**  
   Requiere `UIPencilInteraction` nativo (iOS). No disponible en Expo Managed Workflow sin módulo nativo custom.

6. **Goma de precisión**  
   El hit test actual usa el bounding box del path (aproximación). Para borrar con precisión habría que muestrear puntos del path o usar `Path.op(Intersect)` con el círculo de la goma.

7. **Eliminar `cropStroke.js`**  
   El archivo existe en `src/utils/` pero usa API DOM (`document.createElement`) y no se usa en ningún lado.

8. **Migración de datos legados**  
   Strokes guardados antes de la migración vectorial tienen `{dataUrl, paths: [{svg,sw}]}` o solo string. En Preview caen al fallback de texto. Los usuarios necesitarán re-capturar sus trazos para beneficiarse del renderizado vectorial.

---

## Reglas de código

- Todos los valores de diseño vienen de `src/constants/theme.js` (`colors`, `spacing`, `fontSizes`, `radius`, `borderWidth`).
- Los estilos siempre en `StyleSheet.create()` al final del archivo.
- Solo `console.warn` para errores esperados; no `console.log` en código de producción.
- Todo el código debe ser limpio y comentado en español: cada función y componente debe tener un comentario corto explicando qué hace.
- Después de cada tarea completada, hacer un commit con mensaje descriptivo en español (ej: `feat: agregar crop automático a thumbnails de trazos`).
