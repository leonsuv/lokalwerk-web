/**
 * Ziehen in der PDF-Werkstatt (Umbau zum Editor), selbst gebaut mit Pointer Events:
 *
 * Seiten (aus dem Raster oder den Miniaturen links): Die gezogenen Seiten klappen im Raster
 * zusammen, an der Zielstelle öffnet sich ein Platzhalter, die übrigen Seiten gleiten zur Seite.
 * Der Mauszeiger trägt einen Stapel mit Zähler. Ziele: jede Stelle in jedem Dokument, die
 * Miniaturen, ein Dokument in der Liste links (ans Ende; nach kurzem Verweilen springt die
 * Ansicht dorthin) und die Fläche unter den Dokumenten (neues Dokument). Beim Loslassen rastet
 * die Seite an ihrem Platz ein. Alt kopiert, Esc bricht ab.
 *
 * Dokumente (aus der Liste links): zwischen zwei Dokumente ordnet um, auf ein Dokument führt
 * beide zusammen (das gezogene kommt ans Ende).
 *
 * Maus ab 6 Pixeln Bewegung, Touch nach 300 ms Halten; auf dem Handy kein Ziehen (W10). Jede
 * Aktion geht auch ohne Ziehen (Menüs, Tastatur; WCAG 2.5.7). Ziel und Ergebnis werden angesagt.
 */

import { dropIndex, type Box } from '../../core/workshop/layout.ts';
import { findDoc, inPageOrder, type DocId, type PageKey } from '../../core/workshop/model.ts';
import { selectOnly } from '../../core/workshop/selection.ts';
import type { Actions } from './actions.ts';
import { measure, play, settleFrom } from './motion.ts';
import type { WorkshopStore } from './store.ts';
import * as t from './texts.ts';

export interface DragContext {
  store: WorkshopStore;
  actions: Actions;
  /** Bereiche, in denen Ziehen beginnen kann und Ziele liegen */
  board: HTMLElement;
  scroller: HTMLElement;
  rail: HTMLElement;
  docList: HTMLElement;
  announce(message: string): void;
  /** Handy-Ansicht (W10) oder Schere: kein Ziehen */
  disabled(): boolean;
  /** Dokument der Miniaturen links */
  railDoc(): DocId | null;
  /** Dokument aktivieren und im Raster zeigen (Verweilen über der Liste) */
  activate(doc: DocId): void;
  /** Seiten in ein neues Dokument (Ablegen unter den Dokumenten) */
  toNewDoc(keys: readonly PageKey[], copy: boolean): void;
}

type PageTarget =
  | { kind: 'at'; doc: DocId; index: number; where: 'grid' | 'rail' }
  | { kind: 'end'; doc: DocId }
  | { kind: 'new' };

type DocTarget = { kind: 'order'; index: number } | { kind: 'merge'; doc: DocId };

const MOUSE_THRESHOLD = 6;
const TOUCH_HOLD_MS = 300;
const TOUCH_SLOP = 8;
const SPRING_MS = 650;
const EDGE = 56;
const MAX_SPEED = 20;

function boxOf(el: Element): Box {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
}

function inside(r: DOMRect, x: number, y: number): boolean {
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
}

