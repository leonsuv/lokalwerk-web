/**
 * Linke Leiste der PDF-Werkstatt (Umbau zum Editor): oben die Dokumente als Liste (Listbox,
 * Auswahl = aktives Dokument), darunter die Seitenminiaturen des aktiven Dokuments. Beides lässt
 * sich ziehen (drag.ts): Seiten auf ein Dokument der Liste verschieben sie dorthin, ein Dokument
 * auf ein anderes führt beide zusammen, zwischen zwei Dokumente ordnet es um.
 */

import {
  cutIndices,
  pageNumbersOf,
  visiblePageSize,
  type Doc,
  type DocId,
  type PageKey,
  type WorkshopState,
} from '../../core/workshop/model.ts';
import type { Selection } from '../../core/workshop/selection.ts';
import type { Thumbs } from './thumbs.ts';
import * as t from './texts.ts';

function set(el: Element, name: string, value: string): void {
  if (el.getAttribute(name) !== value) el.setAttribute(name, value);
}

function text(el: Element, value: string): void {
  if (el.textContent !== value) el.textContent = value;
}

interface DocItem {
  el: HTMLElement;
  name: HTMLElement;
  meta: HTMLElement;
  flags: HTMLElement;
}

export class DocList {
  private readonly items = new Map<DocId, DocItem>();

  constructor(private readonly root: HTMLElement) {}

  item(doc: DocId): HTMLElement | undefined {
    return this.items.get(doc)?.el;
  }

  focus(doc: DocId): void {
    this.items.get(doc)?.el.focus();
  }

  render(state: WorkshopState, active: DocId | null, selection: Selection): void {
    const els = state.docs.map((doc) => {
      const item = this.items.get(doc.id) ?? this.create(doc.id);
      this.update(item, doc, doc.id === active, selection);
      return item.el;
    });
    const same =
      this.root.children.length === els.length &&
      els.every((el, i) => this.root.children[i] === el);
    if (!same) this.root.replaceChildren(...els);
    const live = new Set(state.docs.map((d) => d.id));
    for (const id of this.items.keys()) if (!live.has(id)) this.items.delete(id);
    // Ein Tabstopp: das aktive Dokument
    const stop = active && live.has(active) ? active : state.docs[0]?.id;
    for (const [id, item] of this.items) set(item.el, 'tabindex', id === stop ? '0' : '-1');
  }

  private create(id: DocId): DocItem {
    const el = document.createElement('div');
    el.className = 'ws-doc';
    el.dataset.doc = id;
    el.setAttribute('role', 'option');
    const ic = document.createElement('span');
    ic.className = 'ws-doc-ic';
    // Festes Markup ohne Nutzerdaten
    ic.innerHTML = '<svg width="16" height="16" aria-hidden="true"><use href="#i-pdf" /></svg>';
    const body = document.createElement('span');
    body.className = 'ws-doc-body';
    const name = document.createElement('span');
    name.className = 'ws-doc-name';
    const meta = document.createElement('span');
    meta.className = 'ws-doc-meta';
    body.append(name, meta);
    const flags = document.createElement('span');
    flags.className = 'ws-doc-flags';
    flags.setAttribute('aria-hidden', 'true');
    el.append(ic, body, flags);
    const item = { el, name, meta, flags };
    this.items.set(id, item);
    return item;
  }

  private update(item: DocItem, doc: Doc, active: boolean, selection: Selection): void {
    text(item.name, doc.name);
    const selected = doc.pages.filter((p) => selection.keys.has(p.key)).length;
    text(
      item.meta,
      selected > 0 ? t.docMetaSelected(doc.pages.length, selected) : t.pages(doc.pages.length),
    );
    const flags = [
      pageNumbersOf(doc) ? t.FLAG_NUMBERS : '',
      cutIndices(doc).length > 0 ? t.partsLabel(cutIndices(doc).length + 1) : '',
      doc.redacted ? t.FLAG_REDACTED : '',
    ].filter(Boolean);
    text(item.flags, flags.join(' · '));
    set(item.el, 'aria-selected', String(active));
    item.el.classList.toggle('active', active);
    set(item.el, 'aria-label', t.docItemLabel(doc.name, doc.pages.length, flags));
  }
}

interface RailItem {
  el: HTMLButtonElement;
  paper: HTMLElement;
  num: HTMLElement;
}

/** Seitenminiaturen des aktiven Dokuments */
export class PageRail {
  private readonly items = new Map<PageKey, RailItem>();
  private doc: DocId | null = null;

  constructor(
    private readonly root: HTMLElement,
    private readonly thumbs: Thumbs,
  ) {}

  item(key: PageKey): HTMLElement | undefined {
    return this.items.get(key)?.el;
  }

  get docId(): DocId | null {
    return this.doc;
  }

  render(
    state: WorkshopState,
    active: DocId | null,
    selection: Selection,
    current: PageKey | null,
  ): void {
    const doc = state.docs.find((d) => d.id === active);
    this.doc = doc?.id ?? null;
    const pages = doc?.pages ?? [];
    const numbers = doc ? pageNumbersOf(doc) : null;
    const cuts = new Set(doc ? cutIndices(doc) : []);
    const live = new Set<PageKey>();
    const focusKey = pages.some((p) => p.key === current) ? current : (pages[0]?.key ?? null);
    const els = pages.map((page, i) => {
      live.add(page.key);
      const item = this.items.get(page.key) ?? this.create(page.key);
      text(item.num, String(i + 1));
      item.el.classList.toggle('sel', selection.keys.has(page.key));
      item.el.classList.toggle('cut', cuts.has(i));
      set(item.el, 'aria-label', t.railLabel(i + 1, pages.length, selection.keys.has(page.key)));
      if (page.key === current) set(item.el, 'aria-current', 'true');
      else item.el.removeAttribute('aria-current');
      set(item.el, 'tabindex', page.key === focusKey ? '0' : '-1');
      const size = visiblePageSize(state, page);
      const aspect = `${size.width} / ${size.height}`;
      if (item.paper.style.aspectRatio !== aspect) item.paper.style.aspectRatio = aspect;
      item.paper.classList.toggle('wide', size.width > size.height);
      const kind = page.kind === 'source' ? state.sources.get(page.source)?.kind : undefined;
      this.thumbs.show(
        item.paper,
        page,
        this.root,
        kind ?? 'pdf',
        size,
        numbers ? { options: numbers, index: i, count: pages.length } : null,
        64,
      );
      return item.el;
    });
    const same =
      this.root.children.length === els.length &&
      els.every((el, i) => this.root.children[i] === el);
    if (!same) this.root.replaceChildren(...els);
    for (const [key, item] of this.items) {
      if (live.has(key)) continue;
      this.thumbs.forget(item.paper);
      this.items.delete(key);
    }
  }

  /** Miniatur der Seite ins Bild holen */
  reveal(key: PageKey): void {
    this.items.get(key)?.el.scrollIntoView({ block: 'nearest' });
  }

  private create(key: PageKey): RailItem {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'ws-rail-item';
    el.dataset.key = key;
    const paper = document.createElement('span');
    paper.className = 'ws-paper ws-rail-paper';
    const num = document.createElement('span');
    num.className = 'ws-rail-num';
    num.setAttribute('aria-hidden', 'true');
    el.append(paper, num);
    const item = { el, paper, num };
    this.items.set(key, item);
    return item;
  }
}
