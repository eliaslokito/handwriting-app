/**
 * MainScreen.js
 * Pantalla principal de la app — donde el usuario genera sus apuntes.
 *
 * Secciones:
 * - Área de texto para pegar o escribir el contenido
 * - Selector de formato de hoja (cuadriculada, rayada, en blanco)
 * - Selector de tamaño de letra (pequeño, mediano, grande)
 * - Botón de generar apunte
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { colors, spacing, fontSizes, radius, borderWidth } from '../constants/theme';

// Opciones de formato de hoja
const SHEET_FORMATS = [
  { id: 'lined',   label: 'Rayada' },
  { id: 'grid',    label: 'Cuadriculada' },
  { id: 'blank',   label: 'En blanco' },
];

// Opciones de tamaño de letra
const FONT_SIZES = [
  { id: 'small',  label: 'Pequeño' },
  { id: 'medium', label: 'Mediano' },
  { id: 'large',  label: 'Grande' },
];

export default function MainScreen({ navigation }) {
  const { strokesFor } = useApp();

  const [text,       setText]       = useState('');
  const [sheetFormat, setSheetFormat] = useState('lined');
  const [fontSize,   setFontSize]   = useState('medium');

  const handleGenerate = () => {
    if (!text.trim()) {
      Alert.alert('Texto vacío', 'Escribe o pega el texto que quieres convertir en apunte.');
      return;
    }
    navigation.navigate('Preview', { text, sheetFormat, fontSize });
  };

  return (
    <SafeAreaView style={styles.safe}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>nuevo apunte</Text>
        <TouchableOpacity
          style={styles.profileBtn}
          onPress={() => navigation.navigate('Profile')}
        >
          <Text style={styles.profileBtnText}>Perfil</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

        {/* ── Área de texto ─────────────────────────────────────── */}
        <Text style={styles.label}>TEXTO A TRANSCRIBIR</Text>
        <TextInput
          style={styles.textInput}
          value={text}
          onChangeText={setText}
          placeholder="Pega o escribe aquí el contenido que quieres convertir en apunte..."
          placeholderTextColor={colors.piedra}
          multiline
          textAlignVertical="top"
        />

        {/* ── Formato de hoja ───────────────────────────────────── */}
        <Text style={styles.label}>FORMATO DE HOJA</Text>
        <View style={styles.chipRow}>
          {SHEET_FORMATS.map(opt => (
            <TouchableOpacity
              key={opt.id}
              style={[styles.chip, sheetFormat === opt.id && styles.chipActive]}
              onPress={() => setSheetFormat(opt.id)}
            >
              <Text style={[styles.chipText, sheetFormat === opt.id && styles.chipTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Tamaño de letra ───────────────────────────────────── */}
        <Text style={styles.label}>TAMAÑO DE LETRA</Text>
        <View style={styles.chipRow}>
          {FONT_SIZES.map(opt => (
            <TouchableOpacity
              key={opt.id}
              style={[styles.chip, fontSize === opt.id && styles.chipActive]}
              onPress={() => setFontSize(opt.id)}
            >
              <Text style={[styles.chipText, fontSize === opt.id && styles.chipTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Botón generar ─────────────────────────────────────── */}
        <TouchableOpacity
          style={[styles.btnGenerate, !text.trim() && styles.btnDisabled]}
          onPress={handleGenerate}
          disabled={!text.trim()}
        >
          <Text style={styles.btnGenerateText}>generar apunte</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.hueso,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.grafito,
  },
  headerTitle: {
    fontSize: fontSizes.lg,
    fontWeight: '400',
    color: colors.hueso,
    letterSpacing: 0.2,
  },
  profileBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: borderWidth.thin,
    borderColor: colors.piedra,
  },
  profileBtnText: {
    fontSize: fontSizes.sm,
    color: colors.piedra,
  },

  scroll: { flex: 1 },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
  },

  // Etiquetas de sección
  label: {
    fontSize: fontSizes.xs,
    color: colors.piedra,
    letterSpacing: 0.7,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },

  // Input de texto
  textInput: {
    backgroundColor: colors.hueso2,
    borderRadius: radius.md,
    borderWidth: borderWidth.thin,
    borderColor: colors.borde,
    padding: spacing.md,
    fontSize: fontSizes.md,
    color: colors.carbon,
    minHeight: 140,
    lineHeight: 22,
  },

  // Chips de selección
  chipRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.full,
    borderWidth: borderWidth.thin,
    borderColor: colors.borde,
    backgroundColor: 'transparent',
  },
  chipActive: {
    backgroundColor: colors.grafito,
    borderColor: colors.grafito,
  },
  chipText: {
    fontSize: fontSizes.sm,
    color: colors.carbon,
  },
  chipTextActive: {
    color: colors.hueso,
    fontWeight: '500',
  },

  // Botón principal
  btnGenerate: {
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.grafito,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  btnGenerateText: {
    fontSize: fontSizes.md,
    color: colors.hueso,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  btnDisabled: {
    opacity: 0.35,
  },
});
