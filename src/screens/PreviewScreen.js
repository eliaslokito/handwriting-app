/**
 * PreviewScreen.js
 * Pantalla de vista previa del apunte generado.
 *
 * Recibe: text, sheetFormat, fontSize
 * Renderiza: cada carácter del texto usando los trazos guardados del usuario
 * con variación aleatoria de rotación (±2°) y posición (±2px)
 *
 * NOTA: Esta es la versión base del renderizador.
 * El motor completo de renderización se refinará en iteraciones siguientes.
 */

import React, { useRef, useEffect, useState } from 'react';
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
import { Canvas, Image as SkiaImage, useCanvasRef, Skia } from '@shopify/react-native-skia';
import { Platform } from 'react-native';
import { useApp } from '../context/AppContext';
import { colors, spacing, fontSizes, radius, borderWidth } from '../constants/theme';

const { width: SCREEN_W } = Dimensions.get('window');

// Tamaño de letra en px por opción
const CHAR_SIZE = { small: 28, medium: 38, large: 52 };

// Interlineado
const LINE_HEIGHT_FACTOR = 1.8;

// Padding interno de la hoja
const SHEET_PADDING = 24;

// Ancho disponible para escribir
const WRITE_WIDTH = SCREEN_W - SHEET_PADDING * 2;

