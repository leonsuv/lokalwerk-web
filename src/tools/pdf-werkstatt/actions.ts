/**
 * Aktionen der PDF-Werkstatt an einer Stelle: Werkzeugleiste, Tastatur und Menüs rufen dieselben
 * Funktionen auf (plan-phase3.md 6.2: jede Aktion auch ohne Ziehen). Jede Aktion führt einen
 * Befehl aus, sagt das Ergebnis an und setzt den Fokus sinnvoll.
 *
 * Ziel einer Seitenaktion ist die Auswahl, ohne Auswahl die Seite mit dem Fokus.
 */

import {
  clearCuts,
  closeDoc,
  joinDocs,
  moveDoc,
  replaceCuts,
  reversePages,
  setCuts,
  splitAtCuts,
  copyPages,
  deletePages,
  duplicateDoc,
  duplicatePages,
  extractToNewDoc,
  insertBlank,
  mergeDocs,
  movePages,
  newDoc,
  pastePages,
  rotatePages,
  shiftPages,
  splitDoc,
  toClipboard,
} from '../../core/workshop/commands.ts';
import {
  A4_LANDSCAPE,
  A4_PORTRAIT,
  blankBoxFor,
  cutIndices,
  findDoc,
  indexPages,
  inPageOrder,
  type DocId,
  type PageBox,
  type PageKey,
  visiblePageSize,
} from '../../core/workshop/model.ts';
import {
  EMPTY_SELECTION,
  invertSelection,
  selectDoc,
  selectEverything,
  selectionSummary,
  selectKeys,
} from '../../core/workshop/selection.ts';
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

export type BlankSize = 'neighbour' | 'a4' | 'a4-landscape';

