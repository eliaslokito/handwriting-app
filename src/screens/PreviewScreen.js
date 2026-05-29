/**
 * PreviewScreen.js
 * Pantalla de vista previa del apunte generado.
 *
 * Recibe: text, sheetFormat, fontSize
 * Renderiza: cada carácter con sus paths vectoriales escalados via Skia.
 * Aplica suavizado Catmull-Rom al renderizar para convertir los puntos
 * crudos [[x,y]] en curvas bezier cúbicas fluidas.
 *
 * Retrocompatibilidad: strokes sin paths vectoriales ({pts}) caen al fallback
 * de texto semitransparente.
 */

import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Canvas,
  Path,
  Group,
  Skia,
} from '@shopify/react-native-skia';
import { useApp } from '../context/AppContext';
import { colors, spacing, fontSizes, radius, borderWidth } from '../constants/theme';

const { width: SCREEN_W } = Dimensions.get('window');

const CHAR_SIZE          = { small: 28, medium: 38, large: 52 };
const LINE_HEIGHT_FACTOR = 1.8;
const SHEET_PADDING      = 24;
const WRITE_WIDTH        = SCREEN_W - SHEET_PADDING * 2;

// ─── Helpers de formato de stroke (retrocompatibilidad) ──────────────────────

function getStroke(raw) {
  if (!raw) return null;
  if (typeof raw === 'string') return { dataUrl: raw, paths: [], bbox: null };
  return raw;
}

// ─── Suavizado Catmull-Rom → Skia Path ───────────────────────────────────────

/**
 * Convierte un array de puntos [[x,y],...] a un SkiaPath suavizado con
 * interpolación Catmull-Rom. La curva pasa por todos los puntos originales,
 * lo que preserva la forma del trazo y evita overshooting.
 *
 * Para cada segmento i→i+1, los handles bezier se derivan de los vecinos:
 *   cp1 = p[i]   + (p[i+1] - p[i-1]) / 6
 *   cp2 = p[i+1] - (p[i+2] - p[i])   / 6
 * Los extremos usan puntos fantasma reflejados para mantener la tangente.
 */
function catmullRomToSkia(pts) {
  if (!pts || pts.length < 2) return null;

  const path = Skia.Path.Make();
  path.moveTo(pts[0][0], pts[0][1]);

  if (pts.length === 2) {
    path.lineTo(pts[1][0], pts[1][1]);
    return path;
  }

  const n = pts.length;
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[i - 1] ?? [2 * pts[0][0] - pts[1][0], 2 * pts[0][1] - pts[1][1]];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? [2 * pts[n-1][0] - pts[n-2][0], 2 * pts[n-1][1] - pts[n-2][1]];

    path.cubicTo(
      p1[0] + (p2[0] - p0[0]) / 6,  p1[1] + (p2[1] - p0[1]) / 6,
      p2[0] - (p3[0] - p1[0]) / 6,  p2[1] - (p3[1] - p1[1]) / 6,
      p2[0], p2[1]
    );
  }
  return path;
}

// ─── Cálculo de transformación bbox → cuadrado destino ───────────────────────

/**
 * Mapea el bounding box del trazo original al cuadrado de `size` px.
 * Escala uniforme (aspect-ratio preservado) con margen visual del 15%.
 * Alinea el contenido 10% desde el top del cuadrado para dejar espacio
 * a descendentes y respetar la baseline.
 */
function computeTransform(bbox, size) {
  if (!bbox || bbox.w <= 0 || bbox.h <= 0) return null;
  const scale = Math.min(size / bbox.w, size / bbox.h) * 0.85;
  return {
    scale,
    tx: (size - bbox.w * scale) / 2 - bbox.x * scale,
    ty: size * 0.10 - bbox.y * scale,
  };
}

// ─── Pantalla principal ───────────────────────────────────────────────────────

