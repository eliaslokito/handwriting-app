/**
 * OnboardingScreen.js
 * Pantalla completa de captura de letra personal.
 *
 * Flujo:
 * 1. El usuario selecciona una sección (tab) — Mayúsculas / Minúsculas / Números / Puntuación
 * 2. Dentro de la sección se muestra la barra de caracteres filtrada
 * 3. El usuario dibuja con su lápiz o dedo — puede levantar la pluma y seguir
 * 4. Presiona "Guardar trazo" cuando terminó de escribir el carácter completo
 * 5. Puede eliminar trazos guardados con toque doble
 * 6. Al completar todos los mínimos, aparece botón de finalizar
 */

import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import DrawingCanvas from '../components/DrawingCanvas';
import StrokeThumbnail from '../components/StrokeThumbnail';
import { useApp } from '../context/AppContext';
import {
  ALL_CHARS,
  TOTAL_CHARS,
  MAX_VARIATIONS,
  MIN_VARIATIONS,
  getCharLabel,
  CHARACTER_GROUPS,
} from '../constants/characters';
import { colors, spacing, fontSizes, radius, borderWidth } from '../constants/theme';

const { width: SCREEN_W } = Dimensions.get('window');
const CANVAS_W = SCREEN_W - spacing.lg * 2;
const CANVAS_H = 200;

// Índice global del primer carácter de cada grupo
const GROUP_OFFSETS = CHARACTER_GROUPS.map((_, i) =>
  CHARACTER_GROUPS.slice(0, i).reduce((sum, g) => sum + g.chars.length, 0)
);

