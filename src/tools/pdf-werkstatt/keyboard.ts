/**
 * Tastatur der PDF-Werkstatt (plan-phase3.md 6.2, freigegeben mit W5: D statt
 * Strg/Cmd+Umschalt+D, M statt Alt+Pfeil links/rechts). Seitenkürzel gelten nur mit dem Fokus
 * in einer Spalte, nie in Eingabefeldern. Einzelbuchstaben nur ohne Strg/Cmd/Alt, damit
 * Browser-Kürzel frei bleiben.
 */

import { indexPages, type DocId, type PageKey } from '../../core/workshop/model.ts';
import { moveFocus, selectRange, toggle } from '../../core/workshop/selection.ts';
import type { Actions } from './actions.ts';
import type { WorkshopStore } from './store.ts';

export interface KeyboardContext {
  store: WorkshopStore;
  actions: Actions;
  /** Fokus auf eine Seite legen und ins Bild scrollen */
  focusPage(key: PageKey): void;
  /** Spalten je Zeile im Raster des Dokuments (2 am Desktop, 3 auf dem Handy) */
  columnsOf(doc: DocId): number;
  openContextMenu(key: PageKey, anchor: HTMLElement): void;
  openPreview(key: PageKey): void;
  announceSelection(): void;
}

const isMod = (e: KeyboardEvent) => e.ctrlKey || e.metaKey;
const typing = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.matches('input, textarea, select') || el.isContentEditable);

/** Tasten auf einer Seite oder einer leeren Spalte */
export function handleBoardKey(event: KeyboardEvent, ctx: KeyboardContext): void {
  if (typing(event.target)) return;
  const target = event.target as HTMLElement;
  const tile = target.closest<HTMLElement>('.ws-page');
  const docId = target.closest<HTMLElement>('[data-doc]')?.dataset.doc;
  const { store, actions } = ctx;
  const key = tile?.dataset.key;
  const at = key ? indexPages(store.state).get(key) : undefined;
  const lower = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  let handled = true;

  const go = (next: PageKey | undefined) => {
    if (!next || !key) return;
    if (event.shiftKey) {
      store.select(
        selectRange(
          store.state,
          { ...store.selection, anchor: store.selection.anchor ?? key },
          next,
        ),
      );
      ctx.announceSelection();
    } else {
      store.select(moveFocus(store.selection, next));
    }
    ctx.focusPage(next);
  };

  if (
    at &&
    event.altKey &&
    !isMod(event) &&
    (event.key === 'ArrowUp' || event.key === 'ArrowDown')
  ) {
    actions.shift(event.key === 'ArrowUp' ? -1 : 1);
  } else if (
    at &&
    isMod(event) &&
    !event.altKey &&
    (event.key === 'ArrowLeft' || event.key === 'ArrowRight')
  ) {
    // Ins Nachbardokument, an dieselbe Stelle oder die letzte Seite
    const docs = store.state.docs;
    const step = event.key === 'ArrowRight' ? 1 : -1;
    for (let i = at.docIndex + step; i >= 0 && i < docs.length; i += step) {
      const pages = docs[i]?.pages ?? [];
      const next = pages[Math.min(at.pageIndex, pages.length - 1)];
      if (next) {
        go(next.key);
        break;
      }
    }
  } else if (at && !event.altKey && !isMod(event) && event.key.startsWith('Arrow')) {
    const columns = ctx.columnsOf(at.doc.id);
    const delta =
      { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns }[event.key] ?? 0;
    go(at.doc.pages[at.pageIndex + delta]?.key);
  } else if (at && (event.key === 'Home' || event.key === 'End') && !event.altKey) {
    const pages = at.doc.pages;
    go((event.key === 'Home' ? pages[0] : pages[pages.length - 1])?.key);
  } else if (key && event.key === ' ' && !isMod(event)) {
    store.select(toggle(store.selection, key));
    ctx.announceSelection();
  } else if (isMod(event) && !event.altKey && lower === 'a' && docId) {
    actions.selectAll(docId);
  } else if (event.key === 'Escape') {
    if (store.selection.keys.size === 0) handled = false;
    else actions.clearSelection();
  } else if (isMod(event) && !event.altKey && !event.shiftKey && lower === 'x') {
    actions.cut();
  } else if (isMod(event) && !event.altKey && !event.shiftKey && lower === 'c') {
    actions.copy();
  } else if (isMod(event) && !event.altKey && !event.shiftKey && lower === 'v' && docId) {
    actions.paste(docId);
  } else if (!isMod(event) && !event.altKey && lower === 'r' && key) {
    actions.rotate(event.shiftKey ? -90 : 90);
  } else if (!isMod(event) && !event.altKey && !event.shiftKey && lower === 'd' && key) {
    actions.duplicate();
  } else if (!isMod(event) && !event.altKey && !event.shiftKey && lower === 'm' && key) {
    actions.moveDialog();
  } else if (key && !isMod(event) && (event.key === 'Delete' || event.key === 'Backspace')) {
    actions.remove();
  } else if (key && event.key === 'Enter' && !isMod(event)) {
    ctx.openPreview(key);
  } else if (docId && event.key === 'F2') {
    actions.renameDoc(docId);
  } else if (
    tile &&
    key &&
    (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10'))
  ) {
    ctx.openContextMenu(key, tile);
  } else {
    handled = false;
  }
  if (handled) {
    event.preventDefault();
    event.stopPropagation();
  }
}

/**
 * Tasten im ganzen Werkstatt-Bereich (Werkzeugleiste, Spalten, rechte Spalte): Rückgängig,
 * Wiederholen, Übersicht der Kürzel. Nicht in Eingabefeldern, dort gilt das Rückgängig des
 * Browsers für den Text.
 */
export function handleAreaKey(event: KeyboardEvent, actions: Actions): void {
  if (typing(event.target) || event.defaultPrevented) return;
  const lower = event.key.toLowerCase();
  if (isMod(event) && !event.altKey && lower === 'z') {
    if (event.shiftKey) actions.redo();
    else actions.undo();
  } else if (event.ctrlKey && !event.metaKey && !event.altKey && lower === 'y') {
    actions.redo();
  } else if (event.key === '?' && !isMod(event) && !event.altKey) {
    actions.shortcuts();
  } else {
    return;
  }
  event.preventDefault();
}
