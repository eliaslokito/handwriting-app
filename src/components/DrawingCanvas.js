/**
 * DrawingCanvas.js
 * Canvas de dibujo para capturar trazos con lápiz o dedo.
 *
 * Características:
 * - PanResponder en lugar de onTouch* — funciona correctamente con S Pen y Apple Pencil en tablet
 * - Múltiples pasadas de lápiz se acumulan; el canvas no se limpia entre ellas
 * - Al guardar, exporta solo el bounding box del trazo (crop automático con padding)
 * - clear() limpia todo; solo se llama desde el padre al guardar o cambiar de carácter
 */

import React, { useRef, forwardRef, useImperativeHandle, useMemo } from 'react';
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

const GUIDE_COLOR = 'rgba(28, 28, 26, 0.08)';
const STROKE_COLOR = colors.grafito;
const STROKE_WIDTH = 2.5;
const CROP_PADDING = 14;

const DrawingCanvas = forwardRef(({ onStrokeEnd, width, height }, ref) => {
  const canvasRef    = useCanvasRef();
  const pathsRef     = useRef([]);
  const currentPath  = useRef(null);
  const isDrawing    = useRef(false);
  // Ref estable para el callback — evita recrear panResponder en cada render
  const onStrokeEndRef = useRef(onStrokeEnd);
  onStrokeEndRef.current = onStrokeEnd;

  const midY   = height / 2;
  const guides = [
    { y: midY - 45 },
    { y: midY },
    { y: midY + 45 },
  ];

  // ─── API pública expuesta al padre ───────────────────────────────────────
  useImperativeHandle(ref, () => ({
    clear() {
      pathsRef.current  = [];
      currentPath.current = null;
      isDrawing.current = false;
      canvasRef.current?.redraw();
    },

    async toDataUrl() {
      if (!canvasRef.current || pathsRef.current.length === 0) return null;

      // Calcular bounding box de todos los paths acumulados
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const path of pathsRef.current) {
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

      const image = canvasRef.current.makeImageSnapshot({ x, y, width: w, height: h });
      return image ? 'data:image/png;base64,' + image.encodeToBase64() : null;
    },

    hasStrokes() {
      return pathsRef.current.length > 0;
    },
  }));

  // ─── PanResponder — maneja S Pen, Apple Pencil y toque en tablet ────────
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
      canvasRef.current?.redraw();
    },

    // Al levantar la pluma: guarda el trazo en el buffer, NO limpia el canvas
    onPanResponderRelease: () => {
      if (!isDrawing.current || !currentPath.current) return;
      isDrawing.current   = false;
      pathsRef.current    = [...pathsRef.current, currentPath.current];
      currentPath.current = null;
      canvasRef.current?.redraw();
      onStrokeEndRef.current?.();
    },

    // Si el gesto es cancelado (p.ej. alerta del sistema) — igual guarda el trazo
    onPanResponderTerminate: () => {
      if (isDrawing.current && currentPath.current) {
        isDrawing.current   = false;
        pathsRef.current    = [...pathsRef.current, currentPath.current];
        currentPath.current = null;
        canvasRef.current?.redraw();
      }
    },
  }), []); // deps vacío — usa refs internamente, nunca se recrea

  return (
    <View
      style={[styles.container, { width, height }]}
      {...panResponder.panHandlers}
    >
      <Canvas ref={canvasRef} style={{ width, height }}>

        {/* Líneas guía */}
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

        {/* Trazo en curso */}
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
