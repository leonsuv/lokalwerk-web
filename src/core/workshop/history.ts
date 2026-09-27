/**
 * Verlauf der PDF-Werkstatt: Liste unveränderlicher Zustände mit Grenze (W7: 100 Schritte).
 * Rückgängig und Wiederholen tauschen nur den aktuellen Zustand aus.
 *
 * Quellen werden freigegeben (pdf.js-Dokument schließen, Bytes im Worker löschen), sobald
 * kein Zustand im Verlauf und nichts in der internen Ablage mehr auf sie verweist
 * (releasedSources). Das gilt auch für Quellen, die in Stufe 2 durch „Einbacken“ entstehen.
 */

import type { Command, CommandResult } from './commands.ts';
import { EMPTY_STATE, type IdSource, type SourceId, type WorkshopState } from './model.ts';

export const HISTORY_LIMIT = 100;

export interface HistoryEntry {
  state: WorkshopState;
  /** Name des Befehls, der zu diesem Zustand geführt hat („Rückgängig: Drehen“) */
  label: string;
}

export interface History {
  past: readonly HistoryEntry[];
  present: HistoryEntry;
  future: readonly HistoryEntry[];
  limit: number;
  /** Ältere Schritte sind wegen der Grenze weggefallen (Hinweis in der Oberfläche) */
  truncated: boolean;
}

export function createHistory(state = EMPTY_STATE, limit = HISTORY_LIMIT): History {
  return { past: [], present: { state, label: '' }, future: [], limit, truncated: false };
}

/**
 * Befehl ausführen. Ändert er nichts, bleibt der Verlauf derselbe (kein leerer Schritt,
 * Wiederholen bleibt möglich).
 */
export function execute(
  history: History,
  command: Command,
  ids: IdSource,
): { history: History; result: CommandResult } {
  const result = command.apply(history.present.state, ids);
  if (result.state === history.present.state) return { history, result };
  const past = [...history.past, history.present];
  const drop = Math.max(0, past.length - history.limit);
  return {
    history: {
      past: drop > 0 ? past.slice(drop) : past,
      present: { state: result.state, label: command.label },
      future: [],
      limit: history.limit,
      truncated: history.truncated || drop > 0,
    },
    result,
  };
}

export const canUndo = (h: History): boolean => h.past.length > 0;
export const canRedo = (h: History): boolean => h.future.length > 0;

/** Name des Schritts, den Rückgängig zurücknimmt, oder null */
export const undoLabel = (h: History): string | null => (canUndo(h) ? h.present.label : null);
export const redoLabel = (h: History): string | null => h.future[0]?.label ?? null;

export function undo(h: History): History {
  const previous = h.past.at(-1);
  if (!previous) return h;
  return { ...h, past: h.past.slice(0, -1), present: previous, future: [h.present, ...h.future] };
}

export function redo(h: History): History {
  const [next, ...future] = h.future;
  if (!next) return h;
  return { ...h, past: [...h.past, h.present], present: next, future };
}

function* entries(h: History): Generator<HistoryEntry> {
  yield* h.past;
  yield h.present;
  yield* h.future;
}

/** Quellen, die der Verlauf noch braucht */
export function liveSources(h: History, extra: Iterable<SourceId> = []): Set<SourceId> {
  const live = new Set(extra);
  for (const { state } of entries(h)) for (const id of state.sources.keys()) live.add(id);
  return live;
}

/**
 * Quellen, die vorher gebraucht wurden und jetzt nicht mehr. `keep` sind Quellen außerhalb
 * des Verlaufs, z. B. die der internen Ablage.
 */
export function releasedSources(
  before: History,
  after: History,
  keep: Iterable<SourceId> = [],
): SourceId[] {
  const live = liveSources(after, keep);
  return [...liveSources(before)].filter((id) => !live.has(id));
}
