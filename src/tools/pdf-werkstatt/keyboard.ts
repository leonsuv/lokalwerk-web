/**
 * Tastatur der PDF-Werkstatt (Umbau zum Editor):
 * - Im Raster bewegen die Pfeiltasten den Fokus so, wie die Seiten stehen (auch über
 *   Dokumentgrenzen), Umschalt erweitert die Auswahl, Leertaste wählt an oder ab, Pos1/Ende
 *   springen im Dokument, Eingabe öffnet die Seite groß, Kontextmenütaste oder Umschalt+F10 das
 *   Menü der Seite.
 * - Alle anderen Kürzel stehen in der Befehlsliste (ui-commands.ts) und gelten im ganzen
 *   Programm, nie in Eingabefeldern und nie, solange ein Menü oder Dialog offen ist.
 */

import { verticalNeighbour } from '../../core/workshop/layout.ts';
import { indexPages, type PageKey } from '../../core/workshop/model.ts';
import { moveFocus, selectRange, toggle } from '../../core/workshop/selection.ts';
import { keyOf } from './shortcuts.ts';
import type { WorkshopStore } from './store.ts';
import type { Cmd } from './ui-commands.ts';

export interface GridKeyContext {
  store: WorkshopStore;
  tiles(): HTMLElement[];
  focusPage(key: PageKey): void;
  openContextMenu(key: PageKey, anchor: HTMLElement): void;
  openSingle(key: PageKey): void;
  announceSelection(): void;
}

export const typing = (el: EventTarget | null): boolean =>
  el instanceof HTMLElement && (el.matches('input, textarea, select') || el.isContentEditable);

/** Tasten auf einer Seite des Rasters; true, wenn behandelt */
export function handleGridKey(event: KeyboardEvent, ctx: GridKeyContext): boolean {
  if (typing(event.target) || event.altKey) return false;
  const tile = (event.target as HTMLElement).closest<HTMLElement>('.ws-page');
  const key = tile?.dataset.key;
  if (!tile || !key) return false;
  const { store } = ctx;
  const mod = event.ctrlKey || event.metaKey;
  const go = (next: PageKey | undefined) => {
    if (!next) return;
    if (event.shiftKey) {
      store.select(
        selectRange(
          store.state,
          { ...store.selection, anchor: store.selection.anchor ?? key },
          next,
          mod,
        ),
      );
      ctx.announceSelection();
    } else {
      store.select(moveFocus(store.selection, next));
    }
    ctx.focusPage(next);
  };
  const tiles = ctx.tiles();
  const i = tiles.indexOf(tile);
  switch (event.key) {
    case 'ArrowLeft':
    case 'ArrowRight': {
      if (mod) return false;
      go(tiles[i + (event.key === 'ArrowRight' ? 1 : -1)]?.dataset.key);
      break;
    }
    case 'ArrowUp':
    case 'ArrowDown': {
      if (mod) return false;
      const boxes = tiles.map((el) => {
        const r = el.getBoundingClientRect();
        return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
      });
      const n = verticalNeighbour(boxes, i, event.key === 'ArrowDown' ? 1 : -1);
      go(n === null ? undefined : tiles[n]?.dataset.key);
      break;
    }
    case 'Home':
    case 'End': {
      const at = indexPages(store.state).get(key);
      const pages = at?.doc.pages ?? [];
      go((event.key === 'Home' ? pages[0] : pages[pages.length - 1])?.key);
      break;
    }
    case ' ':
      if (mod) return false;
      store.select(toggle(store.selection, key));
      ctx.announceSelection();
      break;
    case 'Enter':
      if (mod) return false;
      ctx.openSingle(key);
      break;
    case 'ContextMenu':
      ctx.openContextMenu(key, tile);
      break;
    case 'F10':
      if (!event.shiftKey) return false;
      ctx.openContextMenu(key, tile);
      break;
    default:
      return false;
  }
  event.preventDefault();
  event.stopPropagation();
  return true;
}

/** Tastenkürzel aus der Befehlsliste; true, wenn ein Befehl lief */
export function handleShortcut(event: KeyboardEvent, cmds: Map<string, Cmd>): boolean {
  if (typing(event.target) || event.defaultPrevented || event.isComposing) return false;
  if ((event.target as HTMLElement).closest('dialog, .ws-menu')) return false;
  // Tasten, die Knöpfe und Menüs selbst brauchen, nur mit Strg/Cmd oder Alt
  const onControl = (event.target as HTMLElement).closest('button, [role="menuitem"], a, summary');
  const k = keyOf(event);
  if (onControl && (k === 'enter' || k === 'space')) return false;
  for (const cmd of cmds.values()) {
    if (!cmd.keys?.includes(k)) continue;
    if (cmd.enabled && !cmd.enabled()) {
      // Das Kürzel gehört uns, auch wenn gerade nichts zu tun ist (kein Browser-Speichern usw.)
      if (k.startsWith('mod+')) event.preventDefault();
      return true;
    }
    event.preventDefault();
    event.stopPropagation();
    cmd.run();
    return true;
  }
  return false;
}
