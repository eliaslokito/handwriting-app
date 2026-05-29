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
 *
 * Por qué forceRender y no solo redraw():
 *   redraw() repinta el canvas nativo pero NO re-evalúa closures JSX.
 *   forceRender (dispatch de useReducer, estable entre renders) sí dispara
 *   el re-render completo. Durante el dibujo activo solo usamos redraw()
 *   para máxima fluidez; un único forceRender al inicio del trazo es suficiente
 *   para meter <Path path={currentPath}/> en el árbol de Skia.
 *
 * Formato de paths almacenados (pathsRef):
 *   { path: SkiaPath, sw: number, pts: [[x,y], ...] }
 *   - path: objeto Skia para renderizado en tiempo real
 *   - sw:   grosor del trazo
 *   - pts:  puntos crudos redondeados a 1 decimal para serialización vectorial
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

const GUIDE_COLOR  = 'rgba(28, 28, 26, 0.08)';
const STROKE_COLOR = colors.grafito;
const CROP_PADDING = 14;

/**
 * Comprueba si un path choca con el círculo de la goma.
 * Expande el bounding box del path por el ancho de trazo antes de comparar.
 */
function pathHitTest(path, ex, ey, strokeWidth, eraserRadius) {
  const b = path.getBounds();
  if (b.width <= 0 && b.height <= 0) return false;

  const half   = strokeWidth / 2;
  const left   = b.x - half;
  const top    = b.y - half;
  const right  = b.x + b.width  + half;
  const bottom = b.y + b.height + half;

  const nearX = Math.max(left, Math.min(ex, right));
  const nearY = Math.max(top,  Math.min(ey, bottom));
  const dist  = Math.sqrt((ex - nearX) ** 2 + (ey - nearY) ** 2);
  return dist <= eraserRadius;
}

/**
 * Calcula el bounding box del conjunto de paths de puntos.
 * Expande por sw/2 para que el bbox incluya el grosor del trazo.
 * @param {Array<{pts: number[][], sw: number}>} pathItems
 * @returns {{x,y,w,h} | null}
 */
function computeBbox(pathItems) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const { pts, sw } of pathItems) {
    if (!pts || pts.length === 0) continue;
    const half = (sw ?? 2.5) / 2;
    for (const [x, y] of pts) {
      if (x - half < minX) minX = x - half;
      if (y - half < minY) minY = y - half;
      if (x + half > maxX) maxX = x + half;
      if (y + half > maxY) maxY = y + half;
    }
  }
  if (!isFinite(minX)) return null;
  return {
    x: +minX.toFixed(1),
    y: +minY.toFixed(1),
    w: +(maxX - minX).toFixed(1),
    h: +(maxY - minY).toFixed(1),
  };
}

