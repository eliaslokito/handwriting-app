/**
 * StrokeThumbnail.js
 * Miniatura de un trazo guardado con selección controlada por el padre.
 *
 * Props:
 *   dataUrl    — PNG base64 del trazo recortado
 *   isSelected — controlado desde afuera (selección exclusiva)
 *   onPress    — toggle selección
 *   onDelete   — eliminar este trazo (visible solo cuando isSelected)
 */

import React from 'react';
import {
  View,
  Image,
  TouchableOpacity,
  Text,
  StyleSheet,
} from 'react-native';
import { colors, radius, borderWidth } from '../constants/theme';

export default function StrokeThumbnail({ dataUrl, isSelected, onPress, onDelete }) {
  return (
    <View style={styles.wrapper}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        style={[styles.thumb, isSelected && styles.thumbSelected]}
      >
        <Image
          source={{ uri: dataUrl }}
          style={styles.image}
          resizeMode="contain"
        />

        {isSelected && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>✓</Text>
          </View>
        )}
      </TouchableOpacity>

      {isSelected && (
        <TouchableOpacity style={styles.deleteBtn} onPress={onDelete}>
          <Text style={styles.deleteBtnText}>Eliminar</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    gap: 6,
  },
  thumb: {
    width: 88,
    height: 88,
    backgroundColor: colors.hueso,
    borderRadius: radius.md,
    borderWidth: borderWidth.thick,
    borderColor: 'transparent',
    overflow: 'visible',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbSelected: {
    borderColor: colors.grafito,
  },
  image: {
    width: 80,
    height: 80,
  },
  badge: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.grafito,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.hueso2,
  },
  badgeText: {
    color: colors.hueso,
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 14,
  },
  deleteBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: borderWidth.normal,
    borderColor: colors.error,
  },
  deleteBtnText: {
    color: colors.error,
    fontSize: 11,
  },
});
