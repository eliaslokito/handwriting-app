/**
 * SizeSlider.js
 * Slider vertical para controlar grosor de lápiz o radio de goma.
 *
 * Mover hacia arriba aumenta el valor, hacia abajo lo disminuye.
 * Al lado del track se muestra un círculo de previsualización en tiempo real.
 * El lápiz muestra círculo relleno; la goma muestra círculo solo con borde.
 */

import React, { useRef, useMemo, useCallback } from 'react';
import { View, Text, PanResponder, StyleSheet } from 'react-native';
import { colors, fontSizes, borderWidth } from '../constants/theme';

const TRACK_H  = 88;  // altura de la pista en px
const THUMB_R  = 9;   // radio del pulgar
const TRACK_W  = 4;   // ancho de la pista

export default function SizeSlider({ value, min, max, onValueChange, label, isEraser }) {
  const minRef      = useRef(min);
  const maxRef      = useRef(max);
  const onChangeRef = useRef(onValueChange);
  const valueRef    = useRef(value);
  const startValRef = useRef(value);

  minRef.current      = min;
  maxRef.current      = max;
  onChangeRef.current = onValueChange;
  valueRef.current    = value;

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder:  () => true,
    onPanResponderGrant: () => {
      startValRef.current = valueRef.current;
    },
    onPanResponderMove: (_, gs) => {
      // dy negativo = movimiento hacia arriba = valor mayor
      const range  = maxRef.current - minRef.current;
      const delta  = (-gs.dy / TRACK_H) * range;
      const raw    = startValRef.current + delta;
      const newVal = Math.max(minRef.current, Math.min(maxRef.current, raw));
      onChangeRef.current(newVal);
    },
  }), []);

  // Posición del thumb: 0 = top (max), TRACK_H = bottom (min)
  const norm     = (value - min) / (max - min);
  const fillH    = TRACK_H * norm;
  const thumbTop = TRACK_H * (1 - norm) - THUMB_R;

  // Tamaño del círculo de previsualización (capado para que quepa)
  const previewD = isEraser
    ? Math.min(56, Math.max(6,  value * 2))   // diámetro = radio * 2
    : Math.min(40, Math.max(3,  value * 3.5)); // lápiz: escalado para visibilidad

  return (
    <View style={styles.col}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.body}>
        {/* Track vertical con thumb arrastratable */}
        <View style={styles.trackHitArea} {...panResponder.panHandlers}>
          <View style={[styles.trackBg, { height: TRACK_H }]}>
            <View style={[styles.trackFill, { height: fillH }]} />
          </View>
          <View style={[styles.thumb, { top: thumbTop }]} />
        </View>

        {/* Círculo de previsualización */}
        <View style={styles.previewArea}>
          <View style={[
            styles.previewCircle,
            {
              width:           previewD,
              height:          previewD,
              borderRadius:    previewD / 2,
              borderWidth:     isEraser ? borderWidth.thick : 0,
              backgroundColor: isEraser ? 'transparent' : colors.grafito,
            },
          ]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  col: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  label: {
    fontSize: fontSizes.xs,
    color: colors.piedra,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  // Área de toque más ancha que la pista visual para facilitar arrastre
  trackHitArea: {
    width: THUMB_R * 2 + 16,
    height: TRACK_H,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trackBg: {
    position: 'absolute',
    width: TRACK_W,
    borderRadius: TRACK_W / 2,
    backgroundColor: '#D8D6CE',
    overflow: 'hidden',
    justifyContent: 'flex-end', // relleno desde abajo
  },
  trackFill: {
    width: '100%',
    backgroundColor: colors.grafito,
    borderRadius: TRACK_W / 2,
  },
  thumb: {
    position: 'absolute',
    width:  THUMB_R * 2,
    height: THUMB_R * 2,
    borderRadius: THUMB_R,
    backgroundColor: colors.grafito,
    borderWidth: 2.5,
    borderColor: colors.hueso,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  previewArea: {
    width:  60,
    height: TRACK_H,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewCircle: {
    borderColor: colors.grafito,
  },
});
