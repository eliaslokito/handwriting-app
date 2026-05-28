/**
 * characters.js
 * Define todos los grupos de caracteres que el usuario debe capturar
 * durante el onboarding, en el orden en que se presentan.
 */

export const CHARACTER_GROUPS = [
  {
    id: 'uppercase',
    label: 'Mayúsculas',
    chars: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''),
  },
  {
    id: 'lowercase',
    label: 'Minúsculas',
    chars: 'abcdefghijklmnopqrstuvwxyz'.split(''),
  },
  {
    id: 'numbers',
    label: 'Números',
    chars: '0123456789'.split(''),
  },
  {
    id: 'punctuation',
    label: 'Puntuación',
    chars: ['.', ',', ';', ':', '?', '!', '¿', '¡', '"', "'", '(', ')', '[', ']', '-', '_', '/', '@', '#', '%', '&', '*', '+', '='],
  },
];

// Lista plana de todos los caracteres en orden
export const ALL_CHARS = CHARACTER_GROUPS.flatMap(g => g.chars);

// Total de caracteres a capturar
export const TOTAL_CHARS = ALL_CHARS.length;

// Número máximo de variaciones recomendadas por carácter
export const MAX_VARIATIONS = 3;

// Número mínimo requerido para continuar
export const MIN_VARIATIONS = 1;

/**
 * Devuelve el nombre legible de un carácter para mostrarlo en pantalla.
 * Ej: 'A' → 'A mayúscula', '.' → 'Punto'
 */
export const getCharLabel = (char) => {
  if ('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.includes(char)) return `${char} mayúscula`;
  if ('abcdefghijklmnopqrstuvwxyz'.includes(char)) return `${char} minúscula`;
  if ('0123456789'.includes(char)) return `Número ${char}`;

  const labels = {
    '.': 'Punto', ',': 'Coma', ';': 'Punto y coma', ':': 'Dos puntos',
    '?': 'Signo de interrogación', '!': 'Signo de exclamación',
    '¿': 'Apertura interrogación', '¡': 'Apertura exclamación',
    '"': 'Comillas dobles', "'": 'Comillas simples',
    '(': 'Paréntesis izquierdo', ')': 'Paréntesis derecho',
    '[': 'Corchete izquierdo', ']': 'Corchete derecho',
    '-': 'Guión', '_': 'Guión bajo', '/': 'Diagonal',
    '@': 'Arroba', '#': 'Numeral', '%': 'Porcentaje',
    '&': 'Ampersand', '*': 'Asterisco', '+': 'Más', '=': 'Igual',
  };
  return labels[char] || char;
};
