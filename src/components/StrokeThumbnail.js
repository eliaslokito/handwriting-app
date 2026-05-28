/**
 * StrokeThumbnail.js
 * Miniatura de un trazo guardado con selección y eliminación.
 *
 * Comportamiento:
 * - Primer toque  → selecciona (borde rojo + ×)
 * - Segundo toque → deselecciona (cancela)
 * - Botón rojo    → confirma eliminación
 *
 * La imagen recibe un PNG ya recortado al bounding box del trazo,
 * por lo que se muestra grande y limpio con resizeMode="contain".
 */

import React, { useState } from 'react';
import {
  View,
  Image,
  TouchableOpacity,
  Text,
  StyleSheet,
} from 'react-native';
import { colors, radius, borderWidth } from '../constants/theme';

export default function StrokeThumbnail({ dataUrl, onDelete }) {
  const [selected, setSelected] = useState(false);

  const handlePress   = () => setSelected(prev => !prev);
  const handleDelete  = () => { setSelected(false); onDelete(); };

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.8}
        style={[styles.thumb, selected && styles.thumbSelected]}
      >
        <Image
          source={{ uri: dataUrl }}
          style={styles.image}
          resizeMode="contain"
        />

        {selected && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>×</Text>
          </View>
        )}
      </TouchableOpacity>

      {selected && (
        <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
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
    borderColor: colors.error,
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
    backgroundColor: colors.error,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.hueso2,
  },
  badgeText: {
    color: colors.blanco,
    fontSize: 13,
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
