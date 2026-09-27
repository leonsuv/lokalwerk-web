/**
 * Spalten der PDF-Werkstatt (plan-phase3.md 5.1 und 6.4): ein Dokument je Spalte, jede Spalte
 * eine Liste mit Mehrfachauswahl, jede Seite eine Option. Kacheln hängen am Seitenschlüssel und
 * bleiben beim Verschieben erhalten, samt Vorschaubild; neu gesetzt wird nur, was sich ändert.
 */

import {
  visiblePageSize,
  type Doc,
  type DocId,
  type PageKey,
  type PageRef,
  type SourceId,
  type WorkshopState,
} from '../../core/workshop/model.ts';
import type { Selection } from '../../core/workshop/selection.ts';
import type { Thumbs } from './thumbs.ts';
import { DOC_NAME_LABEL, docPagesLabel, EMPTY_DOC, pageLabel, pages } from './texts.ts';

/** Kennbuchstabe und Farbe je Quelle, fest ab dem Hinzufügen (auch nach Rückgängig) */
export class SourceBadges {
  private readonly badges = new Map<SourceId, { letter: string; color: number }>();
  private next = 0;

  get(id: SourceId): { letter: string; color: number } {
    let badge = this.badges.get(id);
    if (!badge) {
      badge = { letter: letters(this.next), color: this.next % 5 };
      this.next++;
      this.badges.set(id, badge);
    }
    return badge;
  }
}

/** 0 → A, 25 → Z, 26 → AA … wie Tabellenspalten */
export function letters(n: number): string {
  let s = '';
  for (let i = n + 1; i > 0; i = Math.floor((i - 1) / 26)) {
    s = String.fromCharCode(65 + ((i - 1) % 26)) + s;
  }
  return s;
}

interface Tile {
  el: HTMLElement;
  sheet: HTMLElement;
  paper: HTMLElement;
  num: HTMLElement;
  badge: HTMLElement;
}

export interface Column {
  el: HTMLElement;
  name: HTMLInputElement;
  count: HTMLElement;
  list: HTMLElement;
  empty: HTMLElement;
  /** Scrollt senkrecht; Bezug für die Vorschaubilder */
  body: HTMLElement;
}

function set(el: Element, name: string, value: string): void {
  if (el.getAttribute(name) !== value) el.setAttribute(name, value);
}

function text(el: Element, value: string): void {
  if (el.textContent !== value) el.textContent = value;
}

function sameChildren(parent: Element, children: readonly Element[]): boolean {
  if (parent.children.length !== children.length) return false;
  for (let i = 0; i < children.length; i++) if (parent.children[i] !== children[i]) return false;
  return true;
}

/** Seitenverhältnis einer DIN-A4-Seite hoch: Kacheln haben diese Form, das Papier passt hinein */
const CELL_RATIO = 210 / 297;

export class Board {
  private readonly tiles = new Map<PageKey, Tile>();
  private readonly columns = new Map<DocId, Column>();

  constructor(
    private readonly root: HTMLElement,
    private readonly thumbs: Thumbs,
    private readonly badges: SourceBadges,
  ) {}

  column(id: DocId): Column | undefined {
    return this.columns.get(id);
  }

  tile(key: PageKey): HTMLElement | undefined {
    return this.tiles.get(key)?.el;
  }

  render(state: WorkshopState, selection: Selection): void {
    const docs = state.docs;
    const columns = docs.map((doc) => this.columnFor(doc));
    if (
      !sameChildren(
        this.root,
        columns.map((c) => c.el),
      )
    ) {
      this.root.replaceChildren(...columns.map((c) => c.el));
    }
    const liveDocs = new Set(docs.map((d) => d.id));
    for (const id of this.columns.keys()) if (!liveDocs.has(id)) this.columns.delete(id);

    const live = new Set<PageKey>();
    for (const [i, doc] of docs.entries()) {
      const column = columns[i];
      if (column) this.renderColumn(column, doc, state, selection, live);
    }
    for (const [key, tile] of this.tiles) {
      if (live.has(key)) continue;
      this.thumbs.forget(tile.paper);
      this.tiles.delete(key);
    }
  }

  private columnFor(doc: Doc): Column {
    const existing = this.columns.get(doc.id);
    if (existing) return existing;
    const el = document.createElement('section');
    el.className = 'ws-col';
    el.dataset.doc = doc.id;
    const head = document.createElement('div');
    head.className = 'ws-col-head';
    const name = document.createElement('input');
    name.className = 'ws-name';
    name.type = 'text';
    name.maxLength = 120;
    name.autocomplete = 'off';
    name.spellcheck = false;
    name.dataset.doc = doc.id;
    name.setAttribute('aria-label', DOC_NAME_LABEL);
    const count = document.createElement('span');
    count.className = 'ws-count';
    head.append(name, count);
    const list = document.createElement('div');
    list.className = 'ws-pages';
    list.dataset.doc = doc.id;
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-multiselectable', 'true');
    list.setAttribute('aria-orientation', 'vertical');
    const empty = document.createElement('p');
    empty.className = 'ws-empty-doc';
    empty.textContent = EMPTY_DOC;
    const body = document.createElement('div');
    body.className = 'ws-col-body';
    body.append(list, empty);
    el.append(head, body);
    const column = { el, name, count, list, empty, body };
    this.columns.set(doc.id, column);
    return column;
  }

