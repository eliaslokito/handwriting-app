/**
 * DrawingCanvas.js
 * Canvas de dibujo con soporte de multi-trazo y goma de borrar.
 *
 * Modos:
 *   Dibujo  — acumula paths con PanResponder; forceRender al levantar la pluma
 *   Goma    — círculo semitransparente sigue el dedo; elimina paths que toca
 *
 * Detección de hardware:
 *   S Pen  — si e.nativeEvent.buttons === 2 (botón lateral) al iniciar toque,
 *             llama onToggleEraser para alternar el modo desde el padre
 *   Apple Pencil doble toque — requiere UIPencilInteraction nativo (no
 *             disponible en Expo Managed Workflow sin módulo nativo)
 *
 * Por qué forceRender y no redraw():
 *   redraw() repinta el canvas nativo pero NO dispara re-render de React,
 *   así que pathsRef.current.map() nunca se re-evalúa. forceRender (dispatch
 *   de useReducer, estable entre renders) sí dispara el re-render completo.
 *   Durante el dibujo activo (onMove) solo usamos redraw() para máxima fluidez.
 */

import React, {
  useRef,
  forwardRef,
  useImperativeHandle,
  useMemo,
  useReducer,
} from 'react';
import { View, StyleSheet, PanResponder } from 'react-native';
import {
  Canvas,
  Circle,
  Path,
  Skia,
  useCanvasRef,
  Line,
  vec,
} from '@shopify/react-native-skia';
import { colors } from '../constants/theme';

const GUIDE_COLOR   = 'rgba(28, 28, 26, 0.08)';
const STROKE_COLOR  = colors.grafito;
const STROKE_WIDTH  = 2.5;
const CROP_PADDING  = 14;
const ERASER_RADIUS = 22; // radio del círculo de goma en px

/**
 * Comprueba si un path choca con el círculo de la goma.
 * Expande el bounding box del path por el ancho de trazo antes de comparar.
 */
function pathHitTest(path, ex, ey) {
  const b = path.getBounds();
  if (b.width <= 0 && b.height <= 0) return false;

  const half   = STROKE_WIDTH / 2;
  const left   = b.x - half;
  const top    = b.y - half;
  const right  = b.x + b.width  + half;
  const bottom = b.y + b.height + half;

  // Punto más cercano del rect al centro de la goma
  const nearX = Math.max(left, Math.min(ex, right));
  const nearY = Math.max(top,  Math.min(ey, bottom));
  const dist  = Math.sqrt((ex - nearX) ** 2 + (ey - nearY) ** 2);
  return dist <= ERASER_RADIUS;
}

