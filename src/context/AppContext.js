/**
 * AppContext.js
 * Estado global de la app mediante React Context.
 * Maneja: trazos capturados por carácter, estado del onboarding,
 * y persistencia local con expo-file-system.
 */

import React, { createContext, useContext, useReducer, useEffect } from 'react';
import * as FileSystem from 'expo-file-system';
import { ALL_CHARS } from '../constants/characters';

// ─── Ruta de almacenamiento local ───────────────────────────────────────────
const STORAGE_PATH = FileSystem.documentDirectory + 'handwriting_font.json';

// ─── Estado inicial ──────────────────────────────────────────────────────────
const buildInitialStrokes = () => {
  const strokes = {};
  ALL_CHARS.forEach(char => { strokes[char] = []; });
  return strokes;
};

const initialState = {
  strokes: buildInitialStrokes(), // { 'A': ['dataUrl1', 'dataUrl2', ...], ... }
  onboardingComplete: false,
  isLoading: true,
};

// ─── Reducer ─────────────────────────────────────────────────────────────────
const ACTION = {
  LOAD_DATA:           'LOAD_DATA',
  ADD_STROKE:          'ADD_STROKE',
  DELETE_STROKE:       'DELETE_STROKE',
  COMPLETE_ONBOARDING: 'COMPLETE_ONBOARDING',
  RESET:               'RESET',
};

function reducer(state, action) {
  switch (action.type) {

    case ACTION.LOAD_DATA:
      return {
        ...state,
        strokes: action.payload.strokes ?? buildInitialStrokes(),
        onboardingComplete: action.payload.onboardingComplete ?? false,
        isLoading: false,
      };

    case ACTION.ADD_STROKE: {
      const { char, dataUrl } = action.payload;
      return {
        ...state,
        strokes: {
          ...state.strokes,
          [char]: [...(state.strokes[char] ?? []), dataUrl],
        },
      };
    }

    case ACTION.DELETE_STROKE: {
      const { char, index } = action.payload;
      const updated = [...(state.strokes[char] ?? [])];
      updated.splice(index, 1);
      return {
        ...state,
        strokes: { ...state.strokes, [char]: updated },
      };
    }

    case ACTION.COMPLETE_ONBOARDING:
      return { ...state, onboardingComplete: true };

    case ACTION.RESET:
      return { ...initialState, strokes: buildInitialStrokes(), isLoading: false };

    default:
      return state;
  }
}

// ─── Context ─────────────────────────────────────────────────────────────────
const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    loadFromDisk();
  }, []);

  useEffect(() => {
    if (!state.isLoading) {
      saveToDisk(state);
    }
  }, [state.strokes, state.onboardingComplete]);

  async function loadFromDisk() {
    try {
      const info = await FileSystem.getInfoAsync(STORAGE_PATH);
      if (info.exists) {
        const raw = await FileSystem.readAsStringAsync(STORAGE_PATH, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        const parsed = JSON.parse(raw);
        dispatch({ type: ACTION.LOAD_DATA, payload: parsed });
      } else {
        dispatch({ type: ACTION.LOAD_DATA, payload: {} });
      }
    } catch (e) {
      console.warn('Error cargando datos:', e);
      dispatch({ type: ACTION.LOAD_DATA, payload: {} });
    }
  }

  async function saveToDisk(currentState) {
    try {
      const data = {
        strokes: currentState.strokes,
        onboardingComplete: currentState.onboardingComplete,
      };
      await FileSystem.writeAsStringAsync(STORAGE_PATH, JSON.stringify(data), {
        encoding: FileSystem.EncodingType.UTF8,
      });
    } catch (e) {
      console.warn('Error guardando datos:', e);
    }
  }

  // ─── Acciones públicas ──────────────────────────────────────────────
  const addStroke = (char, dataUrl) =>
    dispatch({ type: ACTION.ADD_STROKE, payload: { char, dataUrl } });

  const deleteStroke = (char, index) =>
    dispatch({ type: ACTION.DELETE_STROKE, payload: { char, index } });

  const completeOnboarding = () =>
    dispatch({ type: ACTION.COMPLETE_ONBOARDING });

  const resetAll = () =>
    dispatch({ type: ACTION.RESET });

  // ─── Helpers de consulta ────────────────────────────────────────────

  const capturedCount = () =>
    ALL_CHARS.filter(c => (state.strokes[c]?.length ?? 0) > 0).length;

  const progress = () => capturedCount() / ALL_CHARS.length;

  const strokesFor = (char) => state.strokes[char] ?? [];

  return (
    <AppContext.Provider value={{
      ...state,
      addStroke,
      deleteStroke,
      completeOnboarding,
      resetAll,
      capturedCount,
      progress,
      strokesFor,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp debe usarse dentro de <AppProvider>');
  return ctx;
};
