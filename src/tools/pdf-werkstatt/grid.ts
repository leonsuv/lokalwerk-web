/**
 * Seitenraster der PDF-Werkstatt (Umbau zum Editor): jedes Dokument ein Abschnitt mit Kopf und
 * einer umbrechenden Liste seiner Seiten (Listbox mit Mehrfachauswahl, jede Seite eine Option).
 * Die Kachelgröße folgt dem Zoom. Zwischen zwei Seiten liegt ein Zwischenraum, in dem ein Klick
 * eine Trennlinie setzt; eine gesetzte Linie beginnt eine neue Zeile.
 *
 * Kacheln hängen am Seitenschlüssel und bleiben beim Verschieben erhalten, samt Vorschaubild.
 * Nach Befehlen gleiten die Seiten an ihren neuen Platz (motion.ts).
 */

import { tileWidth } from '../../core/workshop/layout.ts';
import {
  cutIndices,
  pageNumbersOf,
  signaturesOf,
  stampOf,
  visiblePageSize,
  type Doc,
  type DocId,
  type PageKey,
  type PageRef,
  type SourceId,
  type WorkshopState,
} from '../../core/workshop/model.ts';
import type { Selection } from '../../core/workshop/selection.ts';
import { measure, play } from './motion.ts';
import type { Thumbs } from './thumbs.ts';
import * as t from './texts.ts';

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
  paper: HTMLElement;
  num: HTMLElement;
  badge: HTMLElement;
  /** Marken für Stempel und Unterschrift */
  ops: HTMLElement;
  gap: HTMLElement;
}

export interface Section {
  el: HTMLElement;
  head: HTMLElement;
  fold: HTMLButtonElement;
  name: HTMLInputElement;
  count: HTMLElement;
  /** Zeigt, dass das Dokument Seitenzahlen bekommt; öffnet das Werkzeug */
  numbers: HTMLButtonElement;
  /** Zahl der Trennlinien; Klick teilt an ihnen */
  cuts: HTMLButtonElement;
  menu: HTMLButtonElement;
  list: HTMLElement;
  empty: HTMLElement;
}

export interface GridView {
  zoom: number;
  active: DocId | null;
  collapsed: ReadonlySet<DocId>;
  /** Nach einem Befehl: Seiten gleiten an den neuen Platz */
  animate: boolean;
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

function icon(id: string, size = 16): string {
  return `<svg width="${size}" height="${size}" aria-hidden="true"><use href="#${id}" /></svg>`;
}

function iconButton(className: string, iconId: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = className;
  // Festes Markup ohne Nutzerdaten; der HTML-Parser setzt den SVG-Namensraum selbst.
  b.innerHTML = icon(iconId);
  return b;
}

/** Seitenverhältnis einer DIN-A4-Seite hoch: Kacheln haben diese Form, das Papier passt hinein */
const CELL_RATIO = 210 / 297;

export class Grid {
  private readonly tiles = new Map<PageKey, Tile>();
  private readonly sections = new Map<DocId, Section>();
  private readonly cutlines = new Map<PageKey, HTMLElement>();

  constructor(
    private readonly root: HTMLElement,
    /** Scrollt; Bezug für die Vorschaubilder */
    private readonly scroller: HTMLElement,
    private readonly thumbs: Thumbs,
    private readonly badges: SourceBadges,
  ) {}

  section(id: DocId): Section | undefined {
    return this.sections.get(id);
  }

  /** Für die Namensfelder (Umbenennen) wie bisher */
  column(
    id: DocId,
  ): { name: HTMLInputElement; list: HTMLElement; menu: HTMLButtonElement } | undefined {
    return this.sections.get(id);
  }

  tile(key: PageKey): HTMLElement | undefined {
    return this.tiles.get(key)?.el;
  }

  /** Alle sichtbaren Kacheln in Lesereihenfolge (Tastatur, Auswahlrechteck) */
  visibleTiles(): HTMLElement[] {
    return [...this.root.querySelectorAll<HTMLElement>('.ws-sec:not(.folded) .ws-page')];
  }