export default function OnboardingScreen({ navigation }) {
  const { strokesFor, addStroke, deleteStroke, completeOnboarding, capturedCount } = useApp();

  const [currentIdx, setCurrentIdx] = useState(0);
  const [hasDrawn,   setHasDrawn]   = useState(false);
  const [isErasing,  setIsErasing]  = useState(false);
  const canvasRef   = useRef(null);
  const charNavRef  = useRef(null);

  // Tab activo derivado de currentIdx
  const activeGroupIdx = GROUP_OFFSETS.reduce(
    (acc, offset, i) => (currentIdx >= offset ? i : acc), 0
  );
  const activeGroup       = CHARACTER_GROUPS[activeGroupIdx];
  const activeGroupOffset = GROUP_OFFSETS[activeGroupIdx];
  const firstInGroup      = activeGroupOffset;
  const lastInGroup       = activeGroupOffset + activeGroup.chars.length - 1;

  const currentChar    = ALL_CHARS[currentIdx];
  const currentStrokes = strokesFor(currentChar);
  const isFull         = currentStrokes.length >= MAX_VARIATIONS;
  const done           = capturedCount() === TOTAL_CHARS;

  // Al cambiar de tab, resetear scroll de la barra de caracteres
  useEffect(() => {
    charNavRef.current?.scrollTo({ x: 0, animated: false });
  }, [activeGroupIdx]);

  // ─── Guardar trazo ────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!hasDrawn || isFull) return;
    const dataUrl = await canvasRef.current?.toDataUrl();
    if (!dataUrl) return;

    addStroke(currentChar, dataUrl);
    canvasRef.current?.clear();
    setHasDrawn(false);
  }, [hasDrawn, isFull, currentChar, addStroke]);

  // ─── Borrar canvas ─────────────────────────────────────────────────────
  const handleClear = useCallback(() => {
    canvasRef.current?.clear();
    setHasDrawn(false);
  }, []);

  // ─── Alternar entre modo dibujo y goma ──────────────────────────────────
  const handleToggleEraser = useCallback(() => {
    setIsErasing(prev => !prev);
  }, []);

  // ─── Navegar dentro del grupo activo ─────────────────────────────────
  const handleNext = useCallback(() => {
    if (currentIdx < lastInGroup) {
      setCurrentIdx(prev => prev + 1);
      canvasRef.current?.clear();
      setHasDrawn(false);
    }
  }, [currentIdx, lastInGroup]);

  const handlePrev = useCallback(() => {
    if (currentIdx > firstInGroup) {
      setCurrentIdx(prev => prev - 1);
      canvasRef.current?.clear();
      setHasDrawn(false);
    }
  }, [currentIdx, firstInGroup]);

  // ─── Saltar al carácter tocado en la barra ────────────────────────────
  const handleNavPress = useCallback((globalIdx) => {
    setCurrentIdx(globalIdx);
    canvasRef.current?.clear();
    setHasDrawn(false);
  }, []);

  // ─── Saltar al primer carácter de un tab ─────────────────────────────
  const handleTabPress = useCallback((groupIdx) => {
    setCurrentIdx(GROUP_OFFSETS[groupIdx]);
    canvasRef.current?.clear();
    setHasDrawn(false);
  }, []);

  // ─── Finalizar onboarding ─────────────────────────────────────────────
  const handleFinish = useCallback(() => {
    Alert.alert(
      '¿Listo para empezar?',
      'Puedes regresar a añadir más variaciones de letra desde tu perfil en cualquier momento.',
      [
        { text: 'Seguir capturando', style: 'cancel' },
        {
          text: 'Empezar a usar la app',
          onPress: () => {
            completeOnboarding();
            navigation.replace('Main');
          },
        },
      ]
    );
  }, [completeOnboarding, navigation]);

  const captured    = capturedCount();
  const progressPct = Math.round((captured / TOTAL_CHARS) * 100);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── Header ───────────────────────────────────────────────── */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Tu letra personal</Text>
          <View style={styles.countChip}>
            <Text style={styles.countChipText}>{captured} / {TOTAL_CHARS}</Text>
          </View>
        </View>

        {/* ── Barra de progreso ─────────────────────────────────────── */}
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
        </View>
        <Text style={styles.progressLabel}>Escribe cada carácter — mínimo 1 vez, recomendado 3</Text>

        {/* ── Tabs de sección ───────────────────────────────────────── */}
        <View style={styles.tabs}>
          {CHARACTER_GROUPS.map((group, i) => {
            const isActive     = i === activeGroupIdx;
            const groupCaptured = group.chars.filter(c => strokesFor(c).length > 0).length;
            return (
              <TouchableOpacity
                key={group.id}
                style={[styles.tab, isActive && styles.tabActive]}
                onPress={() => handleTabPress(i)}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]} numberOfLines={1}>
                  {group.label}
                </Text>
                <Text style={[styles.tabCount, isActive && styles.tabCountActive]}>
                  {groupCaptured}/{group.chars.length}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Barra de caracteres de la sección activa ──────────────── */}
        <ScrollView
          ref={charNavRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.navScroll}
          contentContainerStyle={styles.navContent}
        >
          {activeGroup.chars.map((char, localIdx) => {
            const globalIdx = activeGroupOffset + localIdx;
            const count     = strokesFor(char).length;
            const isActive  = globalIdx === currentIdx;
            const isDone    = count >= MAX_VARIATIONS;
            const hasOne    = count >= MIN_VARIATIONS;
            return (
              <TouchableOpacity
                key={char + globalIdx}
                style={[
                  styles.navBtn,
                  isActive  && styles.navBtnActive,
                  isDone    && !isActive && styles.navBtnDone,
                  hasOne    && !isDone && !isActive && styles.navBtnPartial,
                ]}
                onPress={() => handleNavPress(globalIdx)}
              >
                <Text style={[styles.navBtnText, isActive && styles.navBtnTextActive]}>
                  {char}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── Carácter actual ───────────────────────────────────────── */}
        <View style={styles.charDisplay}>
          <Text style={styles.charBig}>{currentChar}</Text>
          <Text style={styles.charLabel}>{getCharLabel(currentChar)}</Text>
        </View>

        {/* ── Puntitos de variaciones ───────────────────────────────── */}
        <View style={styles.dots}>
          {Array.from({ length: MAX_VARIATIONS }).map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i < currentStrokes.length && styles.dotFilled]}
            />
          ))}
        </View>

        {/* ── Recomendación de calidad ──────────────────────────────── */}
        {currentStrokes.length >= MIN_VARIATIONS && currentStrokes.length < MAX_VARIATIONS && (
          <View style={styles.qualityTip}>
            <Text style={styles.qualityTipText}>
              Agregar {MAX_VARIATIONS - currentStrokes.length} variación
              {MAX_VARIATIONS - currentStrokes.length > 1 ? 'es' : ''} más mejora la calidad del apunte
            </Text>
          </View>
        )}

        {/* ── Toggle dibujo / goma ──────────────────────────────────── */}
        <View style={styles.modeToggle}>
          <TouchableOpacity
            style={[styles.modeBtn, !isErasing && styles.modeBtnActive]}
            onPress={() => setIsErasing(false)}
            activeOpacity={0.8}
          >
            <Text style={[styles.modeBtnText, !isErasing && styles.modeBtnTextActive]}>
              Dibujar
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, isErasing && styles.modeBtnActive]}
            onPress={() => setIsErasing(true)}
            activeOpacity={0.8}
          >
            <Text style={[styles.modeBtnText, isErasing && styles.modeBtnTextActive]}>
              Goma
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Canvas de dibujo ──────────────────────────────────────── */}
        <DrawingCanvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          isErasing={isErasing}
          onToggleEraser={handleToggleEraser}
          onStrokeEnd={() => setHasDrawn(true)}
        />
        <Text style={styles.canvasHint}>
          {isFull
            ? 'Máximo de variaciones alcanzado para este carácter'
            : 'Escribe el carácter con tu lápiz o dedo'}
        </Text>

        {/* ── Trazos guardados ──────────────────────────────────────── */}
        {currentStrokes.length > 0 && (
          <View style={styles.savedSection}>
            <Text style={styles.savedLabel}>TRAZOS GUARDADOS — toca uno para eliminar</Text>
            <View style={styles.savedRow}>
              {currentStrokes.map((dataUrl, idx) => (
                <StrokeThumbnail
                  key={idx}
                  dataUrl={dataUrl}
                  onDelete={() => deleteStroke(currentChar, idx)}
                />
              ))}
            </View>
          </View>
        )}

        {/* ── Botones de acción ─────────────────────────────────────── */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.btnSecondary} onPress={handleClear}>
            <Text style={styles.btnSecondaryText}>Borrar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btnPrimary, (!hasDrawn || isFull) && styles.btnDisabled]}
            onPress={handleSave}
            disabled={!hasDrawn || isFull}
          >
            <Text style={styles.btnPrimaryText}>Guardar trazo</Text>
          </TouchableOpacity>
        </View>

        {/* ── Navegación prev / next dentro de la sección ──────────── */}
        <View style={styles.navRow}>
          <TouchableOpacity
            style={[styles.btnNav, currentIdx === firstInGroup && styles.btnDisabled]}
            onPress={handlePrev}
            disabled={currentIdx === firstInGroup}
          >
            <Text style={styles.btnNavText}>← Anterior</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.btnNav,
              (currentStrokes.length < MIN_VARIATIONS || currentIdx === lastInGroup) && styles.btnDisabled,
            ]}
            onPress={handleNext}
            disabled={currentStrokes.length < MIN_VARIATIONS || currentIdx === lastInGroup}
          >
            <Text style={styles.btnNavText}>Siguiente →</Text>
          </TouchableOpacity>
        </View>

        {/* ── Botón de finalizar ────────────────────────────────────── */}
        {captured >= 1 && (
          <TouchableOpacity
            style={[styles.btnFinish, done && styles.btnFinishReady]}
            onPress={handleFinish}
          >
            <Text style={[styles.btnFinishText, done && styles.btnFinishTextReady]}>
              {done ? '¡Listo! Empezar a usar la app' : 'Continuar con los caracteres capturados'}
            </Text>
          </TouchableOpacity>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.hueso,
  },
  scroll: { flex: 1 },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  headerTitle: {
    fontSize: fontSizes.lg,
    fontWeight: '500',
    color: colors.grafito,
  },
  countChip: {
    backgroundColor: '#EEEDFE',
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
    borderWidth: borderWidth.normal,
    borderColor: '#AFA9EC',
  },
  countChipText: {
    fontSize: fontSizes.xs,
    color: '#3C3489',
    fontWeight: '500',
  },

  // Progreso
  progressTrack: {
    height: 4,
    backgroundColor: colors.borde,
    borderRadius: 2,
    marginBottom: spacing.xs,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.grafito,
    borderRadius: 2,
  },
  progressLabel: {
    fontSize: fontSizes.xs,
    color: colors.piedra,
    marginBottom: spacing.md,
  },

  // Tabs de sección
  tabs: {
    flexDirection: 'row',
    borderRadius: radius.md,
    borderWidth: borderWidth.thin,
    borderColor: colors.borde,
    overflow: 'hidden',
    marginBottom: spacing.sm,
    backgroundColor: colors.hueso2,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: 4,
    alignItems: 'center',
    gap: 2,
  },
  tabActive: {
    backgroundColor: colors.grafito,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: colors.carbon,
    textAlign: 'center',
  },
  tabLabelActive: {
    color: colors.hueso,
  },
  tabCount: {
    fontSize: 9,
    color: colors.piedra,
  },
  tabCountActive: {
    color: colors.piedra,
    opacity: 0.7,
  },

  // Barra de caracteres
  navScroll: { marginBottom: spacing.md },
  navContent: { gap: spacing.xs, paddingRight: spacing.md },
  navBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    borderWidth: borderWidth.thin,
    borderColor: colors.borde,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  navBtnActive: {
    backgroundColor: colors.grafito,
    borderColor: colors.grafito,
  },
  navBtnDone: {
    backgroundColor: colors.borde,
    borderColor: colors.borde,
  },
  navBtnPartial: {
    borderColor: colors.piedra,
  },
  navBtnText: {
    fontSize: fontSizes.sm,
    color: colors.carbon,
  },
  navBtnTextActive: {
    color: colors.hueso,
    fontWeight: '500',
  },

  // Carácter principal
  charDisplay: {
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  charBig: {
    fontSize: 72,
    fontWeight: '400',
    color: colors.grafito,
    lineHeight: 80,
  },
  charLabel: {
    fontSize: fontSizes.sm,
    color: colors.piedra,
    marginTop: spacing.xs,
  },

  // Puntitos
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.grafito,
    backgroundColor: 'transparent',
  },
  dotFilled: {
    backgroundColor: colors.grafito,
  },

  // Tips
  qualityTip: {
    backgroundColor: colors.hueso2,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
    borderWidth: borderWidth.thin,
    borderColor: colors.borde,
  },
  qualityTipText: {
    fontSize: fontSizes.xs,
    color: colors.piedra,
    textAlign: 'center',
  },
  // Toggle dibujo / goma
  modeToggle: {
    flexDirection: 'row',
    alignSelf: 'center',
    borderRadius: radius.full,
    borderWidth: borderWidth.thin,
    borderColor: colors.borde,
    overflow: 'hidden',
    marginBottom: spacing.sm,
    backgroundColor: colors.hueso2,
  },
  modeBtn: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xs + 2,
  },
  modeBtnActive: {
    backgroundColor: colors.grafito,
  },
  modeBtnText: {
    fontSize: fontSizes.sm,
    color: colors.carbon,
    fontWeight: '500',
  },
  modeBtnTextActive: {
    color: colors.hueso,
  },

  // Canvas
  canvasHint: {
    fontSize: fontSizes.xs,
    color: colors.piedra,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },

  // Trazos guardados
  savedSection: { marginBottom: spacing.md },
  savedLabel: {
    fontSize: fontSizes.xs,
    color: colors.piedra,
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  savedRow: {
    flexDirection: 'row',
    gap: spacing.md,
    flexWrap: 'wrap',
  },

  // Botones
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  btnSecondary: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: borderWidth.thin,
    borderColor: colors.borde,
    alignItems: 'center',
  },
  btnSecondaryText: {
    fontSize: fontSizes.md,
    color: colors.carbon,
  },
  btnPrimary: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.grafito,
    alignItems: 'center',
  },
  btnPrimaryText: {
    fontSize: fontSizes.md,
    color: colors.hueso,
    fontWeight: '500',
  },
  btnDisabled: {
    opacity: 0.35,
  },
  navRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  btnNav: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: borderWidth.thin,
    borderColor: colors.borde,
    alignItems: 'center',
  },
  btnNavText: {
    fontSize: fontSizes.md,
    color: colors.carbon,
  },
  btnFinish: {
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: borderWidth.normal,
    borderColor: colors.grafito,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  btnFinishReady: {
    backgroundColor: colors.grafito,
  },
  btnFinishText: {
    fontSize: fontSizes.md,
    color: colors.grafito,
    fontWeight: '500',
  },
  btnFinishTextReady: {
    color: colors.hueso,
  },
});
