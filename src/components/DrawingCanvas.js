/**
 * DrawingCanvas.js
 * Canvas de dibujo para capturar trazos con lápiz o dedo.
 *
 * Problema raíz del multi-trazo:
 *   canvasRef.current?.redraw() fuerza un repintado nativo de Skia pero NO
 *   dispara un re-render de React. Por eso pathsRef.current.map() no se
 *   re-evalúa y los paths completados nunca aparecen en el árbol JSX.
 *
 * Solución:
 *   - Durante el dibujo (onMove) → solo redraw() [rápido, sin re-render]
 *   - Al levantar la pluma   → forceRender() [dispara re-render de React]
 *   Los paths se acumulan en pathsRef y se muestran tras cada re-render.
 *
 * Flujo de multi-trazo:
 *   levantar pluma → path se guarda → forceRender → React re-renderiza →
 *   canvas muestra todos los paths → usuario dibuja el siguiente trazo
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
  Path,
  Skia,
  useCanvasRef,
  Line,
  vec,
} from '@shopify/react-native-skia';
import { colors } from '../constants/theme';

const GUIDE_COLOR  = 'rgba(28, 28, 26, 0.08)';
const STROKE_COLOR = colors.grafito;
const STROKE_WIDTH = 2.5;
const CROP_PADDING = 14;

const DrawingCanvas = forwardRef(({ onStrokeEnd, width, height }, ref) => {
  const canvasRef      = useCanvasRef();
  const pathsRef       = useRef([]);    // trazos completados (persisten entre levantadas)
  const currentPath    = useRef(null);  // trazo en curso
  const isDrawing      = useRef(false);

  // Refs estables para acceder a valores actuales dentro del PanResponder (useMemo [])
  const onStrokeEndRef = useRef(onStrokeEnd);
  onStrokeEndRef.current = onStrokeEnd;

  // forceRender: dispara re-render de React para que pathsRef.current.map()
  // se re-evalúe y los nuevos paths aparezcan en el árbol JSX de Skia.
  // useReducer setter ES estable entre renders (garantía de React).
  const [, dispatch]  = useReducer(n => n + 1, 0);
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
    /** Limpia todos los paths y fuerza re-render para vaciar el canvas */
    clear() {
      pathsRef.current    = [];
      currentPath.current = null;
      isDrawing.current   = false;
      forceRenderRef.current(); // re-render limpia el JSX de Skia
    },

    /**
     * Exporta el dibujo completo como PNG base64 recortado al bounding box.
     * Incluye el trazo en curso si el usuario aún no levantó la pluma.
     */
    async toDataUrl() {
      const allPaths = currentPath.current
        ? [...pathsRef.current, currentPath.current]
        : [...pathsRef.current];

      if (allPaths.length === 0) return null;

      // Calcular bounding box de todos los paths
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const path of allPaths) {
        const b = path.getBounds();
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
      const { locationX, locationY } = e.nativeEvent;
      const path = Skia.Path.Make();
      path.moveTo(locationX, locationY);
      currentPath.current = path;
      isDrawing.current   = true;
    },

    onPanResponderMove: (e) => {
      if (!isDrawing.current || !currentPath.current) return;
      const { locationX, locationY } = e.nativeEvent;
      currentPath.current.lineTo(locationX, locationY);
      // Solo redraw() durante el dibujo activo — NO provoca re-render de React
      // Skia repinta el path nativo directamente (muy rápido)
      canvasRef.current?.redraw();
    },

    onPanResponderRelease: () => {
      if (!isDrawing.current || !currentPath.current) return;
      isDrawing.current   = false;
      pathsRef.current    = [...pathsRef.current, currentPath.current];
      currentPath.current = null;
      // forceRender dispara re-render de React → el JSX re-evalúa
      // pathsRef.current.map() → Skia muestra el path guardado
      // El usuario puede levantar la pluma y seguir dibujando
      forceRenderRef.current();
      onStrokeEndRef.current?.();
    },

    // Si el gesto es cancelado (notificación del sistema, etc.) — guardar igual
    onPanResponderTerminate: () => {
      if (isDrawing.current && currentPath.current) {
        isDrawing.current   = false;
        pathsRef.current    = [...pathsRef.current, currentPath.current];
        currentPath.current = null;
        forceRenderRef.current();
      }
    },
  }), []); // deps vacío — todas las dependencias son refs estables

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

        {/* Trazos completados — visibles tras cada forceRender */}
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

        {/* Trazo en curso — Skia lo repinta con redraw() sin re-render */}
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
