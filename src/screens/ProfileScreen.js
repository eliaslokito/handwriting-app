/**
 * ProfileScreen.js
 * Pantalla de perfil — muestra el estado de la fuente de letra
 * y permite rehacer la captura o agregar variaciones.
 */

import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { ALL_CHARS, TOTAL_CHARS, MAX_VARIATIONS, getCharLabel } from '../constants/characters';
import { colors, spacing, fontSizes, radius, borderWidth } from '../constants/theme';

export default function ProfileScreen({ navigation }) {
  const { strokesFor, capturedCount, resetAll } = useApp();
  const captured = capturedCount();

  const handleReset = () => {
    Alert.alert(
      'Rehacer captura de letra',
      'Esto eliminará todos los trazos guardados. ¿Continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sí, rehacer',
          style: 'destructive',
          onPress: () => {
            resetAll();
            navigation.replace('Onboarding');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>perfil</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Resumen ───────────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Fuente de letra</Text>
          <View style={styles.statRow}>
            <View style={styles.stat}>
              <Text style={styles.statNum}>{captured}</Text>
              <Text style={styles.statLabel}>Capturados</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statNum}>{TOTAL_CHARS - captured}</Text>
              <Text style={styles.statLabel}>Pendientes</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statNum}>{TOTAL_CHARS}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
          </View>
        </View>

        {/* ── Lista de caracteres ───────────────────────────────── */}
        <Text style={styles.sectionLabel}>ESTADO POR CARÁCTER</Text>

        {ALL_CHARS.map((char) => {
          const count = strokesFor(char).length;
          const isFull = count >= MAX_VARIATIONS;
          return (
            <TouchableOpacity
              key={char}
              style={styles.charRow}
              onPress={() => navigation.navigate('Onboarding', { startChar: char })}
            >
              <Text style={styles.charRowChar}>{char}</Text>
              <Text style={styles.charRowLabel}>{getCharLabel(char)}</Text>
              <View style={styles.charRowRight}>
                <View style={styles.miniDots}>
                  {Array.from({ length: MAX_VARIATIONS }).map((_, i) => (
                    <View key={i} style={[styles.miniDot, i < count && styles.miniDotFilled]} />
                  ))}
                </View>
                <Text style={[styles.charRowCount, isFull && styles.charRowCountFull]}>
                  {count}/{MAX_VARIATIONS}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}

        {/* ── Botón de rehacer ──────────────────────────────────── */}
        <TouchableOpacity style={styles.btnReset} onPress={handleReset}>
          <Text style={styles.btnResetText}>Rehacer captura de letra</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
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
  headerTitle: {
    fontSize: fontSizes.lg,
    color: colors.hueso,
    fontWeight: '400',
    letterSpacing: 0.2,
  },
  backBtn: { width: 60 },
  backBtnText: { fontSize: fontSizes.sm, color: colors.piedra },

  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },

  // Card resumen
  card: {
    backgroundColor: colors.hueso2,
    borderRadius: radius.lg,
    borderWidth: borderWidth.thin,
    borderColor: colors.borde,
    padding: spacing.lg,
  },
  cardTitle: {
    fontSize: fontSizes.md,
    fontWeight: '500',
    color: colors.grafito,
    marginBottom: spacing.md,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  stat: { alignItems: 'center', gap: 4 },
  statNum: { fontSize: fontSizes.xxl, fontWeight: '500', color: colors.grafito },
  statLabel: { fontSize: fontSizes.xs, color: colors.piedra },
  statDivider: { width: 1, height: 32, backgroundColor: colors.borde },

  // Lista de caracteres
  sectionLabel: {
    fontSize: fontSizes.xs,
    color: colors.piedra,
    letterSpacing: 0.7,
  },
  charRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: borderWidth.thin,
    borderBottomColor: colors.borde,
    gap: spacing.md,
  },
  charRowChar: {
    fontSize: fontSizes.xl,
    fontWeight: '500',
    color: colors.grafito,
    width: 32,
    textAlign: 'center',
  },
  charRowLabel: {
    flex: 1,
    fontSize: fontSizes.sm,
    color: colors.carbon,
  },
  charRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  miniDots: { flexDirection: 'row', gap: 3 },
  miniDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.grafito,
    backgroundColor: 'transparent',
  },
  miniDotFilled: { backgroundColor: colors.grafito },
  charRowCount: { fontSize: fontSizes.xs, color: colors.piedra, width: 28 },
  charRowCountFull: { color: colors.grafito, fontWeight: '500' },

  // Botón reset
  btnReset: {
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: borderWidth.normal,
    borderColor: colors.error,
    alignItems: 'center',
  },
  btnResetText: {
    fontSize: fontSizes.md,
    color: colors.error,
  },
});
