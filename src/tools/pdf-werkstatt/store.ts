/**
 * Zustand der PDF-Werkstatt im Hauptthread: Verlauf, Auswahl, interne Ablage. Befehle kommen aus
 * src/core/workshop/; dieses Modul führt sie aus, hält die Auswahl gültig, meldet Quellen zum
 * Freigeben (history.ts) und benachrichtigt die Oberfläche.
 */

import type { Clipboard, Command, CommandResult } from '../../core/workshop/commands.ts';
import {
  canRedo,
  canUndo,
  createHistory,
  execute,
  redo,
  liveSources,
  redoLabel,
  undo,
  undoLabel,
  type History,
} from '../../core/workshop/history.ts';
import { counterIds, type SourceId, type WorkshopState } from '../../core/workshop/model.ts';
import {
  EMPTY_SELECTION,
  pruneSelection,
  selectKeys,
  type Selection,
} from '../../core/workshop/selection.ts';

export type Change =
  | { kind: 'command'; label: string; result: CommandResult }
  | { kind: 'undo' | 'redo'; label: string }
  | { kind: 'selection' };

export class WorkshopStore {
  readonly ids = counterIds();
  private history: History = createHistory();
  private sel: Selection = EMPTY_SELECTION;
  private clip: Clipboard | null = null;
  /** Zustand beim letzten Export, für die Warnung beim Verlassen */
  private saved: WorkshopState = this.history.present.state;
  private readonly listeners = new Set<(change: Change) => void>();

  /** Quellen, auf die nichts mehr verweist: pdf.js-Dokument schließen, Datei im Worker vergessen */
  constructor(private readonly onRelease: (ids: SourceId[]) => void) {}

  get state(): WorkshopState {
    return this.history.present.state;
  }

  get selection(): Selection {
    return this.sel;
  }

  get clipboard(): Clipboard | null {
    return this.clip;
  }

  get canUndo(): boolean {
    return canUndo(this.history);
  }

  get canRedo(): boolean {
    return canRedo(this.history);
  }

  get undoLabel(): string | null {
    return undoLabel(this.history);
  }

  get redoLabel(): string | null {
    return redoLabel(this.history);
  }

  /** Ältere Schritte sind wegen der Grenze von 100 weggefallen */
  get truncated(): boolean {
    return this.history.truncated;
  }

  /** Änderungen seit dem letzten Export (Warnung beim Verlassen der Seite) */
  get dirty(): boolean {
    return this.state !== this.saved && this.state.docs.some((d) => d.pages.length > 0);
  }

  subscribe(listener: (change: Change) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Führt den Befehl aus. Ändert er nichts, bleibt alles, wie es ist, und es gibt keine Meldung. */
  run(command: Command): CommandResult {
    const before = this.history;
    const { history, result } = execute(before, command, this.ids);
    if (history === before) return result;
    this.history = history;
    this.sel = result.select ? selectKeys(result.select) : pruneSelection(this.state, this.sel);
    this.release(before);
    this.emit({ kind: 'command', label: command.label, result });
    return result;
  }

  undo(): void {
    const label = undoLabel(this.history);
    if (label === null) return;
    this.step(undo(this.history), { kind: 'undo', label });
  }

  redo(): void {
    const label = redoLabel(this.history);
    if (label === null) return;
    this.step(redo(this.history), { kind: 'redo', label });
  }

  select(selection: Selection): void {
    this.sel = pruneSelection(this.state, selection);
    this.emit({ kind: 'selection' });
  }

  setClipboard(clipboard: Clipboard | null): void {
    const before = this.clip;
    this.clip = clipboard;
    this.release(this.history, before);
  }

  markSaved(): void {
    this.saved = this.state;
  }

  private step(next: History, change: Change): void {
    const before = this.history;
    this.history = next;
    this.sel = pruneSelection(this.state, this.sel);
    this.release(before);
    this.emit(change);
  }

  /** Quellen, die vorher Verlauf oder Ablage brauchten und jetzt nicht mehr */
  private release(before: History, beforeClip: Clipboard | null = this.clip): void {
    const clipIds = (clip: Clipboard | null) => (clip?.sources ?? []).map((s) => s.id);
    const live = liveSources(this.history, clipIds(this.clip));
    const gone = [...liveSources(before, clipIds(beforeClip))].filter((id) => !live.has(id));
    if (gone.length > 0) this.onRelease(gone);
  }

  private emit(change: Change): void {
    for (const listener of this.listeners) listener(change);
  }
}