export default function PreviewScreen({ route, navigation }) {
  const { text, sheetFormat, fontSize } = route.params;
  const { strokesFor } = useApp();
  const [rendering,  setRendering]  = useState(true);
  const [renderData, setRenderData] = useState({ items: [], totalHeight: 400 });

  const charPx      = CHAR_SIZE[fontSize];
  const lineHeight  = Math.round(charPx * LINE_HEIGHT_FACTOR);
  const charSpacing = Math.round(charPx * 0.55);

  useEffect(() => { buildRenderData(); }, []);

  function buildRenderData() {
    const chars = text.split('');
    const items = [];
    let x = SHEET_PADDING;
    let y = SHEET_PADDING + charPx;

    for (const char of chars) {
      if (char === '\n') { x = SHEET_PADDING; y += lineHeight; continue; }

      if (char === ' ') {
        x += charSpacing * 0.6;
        if (x > WRITE_WIDTH) { x = SHEET_PADDING; y += lineHeight; }
        continue;
      }

      // Buscar trazo: primero el carácter exacto, luego su minúscula
      const rawStrokes = strokesFor(char) ?? strokesFor(char.toLowerCase());
      const rawStroke  = rawStrokes?.length
        ? rawStrokes[Math.floor(Math.random() * rawStrokes.length)]
        : null;
      const stroke = getStroke(rawStroke);

      const rotation = (Math.random() - 0.5) * 4;
      const offsetX  = (Math.random() - 0.5) * 4;
      const offsetY  = (Math.random() - 0.5) * 4;

      items.push({ char, stroke, x: x + offsetX, y: y + offsetY, rotation, size: charPx });

      x += charSpacing;
      if (x + charSpacing > WRITE_WIDTH) { x = SHEET_PADDING; y += lineHeight; }
    }

    setRenderData({ items, totalHeight: y + lineHeight + SHEET_PADDING });
    setRendering(false);
  }

  const handleExport = () => {
    Alert.alert('Exportación', 'Próximamente — requiere expo-media-library + react-native-view-shot.');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>vista previa</Text>
        <View style={{ width: 60 }} />
      </View>

      {rendering ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.grafito} />
          <Text style={styles.loadingText}>Generando apunte...</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <View style={[styles.sheet, { height: renderData.totalHeight }]}>
            {sheetFormat === 'lined' && renderLineGuides(renderData.totalHeight, lineHeight, charPx)}
            {sheetFormat === 'grid'  && renderGridGuides(renderData.totalHeight, SCREEN_W)}

            {renderData.items.map((item, i) => (
              <CharacterToken key={i} item={item} />
            ))}
          </View>

          <Text style={styles.exportLabel}>EXPORTAR COMO</Text>
          <View style={styles.exportRow}>
            {['PNG', 'JPG', 'PDF'].map(fmt => (
              <TouchableOpacity key={fmt} style={styles.exportBtn} onPress={handleExport}>
                <Text style={styles.exportBtnText}>{fmt}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ─── Token de carácter individual ────────────────────────────────────────────

function CharacterToken({ item }) {
  const { char, stroke, x, y, rotation, size } = item;

  const posStyle = {
    position: 'absolute',
    left: x,
    top:  y - size,
    width:  size,
    height: size,
    transform: [{ rotate: `${rotation}deg` }],
  };

  // Sin trazo capturado → fallback semitransparente
  if (!stroke) {
    return (
      <Text style={[posStyle, { fontSize: size * 0.8, color: colors.carbon, opacity: 0.3 }]}>
        {char}
      </Text>
    );
  }

  // Verificar que hay datos vectoriales válidos con bbox
  const hasVector = Array.isArray(stroke.paths) &&
    stroke.paths.length > 0 &&
    stroke.paths[0]?.pts?.length >= 2 &&
    stroke.bbox != null;

  // Construir paths Skia suavizados — solo si hay datos vectoriales
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const skPaths = useMemo(() => {
    if (!hasVector) return [];
    return stroke.paths
      .map(p => catmullRomToSkia(p.pts))
      .filter(Boolean);
  }, [stroke, hasVector]);

  const transform = hasVector ? computeTransform(stroke.bbox, size) : null;

  // Sin vector válido → fallback de texto
  if (!hasVector || !transform || skPaths.length === 0) {
    return (
      <Text style={[posStyle, { fontSize: size * 0.75, color: colors.carbon, opacity: 0.35 }]}>
        {char}
      </Text>
    );
  }

  return (
    <View style={posStyle}>
      <Canvas style={{ width: size, height: size }}>
        <Group transform={[
          { translateX: transform.tx },
          { translateY: transform.ty },
          { scaleX: transform.scale },
          { scaleY: transform.scale },
        ]}>
          {skPaths.map((skPath, i) => (
            <Path
              key={i}
              path={skPath}
              color={colors.grafito}
              strokeWidth={stroke.paths[i].w ?? 2.5}
              style="stroke"
              strokeJoin="round"
              strokeCap="round"
            />
          ))}
        </Group>
      </Canvas>
    </View>
  );
}

// ─── Fondos de hoja ───────────────────────────────────────────────────────────

function renderLineGuides(totalHeight, lineHeight, charPx) {
  const lines = [];
  for (let ly = SHEET_PADDING + charPx; ly < totalHeight; ly += lineHeight) {
    lines.push(
      <View key={ly} style={{
        position: 'absolute', left: 0, right: 0,
        top: ly + 6, height: 0.5,
        backgroundColor: 'rgba(136,135,128,0.25)',
      }} />
    );
  }
  return lines;
}

function renderGridGuides(totalHeight, totalWidth) {
  const lines = [];
  const step = 24;
  for (let ly = 0; ly < totalHeight; ly += step) {
    lines.push(<View key={`h${ly}`} style={{ position: 'absolute', left: 0, right: 0, top: ly, height: 0.5, backgroundColor: 'rgba(136,135,128,0.18)' }} />);
  }
  for (let lx = 0; lx < totalWidth; lx += step) {
    lines.push(<View key={`v${lx}`} style={{ position: 'absolute', top: 0, bottom: 0, left: lx, width: 0.5, backgroundColor: 'rgba(136,135,128,0.18)' }} />);
  }
  return lines;
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.hueso },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.grafito,
  },
  headerTitle:  { fontSize: fontSizes.lg, color: colors.hueso, fontWeight: '400' },
  backBtn:      { width: 60 },
  backBtnText:  { fontSize: fontSizes.sm, color: colors.piedra },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  loadingText:      { fontSize: fontSizes.md, color: colors.piedra },

  scrollContent: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },

  sheet: {
    width: '100%',
    backgroundColor: '#FAFAF7',
    borderRadius: radius.lg,
    borderWidth: borderWidth.thin,
    borderColor: colors.borde,
    overflow: 'hidden',
    position: 'relative',
  },

  exportLabel: { fontSize: fontSizes.xs, color: colors.piedra, letterSpacing: 0.7, marginTop: spacing.sm },
  exportRow:   { flexDirection: 'row', gap: spacing.sm },
  exportBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: borderWidth.thin,
    borderColor: colors.borde,
    alignItems: 'center',
  },
  exportBtnText: { fontSize: fontSizes.md, color: colors.carbon, fontWeight: '500' },
});
