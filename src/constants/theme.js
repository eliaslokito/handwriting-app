/**
 * theme.js
 * Design tokens de la app — paleta grafito/hueso, tipografía Instrument.
 * Toda referencia a color o espaciado debe venir de aquí.
 */

export const colors = {
  // Paleta principal
  grafito:  '#1C1C1A', // fondos oscuros, header, botones primarios
  carbon:   '#3A3A38', // texto principal, íconos secundarios
  piedra:   '#888780', // texto secundario, etiquetas, bordes
  hueso:    '#F2EFE6', // fondo general de la app
  hueso2:   '#FAFAF7', // superficies elevadas (inputs, cards)
  borde:    '#C8C6BD', // bordes sutiles

  // Utilidades
  blanco:   '#FFFFFF',
  error:    '#C0392B',
  exito:    '#2E7D32',
};

export const typography = {
  // Instrument Serif — logo y display
  serif: 'InstrumentSerif-Regular',
  serifItalic: 'InstrumentSerif-Italic',

  // Instrument Sans — UI general
  sansRegular: 'InstrumentSans-Regular',
  sansMedium:  'InstrumentSans-Medium',
};

export const fontSizes = {
  xs:   10,
  sm:   12,
  md:   14,
  base: 16,
  lg:   18,
  xl:   22,
  xxl:  28,
  hero: 36,
};

export const spacing = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  24,
  xxl: 32,
};

export const radius = {
  sm:   6,
  md:   8,
  lg:   12,
  xl:   16,
  full: 999,
};

export const borderWidth = {
  thin:   0.5,
  normal: 1,
  thick:  1.5,
};