  private renderColumn(
    column: Column,
    doc: Doc,
    state: WorkshopState,
    selection: Selection,
    live: Set<PageKey>,
  ): void {
    if (document.activeElement !== column.name && column.name.value !== doc.name) {
      column.name.value = doc.name;
    }
    set(column.el, 'aria-label', doc.name);
    set(column.list, 'aria-label', docPagesLabel(doc.name));
    text(column.count, pages(doc.pages.length));
    column.empty.hidden = doc.pages.length > 0;

    // Ein Tabstopp je Spalte (roving tabindex): die Seite mit dem Fokus, sonst die erste
    const focusHere = doc.pages.some((p) => p.key === selection.focus);
    const tiles = doc.pages.map((page, index) => {
      live.add(page.key);
      const tile = this.tiles.get(page.key) ?? this.createTile(page.key);
      const tabStop = focusHere ? page.key === selection.focus : index === 0;
      this.updateTile(tile, page, index, doc, state, selection, tabStop);
      return tile;
    });
    const elements = tiles.map((t) => t.el);
    if (!sameChildren(column.list, elements)) column.list.replaceChildren(...elements);
    // Nach dem Einsetzen: Die Vorschau misst gegen die Spalte, in der die Kachel jetzt steht.
    for (const [i, tile] of tiles.entries()) {
      const page = doc.pages[i];
      if (page) this.thumbs.show(tile.paper, page, column.body);
    }
  }

  private createTile(key: PageKey): Tile {
    const el = document.createElement('div');
    el.className = 'ws-page';
    el.dataset.key = key;
    el.setAttribute('role', 'option');
    const sheet = document.createElement('div');
    sheet.className = 'ws-sheet';
    const paper = document.createElement('div');
    paper.className = 'ws-paper';
    sheet.append(paper);
    const meta = document.createElement('div');
    meta.className = 'ws-meta';
    meta.setAttribute('aria-hidden', 'true');
    const num = document.createElement('span');
    const badge = document.createElement('span');
    badge.className = 'ws-src';
    meta.append(num, badge);
    const check = document.createElement('span');
    check.className = 'ws-check';
    // Festes Markup ohne Nutzerdaten; der HTML-Parser setzt den SVG-Namensraum selbst.
    check.innerHTML =
      '<svg width="14" height="14" aria-hidden="true"><use href="#i-check" /></svg>';
    el.append(sheet, meta, check);
    const tile = { el, sheet, paper, num, badge };
    this.tiles.set(key, tile);
    return tile;
  }

  private updateTile(
    tile: Tile,
    page: PageRef,
    index: number,
    doc: Doc,
    state: WorkshopState,
    selection: Selection,
    tabStop: boolean,
  ): void {
    const selected = selection.keys.has(page.key);
    tile.el.classList.toggle('sel', selected);
    set(tile.el, 'aria-selected', String(selected));
    const tabIndex = tabStop ? 0 : -1;
    if (tile.el.tabIndex !== tabIndex) tile.el.tabIndex = tabIndex;

    const source = page.kind === 'source' ? state.sources.get(page.source) : undefined;
    set(
      tile.el,
      'aria-label',
      pageLabel({
        position: index + 1,
        count: doc.pages.length,
        source:
          source && page.kind === 'source'
            ? { name: source.name, page: source.kind === 'image' ? null : page.index + 1 }
            : null,
        rotate: page.rotate,
      }),
    );
    text(tile.num, String(index + 1));
    if (page.kind === 'source') {
      const badge = this.badges.get(page.source);
      text(
        tile.badge,
        source?.kind === 'image' ? badge.letter : `${badge.letter}·${page.index + 1}`,
      );
      tile.badge.className = `ws-src c${badge.color}`;
    } else {
      text(tile.badge, 'leer');
      tile.badge.className = 'ws-src blank';
    }

    const size = visiblePageSize(state, page);
    const ratio = size.width / size.height;
    const shape = ratio > CELL_RATIO ? 'wide' : 'tall';
    tile.paper.className = `ws-paper ${shape}${page.kind === 'blank' ? ' blank' : ''}`;
    const aspect = `${size.width} / ${size.height}`;
    if (tile.paper.style.aspectRatio !== aspect) tile.paper.style.aspectRatio = aspect;
  }
}