const DrawingCanvas = forwardRef(({ onStrokeEnd, onToggleEraser, isErasing, width, height }, ref) => {
  const canvasRef    = useCanvasRef();
  const pathsRef     = useRef([]);
  const currentPath  = useRef(null);
  const isDrawing    = useRef(false);
  const eraserPosRef = useRef(null); // {x, y} mientras la goma toca la pantalla

  // Refs estables para callbacks y props que cambian entre renders
  const onStrokeEndRef    = useRef(onStrokeEnd);
  const onToggleEraserRef = useRef(onToggleEraser);
  const isErasingRef      = useRef(isErasing);
  onStrokeEndRef.current    = onStrokeEnd;
  onToggleEraserRef.current = onToggleEraser;
  isErasingRef.current      = isErasing;

  // forceRender dispara re-render de React para actualizar JSX de Skia
  const [, dispatch]   = useReducer(n => n + 1, 0);
  const forceRenderRef = useRef(dispatch);
  forceRenderRef.current = dispatch;

  const midY   = height / 2;
  const guides = [
    { y: midY - 45 },
    { y: midY },
    { y: midY + 45 },
  ];

  // ─── API pública expuesta al padre ───────────────────────────────────────
  useImperativeHandle(ref, () => ({
    /** Borra todos los paths y limpia el canvas */
    clear() {
      pathsRef.current    = [];
      currentPath.current = null;
      isDrawing.current   = false;
      eraserPosRef.current = null;
      forceRenderRef.current();
    },

    /**
     * Exporta como PNG base64 recortado al bounding box del trazo completo.
     * Incluye el trazo en curso si el usuario no ha levantado la pluma.
     */
    async toDataUrl() {
      const all = currentPath.current
        ? [...pathsRef.current, currentPath.current]
        : [...pathsRef.current];

      if (all.length === 0) return null;

      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const p of all) {
        const b = p.getBounds();
        if (b.width > 0 || b.height > 0) {
          minX = Math.min(minX, b.x);
          minY = Math.min(minY, b.y);
          maxX = Math.max(maxX, b.x + b.width);
          maxY = Math.max(maxY, b.y + b.height);
        }
      }
      if (!isFinite(minX)) return null;

      const x = Math.max(0, minX - CROP_PADDING);
      const y = Math.max(0, minY - CROP_PADDING);
      const w = Math.min(width,  maxX + CROP_PADDING) - x;
      const h = Math.min(height, maxY + CROP_PADDING) - y;
      if (w <= 0 || h <= 0) return null;

      const image = canvasRef.current?.makeImageSnapshot({ x, y, width: w, height: h });
      return image ? 'data:image/png;base64,' + image.encodeToBase64() : null;
    },

    hasStrokes() {
      return pathsRef.current.length > 0 || currentPath.current !== null;
    },
  }));

  // ─── PanResponder — funciona con S Pen, Apple Pencil y toque normal ─────
  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder:  () => true,

    onPanResponderGrant: (e) => {
      const { locationX: x, locationY: y, buttons } = e.nativeEvent;

      // Detectar botón lateral del S Pen (Android): buttons === 2
      // En algunos ROMs de Samsung, sostener el botón lateral genera button=2
      if (buttons === 2) {
        onToggleEraserRef.current?.();
        return;
      }

      if (isErasingRef.current) {
        // Modo goma: mostrar cursor
        eraserPosRef.current = { x, y };
        forceRenderRef.current();
      } else {
        // Modo dibujo: iniciar path
        const path = Skia.Path.Make();
        path.moveTo(x, y);
        currentPath.current = path;
        isDrawing.current   = true;
      }
    },

    onPanResponderMove: (e) => {
      const { locationX: x, locationY: y } = e.nativeEvent;

      if (isErasingRef.current) {
        // Actualizar posición del cursor y eliminar paths tocados
        eraserPosRef.current = { x, y };
        const before = pathsRef.current.length;
        pathsRef.current = pathsRef.current.filter(p => !pathHitTest(p, x, y));
        // Un solo forceRender actualiza cursor + paths borrados
        forceRenderRef.current();
      } else {
        if (!isDrawing.current || !currentPath.current) return;
        currentPath.current.lineTo(x, y);
        // Solo redraw() durante el trazo activo — sin overhead de re-render
        canvasRef.current?.redraw();
      }
    },

    onPanResponderRelease: () => {
      if (isErasingRef.current) {
        eraserPosRef.current = null; // ocultar cursor al levantar
        forceRenderRef.current();
        return;
      }
      if (!isDrawing.current || !currentPath.current) return;
      isDrawing.current   = false;
      pathsRef.current    = [...pathsRef.current, currentPath.current];
      currentPath.current = null;
      // forceRender hace que React re-renderice y el canvas muestre el path
      forceRenderRef.current();
      onStrokeEndRef.current?.();
    },

    // Si el sistema cancela el gesto (alerta, etc.) — guardar el path igualmente
    onPanResponderTerminate: () => {
      if (isErasingRef.current) {
        eraserPosRef.current = null;
        forceRenderRef.current();
        return;
      }
      if (isDrawing.current && currentPath.current) {
        isDrawing.current   = false;
        pathsRef.current    = [...pathsRef.current, currentPath.current];
        currentPath.current = null;
        forceRenderRef.current();
      }
    },
  }), []); // deps vacío — todo accedido via refs estables

  // ─── Posición de la goma para renderizado ────────────────────────────────
  const ep = eraserPosRef.current;

  return (
    <View
      style={[styles.container, { width, height }]}
      {...panResponder.panHandlers}
    >
      <Canvas ref={canvasRef} style={{ width, height }}>

        {/* Líneas guía de escritura */}
        {guides.map((g, i) => (
          <Line
            key={i}
            p1={vec(20, g.y)}
            p2={vec(width - 20, g.y)}
            color={GUIDE_COLOR}
            strokeWidth={1}
          />
        ))}

        {/* Trazos completados */}
        {pathsRef.current.map((p, i) => (
          <Path
            key={i}
            path={p}
            color={STROKE_COLOR}
            strokeWidth={STROKE_WIDTH}
            style="stroke"
            strokeJoin="round"
            strokeCap="round"
          />
        ))}

        {/* Trazo en curso — repintado con redraw() sin re-render */}
        {currentPath.current && (
          <Path
            path={currentPath.current}
            color={STROKE_COLOR}
            strokeWidth={STROKE_WIDTH}
            style="stroke"
            strokeJoin="round"
            strokeCap="round"
          />
        )}

        {/* Cursor de la goma — visible solo mientras toca la pantalla */}
        {isErasing && ep && (
          <>
            <Circle
              cx={ep.x} cy={ep.y} r={ERASER_RADIUS}
              color="rgba(100, 100, 100, 0.12)"
            />
            <Circle
              cx={ep.x} cy={ep.y} r={ERASER_RADIUS}
              color={colors.piedra}
              style="stroke"
              strokeWidth={1.5}
            />
          </>
        )}

      </Canvas>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.hueso2,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: colors.borde,
    overflow: 'hidden',
  },
});

DrawingCanvas.displayName = 'DrawingCanvas';
export default DrawingCanvas;
