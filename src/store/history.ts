import type { ProjectDocument } from '../domain';

export const MAX_HISTORY_ENTRIES = 100;

export interface HistoryState<T> {
  past: T[];
  future: T[];
}

export function cloneDocument(document: ProjectDocument): ProjectDocument {
  return structuredClone(document);
}

export function createEmptyHistory<T>(): HistoryState<T> {
  return { past: [], future: [] };
}

export function pushHistory<T>(
  history: HistoryState<T>,
  previousSnapshot: T,
  maxEntries = MAX_HISTORY_ENTRIES,
): HistoryState<T> {
  const nextPast = [...history.past, previousSnapshot];
  if (nextPast.length > maxEntries) {
    nextPast.shift();
  }
  return {
    past: nextPast,
    future: [],
  };
}

export function undoHistory<T>(
  history: HistoryState<T>,
  current: T,
): { nextCurrent: T; nextHistory: HistoryState<T> } | null {
  if (history.past.length === 0) return null;
  const previous = history.past[history.past.length - 1];
  return {
    nextCurrent: previous,
    nextHistory: {
      past: history.past.slice(0, -1),
      future: [current, ...history.future],
    },
  };
}

export function redoHistory<T>(
  history: HistoryState<T>,
  current: T,
): { nextCurrent: T; nextHistory: HistoryState<T> } | null {
  if (history.future.length === 0) return null;
  const next = history.future[0];
  return {
    nextCurrent: next,
    nextHistory: {
      past: [...history.past, current],
      future: history.future.slice(1),
    },
  };
}

export function canUndo<T>(history: HistoryState<T>): boolean {
  return history.past.length > 0;
}

export function canRedo<T>(history: HistoryState<T>): boolean {
  return history.future.length > 0;
}
