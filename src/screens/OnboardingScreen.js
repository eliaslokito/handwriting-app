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
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import DrawingCanvas from '../components/DrawingCanvas';
import StrokeThumbnail from '../components/StrokeThumbnail';
import SizeSlider from '../components/SizeSlider';
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

// Altura del contenedor del slider cuando está abierto
const SLIDER_PANEL_H = 132;

// Helpers para el nuevo formato de stroke: { dataUrl, paths } o string (legado)
const getStrokeDataUrl = (stroke) =>
  typeof stroke === 'string' ? stroke : (stroke?.dataUrl ?? '');
const getStrokePaths = (stroke) =>
  typeof stroke === 'object' && Array.isArray(stroke?.paths) ? stroke.paths : [];

// Índice global del primer carácter de cada grupo
const GROUP_OFFSETS = CHARACTER_GROUPS.map((_, i) =>
  CHARACTER_GROUPS.slice(0, i).reduce((sum, g) => sum + g.chars.length, 0)
);

export default function OnboardingScreen({ navigation }) {
  const { strokesFor, addStroke, deleteStroke, replaceStroke, completeOnboarding, capturedCount } = useApp();

  const [currentIdx,        setCurrentIdx]        = useState(0);
  const [hasDrawn,          setHasDrawn]          = useState(false);
  const [isErasing,         setIsErasing]         = useState(false);
  const [selectedStrokeIdx, setSelectedStrokeIdx] = useState(null);
  const [penWidth,          setPenWidth]          = useState(2.5);
  const [eraserRad,         setEraserRad]         = useState(16);
  const [sliderFor,         setSliderFor]         = useState(null); // 'pen' | 'eraser' | null
  const sliderAnim       = useRef(new Animated.Value(0)).current;
  const tabIndicatorAnim = useRef(new Animated.Value(0)).current;
  const btnAnim          = useRef(new Animated.Value(0)).current;
  const tabContainerW    = useRef(0);
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

  // Animar el indicador de tab activo al cambiar de sección
  useEffect(() => {
    const tabW = tabContainerW.current / CHARACTER_GROUPS.length;
    Animated.spring(tabIndicatorAnim, {
      toValue: activeGroupIdx * tabW,
      useNativeDriver: true,
      tension: 320,
      friction: 32,
    }).start();
  }, [activeGroupIdx, tabIndicatorAnim]);

  // ─── Guardar / actualizar trazo ──────────────────────────────────────
  const handleSave = useCallback(async () => {
    const dataUrl = await canvasRef.current?.toDataUrl();
    if (!dataUrl) return;
    const { paths, bbox } = canvasRef.current?.getPaths() ?? { paths: [], bbox: null };
    const stroke = { dataUrl, paths, bbox };

    if (selectedStrokeIdx !== null) {
      replaceStroke(currentChar, selectedStrokeIdx, stroke);
      setSelectedStrokeIdx(null);
    } else {
      if (!hasDrawn || isFull) return;
      addStroke(currentChar, stroke);
    }
    canvasRef.current?.clear();
    setHasDrawn(false);
  }, [hasDrawn, isFull, currentChar, addStroke, replaceStroke, selectedStrokeIdx]);

  // ─── Animación del panel de slider ───────────────────────────────────
  const openSlider = useCallback((tool) => {
    setSliderFor(tool);
    Animated.timing(sliderAnim, {
      toValue: SLIDER_PANEL_H,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [sliderAnim]);

  const closeSlider = useCallback((cb) => {
    Animated.timing(sliderAnim, {
      toValue: 0,
      duration: 170,
      useNativeDriver: false,
    }).start(() => { setSliderFor(null); cb?.(); });
  }, [sliderAnim]);

  // ─── Íconos de herramienta ────────────────────────────────────────────
  const handlePenIconPress = useCallback(() => {
    if (isErasing) {
      setIsErasing(false);
      closeSlider();
    } else {
      if (sliderFor === 'pen') {
        closeSlider();
      } else if (sliderFor === 'eraser') {
        closeSlider(() => openSlider('pen'));
      } else {
        openSlider('pen');
      }
    }
  }, [isErasing, sliderFor, openSlider, closeSlider]);

  const handleEraserIconPress = useCallback(() => {
    if (!isErasing) {
      setIsErasing(true);
      closeSlider();
    } else {
      if (sliderFor === 'eraser') {
        closeSlider();
      } else if (sliderFor === 'pen') {
        closeSlider(() => openSlider('eraser'));
      } else {
        openSlider('eraser');
      }
    }
  }, [isErasing, sliderFor, openSlider, closeSlider]);

  // ─── Botón lateral S Pen ──────────────────────────────────────────────
  const handleToggleEraser = useCallback(() => {
    setIsErasing(prev => !prev);
    closeSlider();
  }, [closeSlider]);

  // ─── Selección de trazo guardado para edición ────────────────────────
  const handleThumbnailPress = useCallback((idx) => {
    if (selectedStrokeIdx === idx) {
      setSelectedStrokeIdx(null);
      canvasRef.current?.clear();
      setHasDrawn(false);
    } else {
      setSelectedStrokeIdx(idx);
      const stroke = currentStrokes[idx];
      canvasRef.current?.loadPaths(getStrokePaths(stroke));
      setHasDrawn(false);
    }
  }, [selectedStrokeIdx, currentStrokes]);

  // ─── Navegar dentro del grupo activo ─────────────────────────────────
  const handleNext = useCallback(() => {
    if (currentIdx < lastInGroup) {
      setCurrentIdx(prev => prev + 1);
      setSelectedStrokeIdx(null);
      canvasRef.current?.clear();
      setHasDrawn(false);
    }
  }, [currentIdx, lastInGroup]);

  const handlePrev = useCallback(() => {
    if (currentIdx > firstInGroup) {
      setCurrentIdx(prev => prev - 1);
      setSelectedStrokeIdx(null);
      canvasRef.current?.clear();
      setHasDrawn(false);
    }
  }, [currentIdx, firstInGroup]);

  // ─── Saltar al carácter tocado en la barra ────────────────────────────
  const handleNavPress = useCallback((globalIdx) => {
    setCurrentIdx(globalIdx);
    setSelectedStrokeIdx(null);
    canvasRef.current?.clear();
    setHasDrawn(false);
  }, []);

  // ─── Saltar al primer carácter de un tab ─────────────────────────────
  const handleTabPress = useCallback((groupIdx) => {
    setCurrentIdx(GROUP_OFFSETS[groupIdx]);
    setSelectedStrokeIdx(null);
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

  const isEditing   = selectedStrokeIdx !== null;
  const canSave     = isEditing || (hasDrawn && !isFull);
  const saveLabel   = isEditing ? 'Actualizar trazo' : 'Guardar trazo';
  // Botón se convierte en "Siguiente letra →" cuando el carácter ya tiene 3 variaciones
  const showNextBtn = isFull && !isEditing;

  // Animar la transición del botón Guardar ↔ Siguiente letra
  useEffect(() => {
    Animated.timing(btnAnim, {
      toValue: showNextBtn ? 1 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [showNextBtn, btnAnim]);

  const hintText  = isEditing
    ? 'Trazo cargado — usa la goma para borrar partes o añade trazos nuevos'
    : (isFull ? 'Máximo de variaciones alcanzado para este carácter' : 'Escribe el carácter con tu lápiz o dedo');

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

        {/* ── Tabs de sección con indicador deslizante ─────────────── */}
        <View
          style={styles.tabs}
          onLayout={(e) => {
            tabContainerW.current = e.nativeEvent.layout.width;
            // Posicionar el indicador sin animación en el primer layout
            tabIndicatorAnim.setValue(
              activeGroupIdx * (e.nativeEvent.layout.width / CHARACTER_GROUPS.length)
            );
          }}
        >
          {/* Indicador que se desliza detrás de los botones */}
          <Animated.View
            style={[
              styles.tabIndicator,
              { transform: [{ translateX: tabIndicatorAnim }] },
            ]}
          />

          {CHARACTER_GROUPS.map((group, i) => {
            const isActive      = i === activeGroupIdx;
            const groupCaptured = group.chars.filter(c => strokesFor(c).length > 0).length;
            return (
              <TouchableOpacity
                key={group.id}
                style={styles.tab}
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

        {/* ── Carácter actual con flechas de navegación ─────────────── */}
        <View style={styles.charNav}>
          <TouchableOpacity
            style={[styles.arrowBtn, currentIdx === firstInGroup && styles.arrowDisabled]}
            onPress={handlePrev}
            disabled={currentIdx === firstInGroup}
          >
            <Text style={styles.arrowText}>‹</Text>
          </TouchableOpacity>

          <View style={styles.charDisplay}>
            <Text style={styles.charBig}>{currentChar}</Text>
            <Text style={styles.charLabel}>{getCharLabel(currentChar)}</Text>
          </View>

          <TouchableOpacity
            style={[
              styles.arrowBtn,
              (currentStrokes.length < MIN_VARIATIONS || currentIdx === lastInGroup) && styles.arrowDisabled,
            ]}
            onPress={handleNext}
            disabled={currentStrokes.length < MIN_VARIATIONS || currentIdx === lastInGroup}
          >
            <Text style={styles.arrowText}>›</Text>
          </TouchableOpacity>
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

        {/* ── Íconos de herramienta (lápiz / goma) ─────────────────── */}
        <View style={styles.toolIcons}>
          <TouchableOpacity
            style={[styles.toolIconBtn, !isErasing && styles.toolIconBtnActive]}
            onPress={handlePenIconPress}
            activeOpacity={0.8}
          >
            <Text style={[styles.toolIconText, !isErasing && styles.toolIconTextActive]}>✏</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toolIconBtn, isErasing && styles.toolIconBtnActive]}
            onPress={handleEraserIconPress}
            activeOpacity={0.8}
          >
            <View style={[styles.eraserIcon, isErasing && styles.eraserIconActive]} />
          </TouchableOpacity>
        </View>

        {/* ── Panel de slider animado — un slider a la vez ─────────── */}
        <Animated.View style={[styles.sliderPanel, { height: sliderAnim }]}>
          {sliderFor === 'pen' && (
            <SizeSlider
              label="Grosor del lápiz"
              value={penWidth}
              min={1}
              max={12}
              onValueChange={setPenWidth}
              isEraser={false}
            />
          )}
          {sliderFor === 'eraser' && (
            <SizeSlider
              label="Tamaño de la goma"
              value={eraserRad}
              min={3}
              max={40}
              onValueChange={setEraserRad}
              isEraser={true}
            />
          )}
        </Animated.View>

        {/* ── Canvas de dibujo ──────────────────────────────────────── */}
        <DrawingCanvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          isErasing={isErasing}
          onToggleEraser={handleToggleEraser}
          onStrokeEnd={() => setHasDrawn(true)}
          strokeWidth={penWidth}
          eraserRadius={eraserRad}
        />
        <Text style={styles.canvasHint}>{hintText}</Text>

        {/* ── Trazos guardados — toca para editar, selección exclusiva ─ */}
        {currentStrokes.length > 0 && (
          <View style={styles.savedSection}>
            <Text style={styles.savedLabel}>
              TRAZOS GUARDADOS — toca uno para editarlo
            </Text>
            <View style={styles.savedRow}>
              {currentStrokes.map((stroke, idx) => (
                <StrokeThumbnail
                  key={idx}
                  dataUrl={getStrokeDataUrl(stroke)}
                  isSelected={selectedStrokeIdx === idx}
                  onPress={() => handleThumbnailPress(idx)}
                  onDelete={() => {
                    setSelectedStrokeIdx(null);
                    canvasRef.current?.clear();
                    setHasDrawn(false);
                    deleteStroke(currentChar, idx);
                  }}
                />
              ))}
            </View>
          </View>
        )}

        {/* ── Guardar / Actualizar trazo / Siguiente letra ─────────── */}
        <TouchableOpacity
          onPress={showNextBtn ? handleNext : handleSave}
          disabled={!showNextBtn && !canSave}
          activeOpacity={0.8}
        >
          <Animated.View
            style={[
              styles.btnSave,
              !showNextBtn && !canSave && styles.btnDisabled,
              {
                backgroundColor: btnAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [colors.grafito, '#8B6F47'],
                }),
              },
            ]}
          >
            <View style={styles.btnSaveInner}>
              <Animated.Text
                style={[
                  styles.btnSaveText,
                  {
                    position: 'absolute',
                    opacity: btnAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
                  },
                ]}
              >
                {saveLabel}
              </Animated.Text>
              <Animated.Text
                style={[styles.btnSaveText, styles.btnNextText, { position: 'absolute', opacity: btnAnim }]}
              >
                Siguiente letra →
              </Animated.Text>
            </View>
          </Animated.View>
        </TouchableOpacity>

      </ScrollView>

      {/* ── Botón continuar — fijo en esquina inferior derecha ───── */}
      {captured >= 1 && (
        <TouchableOpacity
          style={[styles.btnFinish, done && styles.btnFinishReady]}
          onPress={handleFinish}
        >
          <Text style={[styles.btnFinishText, done && styles.btnFinishTextReady]}>
            {done ? '¡Listo! →' : 'Continuar →'}
          </Text>
        </TouchableOpacity>
      )}

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
    paddingBottom: 80,
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
  // Indicador deslizante — detrás de los botones en el árbol JSX
  tabIndicator: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: `${100 / CHARACTER_GROUPS.length}%`,
    backgroundColor: colors.grafito,
    borderRadius: radius.md - 1,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: 4,
    alignItems: 'center',
    gap: 2,
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

  // Carácter con flechas pegadas a los lados
  charNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.lg,
  },
  arrowBtn: {
    paddingHorizontal: spacing.sm,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radius.md,
  },
  arrowDisabled: {
    opacity: 0.18,
  },
  arrowText: {
    fontSize: 36,
    color: colors.grafito,
    lineHeight: 44,
  },
  charDisplay: {
    alignItems: 'center',
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

  // Íconos de herramienta
  toolIcons: {
    flexDirection: 'row',
    alignSelf: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  toolIconBtn: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: borderWidth.normal,
    borderColor: colors.borde,
    backgroundColor: colors.hueso2,
  },
  toolIconBtnActive: {
    backgroundColor: colors.grafito,
    borderColor: colors.grafito,
  },
  toolIconText: {
    fontSize: 22,
    color: colors.carbon,
  },
  toolIconTextActive: {
    color: colors.hueso,
  },
  eraserIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.carbon,
    backgroundColor: 'transparent',
  },
  eraserIconActive: {
    borderColor: colors.hueso,
  },
  // Panel animado del slider
  sliderPanel: {
    overflow: 'hidden',
    marginBottom: spacing.xs,
    justifyContent: 'center',
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

  // Guardar trazo — prominente y ancho completo
  btnSave: {
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.grafito,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  // Contenedor de altura fija para el crossfade de textos absolutamente posicionados
  btnSaveInner: {
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnSaveText: {
    fontSize: fontSizes.base,
    color: colors.hueso,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  btnNextText: {
    color: '#F2EFE6',
  },
  btnDisabled: {
    opacity: 0.35,
  },

  // Botón continuar — posición fija en esquina inferior derecha
  btnFinish: {
    position: 'absolute',
    bottom: spacing.xl,
    right: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: borderWidth.normal,
    borderColor: colors.grafito,
    backgroundColor: colors.hueso,
  },
  btnFinishReady: {
    backgroundColor: colors.grafito,
    borderColor: colors.grafito,
  },
  btnFinishText: {
    fontSize: fontSizes.sm,
    color: colors.grafito,
    fontWeight: '500',
  },
  btnFinishTextReady: {
    color: colors.hueso,
  },
});