/** Name für einen weiteren Teil: „Vertrag (Teil 3)“, ohne einen vorhandenen Namen zu doppeln */
export function nextPartName(names: readonly string[], name: string): string {
  const base = name.replace(/ \(Teil \d+\)$/, '');
  const taken = new Set(names);
  for (let n = 2; ; n++) {
    const candidate = t.partNameN(base, n);
    if (!taken.has(candidate)) return candidate;
  }
}

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

  function partName(name: string): string {
    return nextPartName(
      store.state.docs.map((d) => d.name),
      name,
    );
  }

  function blankBox(doc: DocId, index: number, size: BlankSize): PageBox | null {
    const target = findDoc(store.state, doc);
    if (!target) return null;
    return size === 'a4'
      ? A4_PORTRAIT
      : size === 'a4-landscape'
        ? A4_LANDSCAPE
        : blankBoxFor(store.state, target, index);
  }

  function selectAnnounce(keys: readonly PageKey[]): void {
    store.select(selectKeys(keys));
    const { pages, docs } = selectionSummary(store.state, store.selection);
    ctx.announce(t.selected(pages, docs));
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

    /** Wo eine leere Seite hinkommt: nach der Seite mit dem Fokus, sonst ans Ende */
    blankTarget: (): { doc: DocId; index: number; neighbour: PageBox } | null => {
      const focus = store.selection.focus ? where(store.selection.focus) : null;
      const doc = findDoc(store.state, focus?.doc ?? store.state.docs[0]?.id ?? '');
      if (!doc) return null;
      const index = focus ? focus.position : doc.pages.length;
      return { doc: doc.id, index, neighbour: blankBoxFor(store.state, doc, index) };
    },

    /** Nach der Seite mit dem Fokus; mit `inDoc` am Ende dieses Dokuments */
    insertBlank: (size: 'neighbour' | 'a4' | 'a4-landscape', inDoc?: DocId): void => {
      const focus = !inDoc && store.selection.focus ? where(store.selection.focus) : null;
      const doc = findDoc(store.state, inDoc ?? focus?.doc ?? store.state.docs[0]?.id ?? '');
      if (!doc) return;
      const index = focus ? focus.position : doc.pages.length;
      const box =
        size === 'a4'
          ? A4_PORTRAIT
          : size === 'a4-landscape'
            ? A4_LANDSCAPE
            : blankBoxFor(store.state, doc, index);
      store.run(insertBlank(doc.id, index, box));
      ctx.announce(t.blankInserted(doc.name, index + 1));
      ctx.focusAfterRender(doc.id);
    },

    /** Dokument vor der Seite mit dem Fokus teilen */
    split: (): void => {
      const focus = store.selection.focus ? where(store.selection.focus) : null;
      if (!focus) {
        ctx.announce(t.NO_PAGE);
        return;
      }
      if (focus.position === 1) {
        ctx.announce(t.SPLIT_FIRST_PAGE);
        return;
      }
      store.run(splitDoc(focus.doc, focus.position - 1, partName(focus.name)));
      ctx.announce(t.splitDone(focus.name, focus.position));
      ctx.focusAfterRender();
    },

    merge: (docs: readonly DocId[]): void => {
      const first = store.state.docs.find((d) => docs.includes(d.id));
      if (!first || docs.length < 2) return;
      store.run(mergeDocs(docs));
      ctx.announce(t.merged(docs.length, first.name));
      ctx.focusAfterRender(first.id);
    },

    /** Seiten als Kopie in ein neues Dokument ganz rechts */
    extract: (): void => {
      const keys = needPages();
      if (!keys) return;
      const name = t.newDocName(store.state.docs.length + 1);
      store.run(extractToNewDoc(keys, name, 'copy'));
      ctx.announce(t.docCreated(name));
      ctx.focusAfterRender();
    },

    /** Eine bestimmte Seite eine Stelle verschieben (große Vorschau auf dem Handy) */
    shiftOne: (key: PageKey, delta: -1 | 1): void => {
      const before = store.state;
      store.run(shiftPages([key], delta));
      if (store.state !== before) ctx.announce(t.shifted(1, delta));
    },

    rotateHalf: (): void => {
      const keys = needPages();
      if (!keys) return;
      store.run(rotatePages(keys, 180));
      ctx.announce(t.rotatedHalf(keys.length));
      ctx.focusAfterRender();
    },

    reverse: (): void => {
      const keys = needPages();
      if (!keys) return;
      const before = store.state;
      store.run(reversePages(keys));
      ctx.announce(store.state === before ? t.REVERSE_NEEDS_TWO : t.reversed(keys.length));
      ctx.focusAfterRender();
    },

    /** Nach der Seite mit dem Fokus einfügen */
    pasteAfter: (): void => {
      const clip = store.clipboard;
      const focus = store.selection.focus ? where(store.selection.focus) : null;
      if (!clip || clip.pages.length === 0) {
        ctx.announce(t.NOTHING_TO_PASTE);
        return;
      }
      if (!focus) {
        ctx.announce(t.NO_PAGE);
        return;
      }
      store.run(pastePages(clip, focus.doc, focus.position));
      ctx.announce(t.pasted(clip.pages.length, focus.name, focus.position + 1));
      ctx.focusAfterRender(focus.doc);
    },

    /** An einer bestimmten Stelle einfügen (Kontextmenü eines Zwischenraums, leere Fläche) */
    pasteAt: (doc: DocId, index: number): void => {
      const clip = store.clipboard;
      const target = findDoc(store.state, doc);
      if (!clip || clip.pages.length === 0 || !target) {
        ctx.announce(t.NOTHING_TO_PASTE);
        return;
      }
      store.run(pastePages(clip, doc, index));
      ctx.announce(t.pasted(clip.pages.length, target.name, index + 1));
      ctx.focusAfterRender(doc);
    },

    /** Leere Seite an einer bestimmten Stelle */
    blankAt: (doc: DocId, index: number, size: BlankSize): void => {
      const box = blankBox(doc, index, size);
      const target = findDoc(store.state, doc);
      if (!box || !target) return;
      store.run(insertBlank(doc, index, box));
      ctx.announce(t.blankInserted(target.name, index + 1));
      ctx.focusAfterRender(doc);
    },

    /** Leere Seite vor (`0`) oder nach (`1`) der Seite mit dem Fokus */
    blankNear: (offset: 0 | 1, size: BlankSize): void => {
      const focus = store.selection.focus ? where(store.selection.focus) : null;
      if (!focus) {
        ctx.announce(t.NO_PAGE);
        return;
      }
      const index = focus.position - 1 + offset;
      const box = blankBox(focus.doc, index, size);
      if (!box) return;
      store.run(insertBlank(focus.doc, index, box));
      ctx.announce(t.blankInserted(focus.name, index + 1));
      ctx.focusAfterRender(focus.doc);
    },

    /** Seiten ans Ende eines anderen Dokuments verschieben (Untermenü „Zu Dokument“) */
    moveToDoc: (doc: DocId, copy = false): void => {
      const keys = needPages();
      const target = findDoc(store.state, doc);
      if (!keys || !target) return;
      const index = target.pages.length;
      if (copy) {
        store.run(copyPages(keys, doc, index));
        ctx.announce(t.copiedTo(keys.length, target.name, index + 1));
      } else {
        store.run(movePages(keys, doc, index));
        ctx.announce(t.moved(keys.length, target.name, index + 1));
      }
      ctx.focusAfterRender(doc);
    },

    /** Seiten in ein neues Dokument ganz hinten verschieben */
    extractMove: (): void => {
      const keys = needPages();
      if (!keys) return;
      const name = t.newDocName(store.state.docs.length + 1);
      store.run(extractToNewDoc(keys, name, 'move'));
      ctx.announce(t.movedToNew(keys.length, name));
      ctx.focusAfterRender();
    },

    /** Trennlinie vor den Seiten umschalten; gesetzt, wenn eine davon noch keine hat */
    toggleCut: (keys?: readonly PageKey[]): void => {
      const list = keys ?? needPages();
      if (!list || list.length === 0) return;
      const index = indexPages(store.state);
      const inner = list.filter((k) => (index.get(k)?.pageIndex ?? 0) > 0);
      if (inner.length === 0) {
        ctx.announce(t.CUT_FIRST_PAGE);
        return;
      }
      const has = (k: PageKey) => {
        const at = index.get(k);
        return !!at && (at.doc.cuts ?? []).includes(k);
      };
      const on = inner.some((k) => !has(k));
      store.run(setCuts(inner, on));
      const first = index.get(inner[0] ?? '');
      ctx.announce(on ? t.cutSet(inner.length, first?.pageIndex ?? 0) : t.cutRemoved(inner.length));
    },

    splitAtCuts: (doc: DocId): void => {
      const target = findDoc(store.state, doc);
      if (!target) return;
      const count = cutIndices(target).length;
      if (count === 0) {
        ctx.announce(t.NO_CUTS);
        return;
      }
      const base = target.name.replace(/ \(Teil \d+\)$/, '');
      const names = store.state.docs.map((d) => d.name);
      const taken = new Set(names);
      let n = 2;
      const nameFor = () => {
        while (taken.has(t.partNameN(base, n))) n++;
        const name = t.partNameN(base, n);
        taken.add(name);
        return name;
      };
      store.run(splitAtCuts(doc, nameFor));
      ctx.announce(t.splitAtCutsDone(target.name, count + 1));
      ctx.focusAfterRender(doc);
    },

    clearCuts: (doc: DocId): void => {
      const target = findDoc(store.state, doc);
      if (!target) return;
      store.run(clearCuts([doc]));
      ctx.announce(t.cutsCleared(target.name));
    },

    /** Schere: sofort vor Seite `index` (ab 0) teilen */
    splitAt: (doc: DocId, index: number): void => {
      const target = findDoc(store.state, doc);
      if (!target) return;
      if (index <= 0 || index >= target.pages.length) {
        ctx.announce(t.SPLIT_EDGE);
        return;
      }
      store.run(splitDoc(doc, index, partName(target.name)));
      ctx.announce(t.splitDone(target.name, index + 1));
    },

    /** In dieser Reihenfolge zusammenführen (Dialog, Dokument auf Dokument ziehen) */
    join: (order: readonly DocId[]): void => {
      const first = findDoc(store.state, order[0] ?? '');
      if (!first || order.length < 2) return;
      store.run(joinDocs(order));
      ctx.announce(t.merged(order.length, first.name));
      ctx.focusAfterRender(first.id);
    },

    /** Dokument in der Liste umordnen */
    moveDoc: (doc: DocId, index: number): void => {
      const target = findDoc(store.state, doc);
      const before = store.state;
      store.run(moveDoc(doc, index));
      if (target && store.state !== before) {
        const at = store.state.docs.findIndex((d) => d.id === doc);
        ctx.announce(t.docMoved(target.name, at + 1, store.state.docs.length));
      }
    },

    selectEverything: (): void => {
      store.select(selectEverything(store.state, store.selection.focus));
      const { pages, docs } = selectionSummary(store.state, store.selection);
      ctx.announce(t.selected(pages, docs));
    },

    invert: (doc: DocId | null): void => {
      store.select(invertSelection(store.state, store.selection, doc));
      const { pages, docs } = selectionSummary(store.state, store.selection);
      ctx.announce(t.selected(pages, docs));
    },

    /** Ungerade (`1`) oder gerade (`0`) Seiten des Dokuments */
    selectParity: (doc: DocId, odd: boolean): void => {
      const target = findDoc(store.state, doc);
      if (!target) return;
      selectAnnounce(target.pages.filter((_, i) => (i % 2 === 0) === odd).map((p) => p.key));
    },

    /** Trennlinien alle `n` Seiten setzen (Teilen nach Seitenzahl, erst ansehen, dann teilen) */
    cutsEvery: (doc: DocId, n: number): void => {
      const target = findDoc(store.state, doc);
      if (!target || n < 1) return;
      const keys = target.pages.filter((_, i) => i > 0 && i % n === 0).map((p) => p.key);
      if (keys.length === 0) {
        ctx.announce(t.CUTS_EVERY_NONE);
        return;
      }
      store.run(replaceCuts(doc, keys));
      ctx.announce(t.cutsEveryDone(keys.length + 1, target.name));
    },

    /** Seiten im Querformat um 90 Grad drehen, damit alle hochkant stehen */
    portrait: (): void => {
      const keys = needPages();
      if (!keys) return;
      const index = indexPages(store.state);
      const wide = keys.filter((k) => {
        const page = index.get(k)?.page;
        if (!page) return false;
        const size = visiblePageSize(store.state, page);
        return size.width > size.height;
      });
      if (wide.length === 0) {
        ctx.announce(t.PORTRAIT_NONE);
        return;
      }
      store.run(rotatePages(wide, 90));
      ctx.announce(t.portraitDone(wide.length));
      ctx.focusAfterRender();
    },

    /** Seiten nach Nummern (ab 1) im Dokument auswählen */
    selectNumbers: (doc: DocId, numbers: readonly number[]): void => {
      const target = findDoc(store.state, doc);
      if (!target) return;
      selectAnnounce(numbers.flatMap((n) => target.pages[n - 1]?.key ?? []));
    },

    /** Eine bestimmte Seite drehen (große Vorschau) */
    rotateOne: (key: PageKey, degrees: 90 | -90): void => {
      store.run(rotatePages([key], degrees));
      ctx.announce(t.rotated(1, degrees));
    },
  };
}