const DrawingCanvas = forwardRef(({ onStrokeEnd, onToggleEraser, isErasing, width, height, strokeWidth = 2.5, eraserRadius = 22 }, ref) => {
  const canvasRef    = useCanvasRef();
  const pathsRef     = useRef([]);       // [{path, sw, pts}, ...]
  const currentPath  = useRef(null);
  const currentPts   = useRef([]);       // puntos del trazo en curso
  const isDrawing    = useRef(false);
  const eraserPosRef = useRef(null);

  // Refs estables para callbacks y props que cambian entre renders
  const onStrokeEndRef    = useRef(onStrokeEnd);
  const onToggleEraserRef = useRef(onToggleEraser);
  const isErasingRef      = useRef(isErasing);
  const strokeWidthRef    = useRef(strokeWidth);
  const eraserRadiusRef   = useRef(eraserRadius);
  onStrokeEndRef.current    = onStrokeEnd;
  onToggleEraserRef.current = onToggleEraser;
  isErasingRef.current      = isErasing;
  strokeWidthRef.current    = strokeWidth;
  eraserRadiusRef.current   = eraserRadius;

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
      pathsRef.current     = [];
      currentPath.current  = null;
      currentPts.current   = [];
      isDrawing.current    = false;
      eraserPosRef.current = null;
      forceRenderRef.current();
    },

    /**
     * Exporta como PNG base64 recortado al bounding box del trazo completo.
     */
    async toDataUrl() {
      const allPaths = pathsRef.current.map(item => item.path);
      const all = currentPath.current
        ? [...allPaths, currentPath.current]
        : allPaths;

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

    /**
     * Carga paths serializados en el canvas para edición.
     * Acepta el nuevo formato {pts, w} y el legado {svg, sw}.
     */
    loadPaths(pathsData) {
      const restored = (pathsData ?? []).map(item => {
        // Formato nuevo: { pts: [[x,y],...], w: number }
        if (Array.isArray(item.pts) && item.pts.length >= 2) {
          const path = Skia.Path.Make();
          path.moveTo(item.pts[0][0], item.pts[0][1]);
          for (let i = 1; i < item.pts.length; i++) {
            path.lineTo(item.pts[i][0], item.pts[i][1]);
          }
          return { path, sw: item.w ?? 2.5, pts: item.pts };
        }
        // Formato legado: { svg: string, sw: number }
        if (item.svg) {
          const path = Skia.Path.MakeFromSVGString(item.svg);
          return path ? { path, sw: item.sw ?? 2.5, pts: [] } : null;
        }
        return null;
      }).filter(Boolean);

      pathsRef.current     = restored;
      currentPath.current  = null;
      currentPts.current   = [];
      isDrawing.current    = false;
      eraserPosRef.current = null;
      forceRenderRef.current();
    },

    /**
     * Serializa los paths actuales a formato vectorial {pts, w} y calcula el bbox.
     * Devuelve { paths: [{pts, w}], bbox: {x,y,w,h} | null }
     */
    getPaths() {
      const all = [
        ...pathsRef.current.map(item => ({ pts: item.pts, w: item.sw })),
        ...(currentPath.current && currentPts.current.length > 0
          ? [{ pts: currentPts.current, w: strokeWidthRef.current }]
          : []),
      ];
      return { paths: all, bbox: computeBbox(all) };
    },
  }));

  // ─── PanResponder — funciona con S Pen, Apple Pencil y toque normal ─────
  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder:  () => true,

    onPanResponderGrant: (e) => {
      const { locationX: x, locationY: y, buttons } = e.nativeEvent;

      if (buttons === 2) {
        onToggleEraserRef.current?.();
        return;
      }

      if (isErasingRef.current) {
        eraserPosRef.current = { x, y };
        forceRenderRef.current();
      } else {
        // Iniciar path + capturar primer punto.
        // forceRender mete <Path path={currentPath}/> en el árbol de Skia;
        // a partir de aquí cada lineTo+redraw() renderiza en tiempo real.
        const path = Skia.Path.Make();
        path.moveTo(x, y);
        currentPath.current = path;
        currentPts.current  = [[+x.toFixed(1), +y.toFixed(1)]];
        isDrawing.current   = true;
        forceRenderRef.current();
      }
    },

    onPanResponderMove: (e) => {
      const { locationX: x, locationY: y } = e.nativeEvent;

      if (isErasingRef.current) {
        eraserPosRef.current = { x, y };
        pathsRef.current = pathsRef.current.filter(
          item => !pathHitTest(item.path, x, y, item.sw, eraserRadiusRef.current)
        );
        forceRenderRef.current();
      } else {
        if (!isDrawing.current || !currentPath.current) return;
        currentPath.current.lineTo(x, y);
        currentPts.current.push([+x.toFixed(1), +y.toFixed(1)]);
        canvasRef.current?.redraw();
      }
    },

    onPanResponderRelease: () => {
      if (isErasingRef.current) {
        eraserPosRef.current = null;
        forceRenderRef.current();
        return;
      }
      if (!isDrawing.current || !currentPath.current) return;
      isDrawing.current = false;
      pathsRef.current  = [...pathsRef.current, {
        path: currentPath.current,
        sw:   strokeWidthRef.current,
        pts:  currentPts.current,
      }];
      currentPath.current = null;
      currentPts.current  = [];
      forceRenderRef.current();
      onStrokeEndRef.current?.();
    },

    onPanResponderTerminate: () => {
      if (isErasingRef.current) {
        eraserPosRef.current = null;
        forceRenderRef.current();
        return;
      }
      if (isDrawing.current && currentPath.current) {
        isDrawing.current = false;
        pathsRef.current  = [...pathsRef.current, {
          path: currentPath.current,
          sw:   strokeWidthRef.current,
          pts:  currentPts.current,
        }];
        currentPath.current = null;
        currentPts.current  = [];
        forceRenderRef.current();
      }
    },
  }), []);

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

        {/* Trazos completados — cada uno conserva su grosor original */}
        {pathsRef.current.map((item, i) => (
          <Path
            key={i}
            path={item.path}
            color={STROKE_COLOR}
            strokeWidth={item.sw}
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
            strokeWidth={strokeWidth}
            style="stroke"
            strokeJoin="round"
            strokeCap="round"
          />
        )}

        {/* Cursor de la goma */}
        {isErasing && ep && (
          <>
            <Circle cx={ep.x} cy={ep.y} r={eraserRadius} color="rgba(100, 100, 100, 0.12)" />
            <Circle cx={ep.x} cy={ep.y} r={eraserRadius} color={colors.piedra} style="stroke" strokeWidth={1.5} />
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