export function setupDrag(ctx: DragContext): { active(): boolean } {
  let pending: {
    source: 'page' | 'doc';
    id: string;
    el: HTMLElement;
    pointerId: number;
    x: number;
    y: number;
    touch: boolean;
    timer: ReturnType<typeof setTimeout> | undefined;
    ready: boolean;
  } | null = null;

  let drag: {
    source: 'page' | 'doc';
    keys: PageKey[];
    doc: DocId | null;
    pointerId: number;
    x: number;
    y: number;
    alt: boolean;
    ghost: HTMLElement;
    target: PageTarget | DocTarget | null;
    frame: number;
    spring: { doc: DocId; timer: ReturnType<typeof setTimeout> } | null;
    hidden: HTMLElement[];
  } | null = null;

  const placeholder = document.createElement('div');
  placeholder.className = 'ws-placeholder';
  placeholder.setAttribute('aria-hidden', 'true');
  const marker = document.createElement('div');
  marker.className = 'ws-marker';
  marker.setAttribute('aria-hidden', 'true');
  const newDoc = document.createElement('div');
  newDoc.className = 'ws-newdoc-drop';
  newDoc.setAttribute('aria-hidden', 'true');
  newDoc.textContent = t.DROP_NEW_DOC;
  let swallowClick = false;
  let lastAnnounced = '';

  // -------------------------------------------------------------------------------------------
  // Stapel am Mauszeiger

  function ghostFor(keys: readonly PageKey[], label: string | null): HTMLElement {
    const ghost = document.createElement('div');
    ghost.className = 'ws-ghost';
    ghost.setAttribute('aria-hidden', 'true');
    if (label !== null) {
      ghost.classList.add('doc');
      ghost.textContent = label;
      return ghost;
    }
    const stack = document.createElement('div');
    stack.className = 'ws-ghost-stack';
    for (const [i, key] of keys.slice(0, 3).entries()) {
      const tile = ctx.board.querySelector<HTMLElement>(
        `.ws-page[data-key="${CSS.escape(key)}"] .ws-paper`,
      );
      const sheet = document.createElement('div');
      sheet.className = 'ws-ghost-sheet';
      sheet.style.setProperty('--i', String(i));
      const canvas = tile?.querySelector('canvas');
      if (canvas && canvas.width > 0) {
        const copy = document.createElement('canvas');
        copy.width = canvas.width;
        copy.height = canvas.height;
        copy.getContext('2d')?.drawImage(canvas, 0, 0);
        sheet.append(copy);
      }
      if (tile) sheet.style.aspectRatio = tile.style.aspectRatio;
      stack.prepend(sheet);
    }
    ghost.append(stack);
    if (keys.length > 1) {
      const count = document.createElement('span');
      count.className = 'ws-ghost-count';
      count.textContent = String(keys.length);
      ghost.append(count);
    }
    return ghost;
  }

  // -------------------------------------------------------------------------------------------
  // Start und Ende

  function start(): void {
    if (!pending) return;
    const { source, id, el, pointerId, x, y } = pending;
    pending = null;
    const { store } = ctx;
    let keys: PageKey[] = [];
    let label: string | null = null;
    if (source === 'page') {
      if (!store.selection.keys.has(id)) store.select(selectOnly(id));
      keys = inPageOrder(store.state, store.selection.keys).map((p) => p.key);
    } else {
      label = findDoc(store.state, id)?.name ?? '';
    }
    const ghost = ghostFor(keys, label);
    document.body.append(ghost);
    try {
      el.setPointerCapture(pointerId);
    } catch {
      // Zeiger schon weg: Ziehen endet mit dem nächsten pointerup/pointercancel
    }
    const hidden: HTMLElement[] = [];
    if (source === 'page') {
      // Gezogene Seiten klappen im Raster zusammen, die übrigen rücken nach
      const before = measure(
        ctx.board.querySelectorAll<HTMLElement>('.ws-page'),
        ctx.scroller.getBoundingClientRect(),
      );
      for (const k of keys) {
        for (const tile of document.querySelectorAll<HTMLElement>(
          `.ws-page[data-key="${CSS.escape(k)}"], .ws-rail-item[data-key="${CSS.escape(k)}"]`,
        )) {
          tile.classList.add('dragging');
          hidden.push(tile);
        }
      }
      play(before);
      ctx.board.append(newDoc);
    } else {
      el.classList.add('dragging');
      hidden.push(el);
    }
    drag = {
      source,
      keys,
      doc: source === 'doc' ? id : null,
      pointerId,
      x,
      y,
      alt: false,
      ghost,
      target: null,
      frame: 0,
      spring: null,
      hidden,
    };
    document.documentElement.classList.add('ws-dragging');
    ctx.announce(source === 'page' ? t.dragStart(keys.length) : t.dragDocStart(label ?? ''));
    update();
    drag.frame = requestAnimationFrame(tick);
  }

  function cleanup(): void {
    if (!drag) return;
    cancelAnimationFrame(drag.frame);
    if (drag.spring) clearTimeout(drag.spring.timer);
    drag.ghost.remove();
    placeholder.remove();
    marker.remove();
    newDoc.remove();
    for (const el of drag.hidden) el.classList.remove('dragging');
    document.documentElement.classList.remove('ws-dragging');
    for (const el of document.querySelectorAll('.drop-target, .drop-merge')) {
      el.classList.remove('drop-target', 'drop-merge');
    }
    swallowClick = true;
    setTimeout(() => (swallowClick = false), 0);
  }

  function end(apply: boolean): void {
    if (pending) {
      clearTimeout(pending.timer);
      pending = null;
    }
    if (!drag) return;
    const current = drag;
    const ghostRect = current.ghost.getBoundingClientRect();
    const before = measure(
      ctx.board.querySelectorAll<HTMLElement>('.ws-page'),
      ctx.scroller.getBoundingClientRect(),
    );
    cleanup();
    drag = null;
    lastAnnounced = '';
    const { target } = current;
    if (!apply || !target) {
      play(before);
      ctx.announce(t.DRAG_CANCELLED);
      return;
    }
    const { actions } = ctx;
    if (current.source === 'doc' && current.doc) {
      if (target.kind === 'order') actions.moveDoc(current.doc, target.index);
      else if (target.kind === 'merge') actions.join([target.doc, current.doc]);
      return;
    }
    const keys = current.keys;
    if (target.kind === 'at') {
      if (current.alt) actions.copyTo(keys, target.doc, target.index);
      else actions.moveTo(keys, target.doc, target.index);
    } else if (target.kind === 'end') {
      const doc = findDoc(ctx.store.state, target.doc);
      if (!doc) return;
      if (current.alt) actions.copyTo(keys, doc.id, doc.pages.length);
      else actions.moveTo(keys, doc.id, doc.pages.length);
    } else if (target.kind === 'new') {
      ctx.toNewDoc(keys, current.alt);
    }
    // Einrasten: die abgelegten Seiten gleiten vom Stapel an ihren Platz
    const moved = ctx.store.selection.keys;
    for (const key of moved) {
      const tile = ctx.board.querySelector<HTMLElement>(`.ws-page[data-key="${CSS.escape(key)}"]`);
      if (tile) settleFrom(tile, ghostRect);
    }
  }

  // -------------------------------------------------------------------------------------------
  // Ziel suchen

  function pageTarget(x: number, y: number): PageTarget | null {
    const hit = document.elementsFromPoint(x, y);
    const docItem = hit.find((el) => el.classList.contains('ws-doc')) as HTMLElement | undefined;
    if (docItem?.dataset.doc) return { kind: 'end', doc: docItem.dataset.doc };
    if (hit.includes(ctx.rail) || hit.some((el) => ctx.rail.contains(el))) {
      const doc = ctx.railDoc();
      if (!doc) return null;
      const items = [...ctx.rail.querySelectorAll<HTMLElement>('.ws-rail-item:not(.dragging)')];
      let index = items.length;
      for (const [i, item] of items.entries()) {
        const r = item.getBoundingClientRect();
        if (y < (r.top + r.bottom) / 2) {
          index = i;
          break;
        }
      }
      return { kind: 'at', doc, index: fullIndex(doc, items, index), where: 'rail' };
    }
    if (hit.includes(newDoc)) return { kind: 'new' };
    const head = hit.find((el) => el.classList.contains('ws-sec-head')) as HTMLElement | undefined;
    const section =
      (hit.find((el) => el.classList.contains('ws-sec')) as HTMLElement | undefined) ?? null;
    if (section?.classList.contains('folded') || (head && head.dataset.doc)) {
      const doc = (head ?? section)?.dataset.doc;
      if (doc) return { kind: 'end', doc };
    }
    const list = section?.querySelector<HTMLElement>('.ws-pages');
    const doc = section?.dataset.doc;
    if (!list || !doc) return null;
    // Über dem Platzhalter: Ziel bleibt (sonst würde er hin und her springen)
    if (placeholder.parentElement === list && inside(placeholder.getBoundingClientRect(), x, y)) {
      return drag?.target?.kind === 'at' ? drag.target : null;
    }
    const tiles = [...list.querySelectorAll<HTMLElement>(':scope > .ws-page:not(.dragging)')];
    const index = dropIndex(tiles.map(boxOf), x, y);
    return { kind: 'at', doc, index: fullIndex(doc, tiles, index), where: 'grid' };
  }

  /** Stelle unter den sichtbaren Kacheln → Stelle im Dokument (vor derselben Seite) */
  function fullIndex(doc: DocId, tiles: readonly HTMLElement[], index: number): number {
    const pages = findDoc(ctx.store.state, doc)?.pages ?? [];
    const key = tiles[index]?.dataset.key;
    const at = key ? pages.findIndex((p) => p.key === key) : -1;
    return at >= 0 ? at : pages.length;
  }

  function docTarget(x: number, y: number): DocTarget | null {
    const items = [...ctx.docList.querySelectorAll<HTMLElement>('.ws-doc')];
    const listRect = ctx.docList.getBoundingClientRect();
    if (!inside(listRect, x, y)) return null;
    for (const [i, item] of items.entries()) {
      const r = item.getBoundingClientRect();
      if (y < r.top || y > r.bottom) continue;
      const part = (y - r.top) / r.height;
      if (item.dataset.doc === drag?.doc) return null;
      if (part < 0.28) return { kind: 'order', index: i };
      if (part > 0.72) return { kind: 'order', index: i + 1 };
      return { kind: 'merge', doc: item.dataset.doc ?? '' };
    }
    return { kind: 'order', index: items.length };
  }

  // -------------------------------------------------------------------------------------------
  // Anzeige des Ziels

  function showPlaceholder(target: PageTarget | null): void {
    const list =
      target?.kind === 'at' && target.where === 'grid'
        ? ctx.board.querySelector<HTMLElement>(`.ws-pages[data-doc="${CSS.escape(target.doc)}"]`)
        : null;
    if (!list || target?.kind !== 'at') {
      if (placeholder.isConnected) {
        const parent = placeholder.parentElement;
        const before = measure(
          parent?.querySelectorAll<HTMLElement>('.ws-page') ?? [],
          ctx.scroller.getBoundingClientRect(),
        );
        placeholder.remove();
        play(before);
      }
      return;
    }
    const pages = findDoc(ctx.store.state, target.doc)?.pages ?? [];
    // Vor die erste nicht gezogene Seite ab der Stelle
    const moving = new Set(drag?.keys ?? []);
    const anchorKey = pages.slice(target.index).find((p) => !moving.has(p.key))?.key;
    const anchor = anchorKey
      ? list.querySelector<HTMLElement>(`:scope > .ws-page[data-key="${CSS.escape(anchorKey)}"]`)
      : null;
    // Eine Trennlinie gehört vor ihre Seite: Platzhalter davor
    const cutline = anchor?.previousElementSibling?.classList.contains('ws-cutline')
      ? (anchor.previousElementSibling as HTMLElement)
      : null;
    const ref = cutline ?? anchor;
    if (placeholder.parentElement === list && placeholder.nextElementSibling === ref) return;
    if (!ref && placeholder.parentElement === list && placeholder === list.lastElementChild) return;
    const affected = new Set<HTMLElement>([
      ...list.querySelectorAll<HTMLElement>('.ws-page, .ws-cutline'),
      ...(placeholder.parentElement?.querySelectorAll<HTMLElement>('.ws-page, .ws-cutline') ?? []),
    ]);
    const before = measure(affected, ctx.scroller.getBoundingClientRect());
    list.insertBefore(placeholder, ref);
    play(before);
  }

  function showMarker(target: PageTarget | DocTarget | null): void {
    marker.hidden = true;
    for (const el of document.querySelectorAll('.drop-target, .drop-merge')) {
      el.classList.remove('drop-target', 'drop-merge');
    }
    newDoc.classList.toggle('over', target?.kind === 'new');
    if (!target) return;
    if (target.kind === 'at' && target.where === 'rail') {
      const items = [...ctx.rail.querySelectorAll<HTMLElement>('.ws-rail-item:not(.dragging)')];
      const pages = findDoc(ctx.store.state, target.doc)?.pages ?? [];
      const key = pages[target.index]?.key;
      const item = key ? items.find((i) => i.dataset.key === key) : undefined;
      const ref = item ?? items[items.length - 1];
      if (!ref) return;
      const r = ref.getBoundingClientRect();
      placeMarker(r.left, item ? r.top - 4 : r.bottom + 2, r.width, 'horizontal');
      return;
    }
    if (target.kind === 'end') {
      ctx.docList
        .querySelector(`.ws-doc[data-doc="${CSS.escape(target.doc)}"]`)
        ?.classList.add('drop-target');
      ctx.board
        .querySelector(`.ws-sec[data-doc="${CSS.escape(target.doc)}"]`)
        ?.classList.add('drop-target');
      return;
    }
    if (target.kind === 'merge') {
      ctx.docList
        .querySelector(`.ws-doc[data-doc="${CSS.escape(target.doc)}"]`)
        ?.classList.add('drop-merge');
      return;
    }
    if (target.kind === 'order') {
      const items = [...ctx.docList.querySelectorAll<HTMLElement>('.ws-doc')];
      const item = items[target.index];
      const last = items[items.length - 1];
      const r = (item ?? last)?.getBoundingClientRect();
      if (!r) return;
      placeMarker(r.left + 4, item ? r.top - 2 : r.bottom, r.width - 8, 'horizontal');
    }
  }

  function placeMarker(x: number, y: number, size: number, dir: 'horizontal' | 'vertical'): void {
    if (!marker.isConnected) document.body.append(marker);
    marker.hidden = false;
    marker.className = `ws-marker ${dir}`;
    marker.style.left = `${x}px`;
    marker.style.top = `${y}px`;
    marker.style.width = dir === 'horizontal' ? `${size}px` : '';
    marker.style.height = dir === 'vertical' ? `${size}px` : '';
  }

  function announce(target: PageTarget | DocTarget | null): void {
    const { state } = ctx.store;
    let text: string = t.DRAG_NO_TARGET;
    if (target?.kind === 'at') {
      const doc = findDoc(state, target.doc);
      if (doc) text = t.dragTarget(doc.name, doc.pages[target.index] ? target.index + 1 : null);
    } else if (target?.kind === 'end') {
      text = t.dragTarget(findDoc(state, target.doc)?.name ?? '', null);
    } else if (target?.kind === 'new') {
      text = t.DROP_NEW_DOC;
    } else if (target?.kind === 'merge') {
      text = t.dragMerge(findDoc(state, target.doc)?.name ?? '');
    } else if (target?.kind === 'order') {
      text = t.dragOrder(target.index + 1);
    }
    if (text !== lastAnnounced) {
      lastAnnounced = text;
      ctx.announce(text);
    }
  }

  function update(): void {
    if (!drag) return;
    const { x, y, ghost } = drag;
    ghost.style.transform = `translate(${x + 14}px, ${y + 10}px)`;
    ghost.classList.toggle('copy', drag.alt);
    const target = drag.source === 'page' ? pageTarget(x, y) : docTarget(x, y);
    drag.target = target;
    if (drag.source === 'page') showPlaceholder(target as PageTarget | null);
    showMarker(target);
    announce(target);
    // Verweilen über einem Dokument der Liste: dorthin springen
    const over = target?.kind === 'end' ? target.doc : null;
    const onList = over && ctx.docList.contains(document.elementFromPoint(x, y));
    if (drag.spring && drag.spring.doc !== over) {
      clearTimeout(drag.spring.timer);
      drag.spring = null;
    }
    if (onList && over && !drag.spring) {
      drag.spring = {
        doc: over,
        timer: setTimeout(() => {
          if (drag?.spring?.doc === over) ctx.activate(over);
        }, SPRING_MS),
      };
    }
  }

  /** Mitscrollen am Rand der Arbeitsfläche, der Miniaturen und der Liste */
  function tick(): void {
    if (!drag) return;
    const { x, y } = drag;
    const speed = (distance: number) =>
      distance < EDGE ? Math.ceil(((EDGE - distance) / EDGE) * MAX_SPEED) : 0;
    let scrolled = false;
    for (const area of [ctx.scroller, ctx.rail, ctx.docList]) {
      const r = area.getBoundingClientRect();
      if (x < r.left || x > r.right || y < r.top - 20 || y > r.bottom + 20) continue;
      const up = speed(y - r.top);
      const dy = up ? -up : speed(r.bottom - y);
      if (dy !== 0 && area.scrollHeight > area.clientHeight) {
        area.scrollTop += dy;
        scrolled = true;
      }
    }
    if (scrolled) update();
    drag.frame = requestAnimationFrame(tick);
  }

  // -------------------------------------------------------------------------------------------
  // Zeiger

  function begin(event: PointerEvent, source: 'page' | 'doc', id: string, el: HTMLElement): void {
    const touch = event.pointerType !== 'mouse';
    pending = {
      source,
      id,
      el,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      touch,
      timer: undefined,
      ready: !touch,
    };
    if (touch) {
      const current = pending;
      current.timer = setTimeout(() => {
        if (pending !== current) return;
        current.ready = true;
        start();
      }, TOUCH_HOLD_MS);
    }
  }

  for (const area of [ctx.board, ctx.rail, ctx.docList]) {
    area.addEventListener('pointerdown', (event) => {
      if (drag || event.button !== 0 || ctx.disabled()) return;
      const target = event.target as Element;
      if (target.closest('input, .ws-gap, .ws-cutline, button:not(.ws-rail-item)')) return;
      const tile = target.closest<HTMLElement>('.ws-page, .ws-rail-item');
      if (tile?.dataset.key) {
        begin(event, 'page', tile.dataset.key, tile);
        return;
      }
      const doc = target.closest<HTMLElement>('.ws-doc');
      if (doc?.dataset.doc) begin(event, 'doc', doc.dataset.doc, doc);
    });
  }

  window.addEventListener('pointermove', (event) => {
    if (pending && event.pointerId === pending.pointerId) {
      const moved = Math.hypot(event.clientX - pending.x, event.clientY - pending.y);
      if (pending.touch && !pending.ready && moved > TOUCH_SLOP) {
        clearTimeout(pending.timer);
        pending = null;
      } else if (!pending.touch && moved >= MOUSE_THRESHOLD) {
        pending.x = event.clientX;
        pending.y = event.clientY;
        start();
      }
      return;
    }
    if (!drag || event.pointerId !== drag.pointerId) return;
    drag.x = event.clientX;
    drag.y = event.clientY;
    drag.alt = event.altKey;
    update();
  });

  window.addEventListener(
    'touchmove',
    (event) => {
      if (drag || pending?.ready) event.preventDefault();
    },
    { passive: false },
  );
  for (const area of [ctx.board, ctx.rail, ctx.docList]) {
    area.addEventListener('contextmenu', (event) => {
      if (drag) event.preventDefault();
    });
    area.addEventListener(
      'click',
      (event) => {
        if (!swallowClick) return;
        event.stopPropagation();
        event.preventDefault();
      },
      true,
    );
  }

  window.addEventListener('pointerup', (event) => {
    if (pending && event.pointerId === pending.pointerId) {
      clearTimeout(pending.timer);
      pending = null;
      return;
    }
    if (drag && event.pointerId === drag.pointerId) {
      drag.alt = event.altKey;
      end(true);
    }
  });
  window.addEventListener('pointercancel', (event) => {
    if (pending?.pointerId === event.pointerId || drag?.pointerId === event.pointerId) end(false);
  });
  window.addEventListener(
    'keydown',
    (event) => {
      if (!drag) return;
      if (event.key === 'Alt') {
        drag.alt = true;
        update();
      }
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      end(false);
    },
    true,
  );
  window.addEventListener('keyup', (event) => {
    if (drag && event.key === 'Alt') {
      drag.alt = false;
      update();
    }
  });

  return { active: () => drag !== null || pending !== null };
}
