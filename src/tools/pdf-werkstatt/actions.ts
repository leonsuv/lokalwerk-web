/**
 * Aktionen der PDF-Werkstatt an einer Stelle: Werkzeugleiste, Tastatur und Menüs rufen dieselben
 * Funktionen auf (plan-phase3.md 6.2: jede Aktion auch ohne Ziehen). Jede Aktion führt einen
 * Befehl aus, sagt das Ergebnis an und setzt den Fokus sinnvoll.
 *
 * Ziel einer Seitenaktion ist die Auswahl, ohne Auswahl die Seite mit dem Fokus.
 */

import {
  closeDoc,
  copyPages,
  deletePages,
  duplicateDoc,
  duplicatePages,
  movePages,
  newDoc,
  pastePages,
  rotatePages,
  shiftPages,
  toClipboard,
} from '../../core/workshop/commands.ts';
import {
  findDoc,
  indexPages,
  inPageOrder,
  type DocId,
  type PageKey,
} from '../../core/workshop/model.ts';
import { EMPTY_SELECTION, selectDoc, selectionSummary } from '../../core/workshop/selection.ts';
import type { WorkshopStore } from './store.ts';
import * as t from './texts.ts';

export interface ActionContext {
  store: WorkshopStore;
  announce(message: string): void;
  /** Fokus nach dem nächsten Zeichnen auf die Seite mit dem Fokus der Auswahl legen */
  focusAfterRender(fallbackDoc?: DocId): void;
  focusDocName(doc: DocId): void;
  openFilePicker(): void;
  openMoveDialog(keys: readonly PageKey[]): void;
  openShortcuts(): void;
}

export type Actions = ReturnType<typeof createActions>;