  /** Fokus auf die Kachel legen und nur so weit scrollen, dass sie sichtbar ist */
  focusTile(key: PageKey): boolean {
    const el = this.tiles.get(key)?.el;
    if (!el?.isConnected || el.getClientRects().length === 0) return false;
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    return true;
  }

  /** Abschnitt des Dokuments oben in den sichtbaren Bereich holen */
  reveal(doc: DocId): void {
    const el = this.sections.get(doc)?.el;
    if (!el) return;
    this.scroller.scrollTo({
      top: el.offsetTop - 8,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
  }

  render(state: WorkshopState, selection: Selection, view: GridView): void {
    const before = view.animate
      ? measure(
          [...this.tiles.values()].map((tile) => tile.el),
          this.scroller.getBoundingClientRect(),
        )
      : new Map<HTMLElement, DOMRect>();
    const known = new Set(this.tiles.keys());
    this.root.style.setProperty('--tile-w', `${tileWidth(view.zoom)}px`);

    const docs = state.docs;
    const sections = docs.map((doc) => this.sectionFor(doc));
    const els = sections.map((c) => c.el);
    if (!sameChildren(this.root, els)) this.root.replaceChildren(...els);
    const liveDocs = new Set(docs.map((d) => d.id));
    for (const id of this.sections.keys()) if (!liveDocs.has(id)) this.sections.delete(id);

    const live = new Set<PageKey>();
    for (const [i, doc] of docs.entries()) {
      const section = sections[i];
      if (section) this.renderSection(section, doc, state, selection, view, live);
    }
    for (const [key, tile] of this.tiles) {
      if (live.has(key)) continue;
      this.thumbs.forget(tile.paper);
      this.tiles.delete(key);
    }
    for (const key of this.cutlines.keys()) if (!live.has(key)) this.cutlines.delete(key);
    if (view.animate) {
      const fresh = [...live]
        .filter((k) => !known.has(k))
        .flatMap((k) => this.tiles.get(k)?.el ?? []);
      play(before, fresh.length < 60 ? fresh : []);
    }
  }

  private sectionFor(doc: Doc): Section {
    const existing = this.sections.get(doc.id);
    if (existing) return existing;
    const el = document.createElement('section');
    el.className = 'ws-sec';
    el.dataset.doc = doc.id;
    const head = document.createElement('div');
    head.className = 'ws-sec-head';
    head.dataset.doc = doc.id;
    const fold = iconButton('ws-sec-fold', 'i-down');
    fold.dataset.doc = doc.id;
    const name = document.createElement('input');
    name.className = 'ws-name';
    name.type = 'text';
    name.maxLength = 120;
    name.autocomplete = 'off';
    name.spellcheck = false;
    name.dataset.doc = doc.id;
    name.setAttribute('aria-label', t.DOC_NAME_LABEL);
    const count = document.createElement('span');
    count.className = 'ws-count';
    const numbers = iconButton('ws-chip ws-col-numbers', 'i-page-number');
    numbers.dataset.doc = doc.id;
    numbers.hidden = true;
    numbers.title = t.PAGE_NUMBERS_BADGE;
    const cuts = iconButton('ws-chip ws-sec-cuts', 'i-split-parts');
    cuts.dataset.doc = doc.id;
    cuts.hidden = true;
    const cutsText = document.createElement('span');
    cuts.append(cutsText);
    const menu = iconButton('ws-chip ws-col-menu', 'i-dots');
    menu.dataset.doc = doc.id;
    menu.setAttribute('aria-haspopup', 'menu');
    menu.setAttribute('aria-expanded', 'false');
    head.append(fold, name, count, numbers, cuts, menu);
    const list = document.createElement('div');
    list.className = 'ws-pages';
    list.dataset.doc = doc.id;
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-multiselectable', 'true');
    list.setAttribute('aria-orientation', 'horizontal');
    const empty = document.createElement('p');
    empty.className = 'ws-empty-doc';
    empty.textContent = t.EMPTY_DOC;
    empty.id = `ws-empty-${doc.id}`;
    el.append(head, list, empty);
    const section = { el, head, fold, name, count, numbers, cuts, menu, list, empty };
    this.sections.set(doc.id, section);
    return section;
  }

  private renderSection(
    section: Section,
    doc: Doc,
    state: WorkshopState,
    selection: Selection,
    view: GridView,
    live: Set<PageKey>,
  ): void {
    if (document.activeElement !== section.name && section.name.value !== doc.name) {
      section.name.value = doc.name;
    }
    const folded = view.collapsed.has(doc.id);
    section.el.classList.toggle('folded', folded);
    section.el.classList.toggle('active', view.active === doc.id);
    set(section.el, 'aria-label', doc.name);
    set(section.fold, 'aria-expanded', String(!folded));
    set(section.fold, 'aria-label', folded ? t.unfoldDoc(doc.name) : t.foldDoc(doc.name));
    set(section.list, 'aria-label', t.docPagesLabel(doc.name));
    text(section.count, t.pages(doc.pages.length));
    set(section.menu, 'aria-label', t.docMenuLabel(doc.name));
    section.numbers.hidden = pageNumbersOf(doc) === null;
    set(section.numbers, 'aria-label', t.pageNumbersEdit(doc.name));
    const cuts = cutIndices(doc);
    section.cuts.hidden = cuts.length === 0;
    text(section.cuts.lastElementChild ?? section.cuts, t.partsLabel(cuts.length + 1));
    set(section.cuts, 'aria-label', t.splitAtCutsLabel(doc.name, cuts.length + 1));
    section.empty.hidden = doc.pages.length > 0 || folded;
    // Eine leere Liste ist selbst der Tabstopp (Einfügen mit Strg/Cmd+V, W5)
    set(section.list, 'tabindex', doc.pages.length === 0 ? '0' : '-1');
    if (doc.pages.length === 0) set(section.list, 'aria-describedby', section.empty.id);
    else section.list.removeAttribute('aria-describedby');
    if (folded) {
      // Eingeklappt: keine Kacheln im DOM, keine Vorschaubilder
      for (const page of doc.pages) live.add(page.key);
      if (section.list.children.length > 0) section.list.replaceChildren();
      return;
    }

    // Ein Tabstopp je Dokument (roving tabindex): die Seite mit dem Fokus, sonst die erste
    const focusHere = doc.pages.some((p) => p.key === selection.focus);
    const cutAt = new Set(cuts);
    const children: HTMLElement[] = [];
    const tiles = doc.pages.map((page, index) => {
      live.add(page.key);
      const tile = this.tiles.get(page.key) ?? this.createTile(page.key);
      const tabStop = focusHere ? page.key === selection.focus : index === 0;
      this.updateTile(tile, page, index, doc, state, selection, tabStop, cutAt.has(index));
      if (cutAt.has(index)) children.push(this.cutlineFor(page.key, index));
      children.push(tile.el);
      return tile;
    });
    if (!sameChildren(section.list, children)) section.list.replaceChildren(...children);
    const numbers = pageNumbersOf(doc);
    const width = tileWidth(view.zoom);
    for (const [i, tile] of tiles.entries()) {
      const page = doc.pages[i];
      if (!page) continue;
      const kind = page.kind === 'source' ? state.sources.get(page.source)?.kind : undefined;
      this.thumbs.show(
        tile.paper,
        page,
        this.scroller,
        kind ?? 'pdf',
        visiblePageSize(state, page),
        numbers ? { options: numbers, index: i, count: doc.pages.length } : null,
        width,
      );
    }
  }

  private cutlineFor(key: PageKey, index: number): HTMLElement {
    let el = this.cutlines.get(key);
    if (!el) {
      el = document.createElement('div');
      el.className = 'ws-cutline';
      el.dataset.key = key;
      el.setAttribute('aria-hidden', 'true');
      const label = document.createElement('span');
      label.className = 'ws-cutline-label';
      const remove = iconButton('ws-cutline-x', 'i-x');
      remove.tabIndex = -1;
      remove.dataset.key = key;
      remove.title = t.CUT_REMOVE;
      // Festes Markup ohne Nutzerdaten
      el.innerHTML = icon('i-scissors', 15);
      el.append(label, remove);
      this.cutlines.set(key, el);
    }
    text(el.querySelector('.ws-cutline-label') ?? el, t.cutlineLabel(index + 1));
    return el;
  }

  private createTile(key: PageKey): Tile {
    const el = document.createElement('div');
    el.className = 'ws-page';
    el.dataset.key = key;
    el.setAttribute('role', 'option');
    const gap = document.createElement('span');
    gap.className = 'ws-gap';
    gap.dataset.key = key;
    gap.setAttribute('aria-hidden', 'true');
    gap.title = t.GAP_TITLE;
    const sheet = document.createElement('div');
    sheet.className = 'ws-sheet';
    const paper = document.createElement('div');
    paper.className = 'ws-paper';
    sheet.append(paper);
    const meta = document.createElement('div');
    meta.className = 'ws-meta';
    meta.setAttribute('aria-hidden', 'true');
    const num = document.createElement('span');
    num.className = 'ws-num';
    const badge = document.createElement('span');
    badge.className = 'ws-src';
    const ops = document.createElement('span');
    ops.className = 'ws-ops';
    meta.append(num, ops, badge);
    const check = document.createElement('span');
    check.className = 'ws-check';
    // Festes Markup ohne Nutzerdaten; der HTML-Parser setzt den SVG-Namensraum selbst.
    check.innerHTML = icon('i-check', 12);
    el.append(gap, sheet, meta, check);
    const tile = { el, paper, num, badge, ops, gap };
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
    cut: boolean,
  ): void {
    const selected = selection.keys.has(page.key);
    tile.el.classList.toggle('sel', selected);
    tile.el.classList.toggle('first', index === 0);
    tile.el.classList.toggle('cut', cut);
    set(tile.el, 'aria-selected', String(selected));
    set(tile.el, 'tabindex', tabStop ? '0' : '-1');

    const source = page.kind === 'source' ? state.sources.get(page.source) : undefined;
    const label = t.pageLabel({
      position: index + 1,
      count: doc.pages.length,
      source:
        source && page.kind === 'source'
          ? { name: source.name, page: source.kind === 'image' ? null : page.index + 1 }
          : null,
      rotate: page.rotate,
      stamp: stampOf(page) !== null,
      signatures: signaturesOf(page).length,
    });
    set(tile.el, 'aria-label', cut ? `${label}${t.CUT_BEFORE_SUFFIX}` : label);
    const marks =
      `${stampOf(page) ? 'stamp' : ''} ${signaturesOf(page).length ? 'sign' : ''}`.trim();
    if (tile.ops.dataset.marks !== marks) {
      tile.ops.dataset.marks = marks;
      // Festes Markup ohne Nutzerdaten
      tile.ops.innerHTML = marks
        .split(' ')
        .filter(Boolean)
        .map((m) => icon(m === 'stamp' ? 'i-stamp' : 'i-sign', 13))
        .join('');
    }
    text(tile.num, String(index + 1));
    if (page.kind === 'source') {
      const badge = this.badges.get(page.source);
      text(
        tile.badge,
        source?.kind === 'image' ? badge.letter : `${badge.letter}·${page.index + 1}`,
      );
      tile.badge.className = `ws-src c${badge.color}`;
      set(tile.badge, 'title', source?.name ?? '');
    } else {
      text(tile.badge, t.BLANK_BADGE);
      tile.badge.className = 'ws-src blank';
    }

    const size = visiblePageSize(state, page);
    const shape = size.width / size.height > CELL_RATIO ? 'wide' : 'tall';
    tile.paper.className = `ws-paper ${shape}${page.kind === 'blank' ? ' blank' : ''}`;
    const aspect = `${size.width} / ${size.height}`;
    if (tile.paper.style.aspectRatio !== aspect) tile.paper.style.aspectRatio = aspect;
  }
}
