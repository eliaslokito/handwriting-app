# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Iniciar el servidor de desarrollo (escaneando QR con Expo Go)
npx expo start

# Arrancar directamente en emulador/dispositivo
npx expo start --android
npx expo start --ios

# Versión web (solo para pruebas de UI, no soporta Skia canvas)
npx expo start --web
```

No hay linter ni test runner configurados aún.

## Arquitectura

Esta es una app **React Native + Expo** con toda la lógica en local (sin backend).

### Flujo de navegación

```
App.js → AppProvider (contexto global)
           └── AppNavigator
                 ├── Onboarding  ← primer arranque (onboardingComplete === false)
                 └── Main        ← pantalla principal
                       ├── Preview   ← recibe { text, sheetFormat, fontSize } por route.params
                       └── Profile   ← gestión de la fuente de letra capturada
```

La decisión de ruta inicial la toma `AppNavigator` leyendo `onboardingComplete` del contexto.

### Estado global — `AppContext.js`

Patrón `useReducer` + `Context`. El estado es:

```js
{
  strokes: { 'A': ['dataUrl1', ...], 'b': [...], ... }, // PNG en base64 por carácter
  onboardingComplete: boolean,
  isLoading: boolean,
}
```

**Acciones del reducer:** `LOAD_DATA`, `ADD_STROKE`, `DELETE_STROKE`, `COMPLETE_ONBOARDING`, `RESET`.

La persistencia es automática: se carga de disco al montar (`expo-file-system`, `handwriting_font.json` en `documentDirectory`), y se guarda cada vez que cambian `strokes` u `onboardingComplete`.

API pública del contexto: `addStroke(char, dataUrl)`, `deleteStroke(char, index)`, `completeOnboarding()`, `resetAll()`, `strokesFor(char)`, `capturedCount()`, `progress()`.

### Canvas de dibujo — `DrawingCanvas.js`

Componente con `forwardRef`. Expone tres métodos por `ref`:
- `clear()` — limpia el canvas
- `toDataUrl()` → `Promise<string>` — exporta PNG en base64 via `makeImageSnapshot()`
- `hasStrokes()` → `boolean`

Los trazos se capturan con handlers táctiles nativos (`onTouchStart/Move/End`) que construyen un `Skia.Path`. Al levantar el lápiz llama `onStrokeEnd(dataUrl)` al padre.

### Renderizador de apuntes — `PreviewScreen.js`

Recibe el texto y lo tokeniza carácter a carácter en `buildRenderData()`. Para cada carácter:
1. Toma un trazo aleatorio de `strokesFor(char)` (o fallback a minúscula si no hay mayúscula)
2. Aplica variación aleatoria: rotación ±2°, offset ±2px
3. Coloca el token en posición absoluta (x, y) con wrapping automático de línea

**Estado incompleto:** `CharacterToken` muestra el carácter como `<Text>` en lugar de renderizar el PNG del trazo con Skia. `handleExport` usa `MediaLibrary` sin importarlo.

### Constantes críticas

- `src/constants/theme.js` — **todos** los colores, tipografía, tamaños, espaciados y radios. Nunca hardcodear valores de diseño.
- `src/constants/characters.js` — define los 88 caracteres (`ALL_CHARS`), agrupados en `CHARACTER_GROUPS`. `MAX_VARIATIONS = 3`, `MIN_VARIATIONS = 1`.

### Utilidad pendiente de integrar — `cropStroke.js`

Usa `document.createElement('canvas')` (API web). No funciona en React Native nativo — necesita reescribirse usando Skia o una librería compatible con RN antes de poder usarse en producción.

## Pendientes conocidos

1. **`cropStroke.js`** usa API DOM — reescribir con Skia para que funcione en nativo.
2. **`CharacterToken` en PreviewScreen** — renderizar el `dataUrl` PNG como `SkiaImage` en lugar del `<Text>` de fallback.
3. **Exportación real** — importar `expo-media-library` en PreviewScreen e implementar el guardado PNG/JPG; PDF requiere una librería adicional.
4. **Fuentes** — cargar `InstrumentSerif-Regular/Italic` e `InstrumentSans-Regular/Medium` con `expo-font` (los tokens en `theme.js` ya están definidos, pero las fuentes no están cargadas).

## Reglas de código

- Todos los valores de diseño vienen de `src/constants/theme.js` (`colors`, `spacing`, `fontSizes`, `radius`, `borderWidth`).
- Los estilos siempre en `StyleSheet.create()` al final del archivo.
- Solo `console.warn` para errores esperados; no `console.log` en código de producción.
- Todo el código debe ser limpio y comentado en español: cada función y componente debe tener un comentario corto explicando qué hace.
- Después de cada tarea completada, hacer un commit con mensaje descriptivo en español (ej: `feat: agregar crop automático a thumbnails de trazos`).