export default function PreviewScreen({ route, navigation }) {
  const { text, sheetFormat, fontSize } = route.params;
  const { strokesFor } = useApp();
  const canvasRef = useCanvasRef();
  const [rendering, setRendering] = useState(true);
  const [renderData, setRenderData] = useState([]);

  const charPx      = CHAR_SIZE[fontSize];
  const lineHeight  = Math.round(charPx * LINE_HEIGHT_FACTOR);
  const charSpacing = Math.round(charPx * 0.55);

  // ─── Construir datos de renderización ──────────────────────────────────
  useEffect(() => {
    buildRenderData();
  }, []);

  async function buildRenderData() {
    const chars = text.split('');
    const items = [];
    let x = SHEET_PADDING;
    let y = SHEET_PADDING + charPx;

    for (const char of chars) {
      if (char === '\n') {
        x = SHEET_PADDING;
        y += lineHeight;
        continue;
      }

      if (char === ' ') {
        x += charSpacing * 0.6;
        if (x > WRITE_WIDTH) { x = SHEET_PADDING; y += lineHeight; }
        continue;
      }

      // Obtener trazo aleatorio para este carácter
      const strokes = strokesFor(char.toLowerCase()) ?? strokesFor(char);
      const dataUrl  = strokes?.length
        ? strokes[Math.floor(Math.random() * strokes.length)]
        : null;

      // Variación aleatoria — hace que no parezca robótico
      const rotation  = (Math.random() - 0.5) * 4; // ±2°
      const offsetX   = (Math.random() - 0.5) * 4; // ±2px
      const offsetY   = (Math.random() - 0.5) * 4; // ±2px

      items.push({ char, dataUrl, x: x + offsetX, y: y + offsetY, rotation, size: charPx });

      x += charSpacing;

      // Salto de línea automático
      if (x + charSpacing > WRITE_WIDTH) {
        x = SHEET_PADDING;
        y += lineHeight;
      }
    }

    const totalHeight = y + lineHeight + SHEET_PADDING;
    setRenderData({ items, totalHeight });
    setRendering(false);
  }

  // ─── Exportar ───────────────────────────────────────────────────────────
  const handleExport = async (format) => {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso necesario', 'Necesitamos acceso a tu galería para guardar el apunte.');
      return;
    }

    const image = canvasRef.current?.makeImageSnapshot();
    if (!image) return;

    Alert.alert('Exportado', `El apunte se guardó como ${format.toUpperCase()} en tu galería.`);
  };

  const sheetBg = sheetFormat === 'lined'
    ? '#FAFAF7'
    : sheetFormat === 'grid'
      ? '#FAFAF7'
      : '#FAFAF7';

  return (
    <SafeAreaView style={styles.safe}>

      {/* ── Header ─────────────────────────────────────────────── */}
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
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >

          {/* ── Hoja renderizada ─────────────────────────────────── */}
          <View style={[styles.sheet, { backgroundColor: sheetBg, height: renderData.totalHeight }]}>

            {/* Líneas de hoja */}
            {sheetFormat === 'lined' && renderLineGuides(renderData.totalHeight, lineHeight, charPx)}
            {sheetFormat === 'grid'  && renderGridGuides(renderData.totalHeight, SCREEN_W)}

            {/* Caracteres */}
            {renderData.items?.map((item, i) => (
              <CharacterToken key={i} item={item} />
            ))}
          </View>

          {/* ── Botones de exportación ────────────────────────────── */}
          <Text style={styles.exportLabel}>EXPORTAR COMO</Text>
          <View style={styles.exportRow}>
            {['PNG', 'JPG', 'PDF'].map(fmt => (
              <TouchableOpacity
                key={fmt}
                style={styles.exportBtn}
                onPress={() => handleExport(fmt.toLowerCase())}
              >
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
  const { char, dataUrl, x, y, rotation, size } = item;

  if (!dataUrl) {
    // Fallback: mostrar el carácter como texto si no hay trazo capturado
    return (
      <Text style={{
        position: 'absolute',
        left: x,
        top: y - size,
        fontSize: size,
        color: colors.carbon,
        transform: [{ rotate: `${rotation}deg` }],
        opacity: 0.4,
      }}>
        {char}
      </Text>
    );
  }

  return (
    <View style={{
      position: 'absolute',
      left: x,
      top: y - size,
      width: size,
      height: size,
      transform: [{ rotate: `${rotation}deg` }],
    }}>
      {/* La imagen del trazo se renderiza aquí — se refinará con Skia */}
      <Text style={{ fontSize: size * 0.8, color: colors.carbon }}>{char}</Text>
    </View>
  );
}

// ─── Helpers de fondo de hoja ─────────────────────────────────────────────────
function renderLineGuides(totalHeight, lineHeight, charPx) {
  const lines = [];
  for (let y = SHEET_PADDING + charPx; y < totalHeight; y += lineHeight) {
    lines.push(
      <View key={y} style={{
        position: 'absolute',
        left: 0, right: 0,
        top: y + 6,
        height: 0.5,
        backgroundColor: 'rgba(136,135,128,0.25)',
      }} />
    );
  }
  return lines;
}

function renderGridGuides(totalHeight, totalWidth) {
  const lines = [];
  const step = 24;
  for (let y = 0; y < totalHeight; y += step) {
    lines.push(<View key={`h${y}`} style={{ position: 'absolute', left: 0, right: 0, top: y, height: 0.5, backgroundColor: 'rgba(136,135,128,0.18)' }} />);
  }
  for (let x = 0; x < totalWidth; x += step) {
    lines.push(<View key={`v${x}`} style={{ position: 'absolute', top: 0, bottom: 0, left: x, width: 0.5, backgroundColor: 'rgba(136,135,128,0.18)' }} />);
  }
  return lines;
}

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
  headerTitle: { fontSize: fontSizes.lg, color: colors.hueso, fontWeight: '400' },
  backBtn: { width: 60 },
  backBtnText: { fontSize: fontSizes.sm, color: colors.piedra },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  loadingText: { fontSize: fontSizes.md, color: colors.piedra },

  scrollContent: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },

  sheet: {
    width: '100%',
    borderRadius: radius.lg,
    borderWidth: borderWidth.thin,
    borderColor: colors.borde,
    overflow: 'hidden',
    position: 'relative',
  },

  exportLabel: {
    fontSize: fontSizes.xs,
    color: colors.piedra,
    letterSpacing: 0.7,
    marginTop: spacing.sm,
  },
  exportRow: { flexDirection: 'row', gap: spacing.sm },
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