export function createActions(ctx: ActionContext) {
  const { store } = ctx;

  /** Auswahl in Seitenreihenfolge, ohne Auswahl die Seite mit dem Fokus */
  function targets(): PageKey[] {
    const { selection, state } = store;
    if (selection.keys.size > 0) return inPageOrder(state, selection.keys).map((p) => p.key);
    return selection.focus && indexPages(state).has(selection.focus) ? [selection.focus] : [];
  }

  /** Dokument und Position einer Seite (ab 1) */
  function where(key: PageKey): { doc: DocId; name: string; position: number } | null {
    const at = indexPages(store.state).get(key);
    return at ? { doc: at.doc.id, name: at.doc.name, position: at.pageIndex + 1 } : null;
  }

  /** Nach dem Löschen: nächste verbleibende Seite im selben Dokument, sonst die davor */
  function focusAfterRemoving(keys: readonly PageKey[]): void {
    const index = indexPages(store.state);
    const first = keys[0] ? index.get(keys[0]) : undefined;
    if (!first) return;
    const gone = new Set(keys);
    const pages = first.doc.pages;
    const next =
      pages.slice(first.pageIndex).find((p) => !gone.has(p.key)) ??
      pages
        .slice(0, first.pageIndex)
        .reverse()
        .find((p) => !gone.has(p.key));
    // Nur der Fokus wandert weiter; ausgewählt wird nichts (Entf mehrmals löscht Seite für Seite)
    store.select(next ? { keys: new Set(), anchor: null, focus: next.key } : EMPTY_SELECTION);
    ctx.focusAfterRender(first.doc.id);
  }

  function needPages(): PageKey[] | null {
    const keys = targets();
    if (keys.length === 0) ctx.announce(t.NO_PAGE);
    return keys.length > 0 ? keys : null;
  }

  return {
    targets,

    addFiles: () => ctx.openFilePicker(),

    newDoc: (): void => {
      const name = t.newDocName(store.state.docs.length + 1);
      const result = store.run(newDoc(name));
      ctx.announce(t.docCreated(name));
      if (result.doc) ctx.focusDocName(result.doc);
    },

    rotate: (degrees: 90 | -90): void => {
      const keys = needPages();
      if (!keys) return;
      store.run(rotatePages(keys, degrees));
      ctx.announce(t.rotated(keys.length, degrees));
      ctx.focusAfterRender();
    },

    remove: (): void => {
      const keys = needPages();
      if (!keys) return;
      focusAfterRemoving(keys);
      store.run(deletePages(keys));
      ctx.announce(t.deleted(keys.length));
    },

    duplicate: (): void => {
      const keys = needPages();
      if (!keys) return;
      store.run(duplicatePages(keys));
      ctx.announce(t.duplicated(keys.length));
      ctx.focusAfterRender();
    },

    shift: (delta: -1 | 1): void => {
      const keys = needPages();
      if (!keys) return;
      const before = store.state;
      store.run(shiftPages(keys, delta));
      // Am Rand bleibt alles, wie es ist: keine Ansage einer Bewegung
      if (store.state !== before) ctx.announce(t.shifted(keys.length, delta));
      ctx.focusAfterRender();
    },

    /** Verschieben an eine Stelle, z. B. aus dem Dialog „Verschieben nach …“ */
    moveTo: (keys: readonly PageKey[], doc: DocId, index: number): void => {
      const target = findDoc(store.state, doc);
      if (!target || keys.length === 0) return;
      const before = store.state;
      store.run(movePages(keys, doc, index));
      if (store.state === before) {
        ctx.announce(t.NOTHING_MOVED);
        ctx.focusAfterRender(doc);
        return;
      }
      const at = keys[0] ? where(keys[0]) : null;
      ctx.announce(t.moved(keys.length, target.name, at?.position ?? index + 1));
      ctx.focusAfterRender(doc);
    },

    copyTo: (keys: readonly PageKey[], doc: DocId, index: number): void => {
      const target = findDoc(store.state, doc);
      if (!target || keys.length === 0) return;
      const result = store.run(copyPages(keys, doc, index));
      const first = result.select?.[0];
      const at = first ? where(first) : null;
      ctx.announce(t.copiedTo(keys.length, target.name, at?.position ?? index + 1));
      ctx.focusAfterRender(doc);
    },

    moveDialog: (): void => {
      const keys = needPages();
      if (keys) ctx.openMoveDialog(keys);
    },

    cut: (): void => {
      const keys = needPages();
      if (!keys) return;
      store.setClipboard(toClipboard(store.state, keys));
      focusAfterRemoving(keys);
      store.run(deletePages(keys, 'Ausschneiden'));
      ctx.announce(t.cut(keys.length));
    },

    copy: (): void => {
      const keys = needPages();
      if (!keys) return;
      store.setClipboard(toClipboard(store.state, keys));
      ctx.announce(t.copied(keys.length));
    },

    /** Vor der Seite mit dem Fokus einfügen, in einem leeren Dokument am Anfang */
    paste: (doc?: DocId): void => {
      const clip = store.clipboard;
      if (!clip || clip.pages.length === 0) {
        ctx.announce(t.NOTHING_TO_PASTE);
        return;
      }
      const focus = store.selection.focus ? where(store.selection.focus) : null;
      const target = focus && (!doc || focus.doc === doc) ? focus.doc : (doc ?? focus?.doc);
      if (!target) {
        ctx.announce(t.NO_PAGE);
        return;
      }
      const index = focus && focus.doc === target ? focus.position - 1 : 0;
      store.run(pastePages(clip, target, index));
      ctx.announce(
        t.pasted(clip.pages.length, findDoc(store.state, target)?.name ?? '', index + 1),
      );
      ctx.focusAfterRender(target);
    },

    undo: (): void => {
      const label = store.undoLabel;
      if (label === null) {
        ctx.announce(store.truncated ? t.HISTORY_LIMIT_HINT : t.NOTHING_TO_UNDO);
        return;
      }
      store.undo();
      ctx.announce(t.undone(label));
      ctx.focusAfterRender();
    },

    redo: (): void => {
      const label = store.redoLabel;
      if (label === null) {
        ctx.announce(t.NOTHING_TO_REDO);
        return;
      }
      store.redo();
      ctx.announce(t.redone(label));
      ctx.focusAfterRender();
    },

    selectAll: (doc: DocId): void => {
      store.select(selectDoc(store.state, doc, store.selection.focus));
      const { pages, docs } = selectionSummary(store.state, store.selection);
      ctx.announce(t.selected(pages, docs));
    },

    clearSelection: (): void => {
      if (store.selection.keys.size === 0) return;
      store.select({ ...store.selection, keys: new Set(), anchor: null });
      ctx.announce(t.selected(0, 0));
    },

    renameDoc: (doc: DocId): void => {
      ctx.focusDocName(doc);
    },

    duplicateDoc: (doc: DocId): void => {
      const source = findDoc(store.state, doc);
      if (!source) return;
      const name = t.copyName(source.name);
      store.run(duplicateDoc(doc, name));
      ctx.announce(t.docDuplicated(name));
    },

    closeDoc: (doc: DocId): void => {
      const source = findDoc(store.state, doc);
      if (!source) return;
      store.run(closeDoc(doc));
      ctx.announce(t.docClosed(source.name));
      ctx.focusAfterRender();
    },

    shortcuts: () => ctx.openShortcuts(),
  };
}
