/**
 * Seiten ziehen in der PDF-Werkstatt (plan-phase3.md 6.1, 6.3, 6.5): selbst gebaut mit Pointer
 * Events, keine Bibliothek. Maus: Ziehen ab 6 Pixeln Bewegung. Touch (Tablet): erst nach
 * 300 ms Halten, damit Scrollen frei bleibt; auf dem Handy kein Ziehen (W10), dort gibt es
 * „Verschieben nach …“.
 *
 * Gezogen wird die Auswahl, wenn die gegriffene Seite dazugehört, sonst nur diese Seite. Eine
 * Einfügemarke zeigt das Ziel, auch in anderen und leeren Spalten; am Rand scrollt die Ansicht
 * mit. Esc bricht ab, Alt beim Loslassen kopiert statt zu verschieben. Das Ziel wird auch
 * angesagt („Ziel: vor Seite 5 von Vertrag“, 6.4). Jede Aktion geht auch ohne Ziehen
 * (Tastatur, Menü, Dialog; WCAG 2.5.7).
 */

import { inPageOrder, type DocId, type PageKey } from '../../core/workshop/model.ts';
import { selectOnly } from '../../core/workshop/selection.ts';
import type { Actions } from './actions.ts';
import type { WorkshopStore } from './store.ts';
import { DRAG_CANCELLED, DRAG_NO_TARGET, dragTarget } from './texts.ts';

export interface DragContext {
  store: WorkshopStore;
  actions: Actions;
  board: HTMLElement;
  announce(message: string): void;
  /** Handy-Ansicht (W10): dort kein Ziehen */
  isPhone(): boolean;
}

interface Target {
  doc: DocId;
  index: number;
}

const MOUSE_THRESHOLD = 6;
const TOUCH_HOLD_MS = 300;
const TOUCH_SLOP = 8;
/** Abstand zum Rand, ab dem mitgescrollt wird, und größte Geschwindigkeit je Bild */
const EDGE = 48;
const MAX_SPEED = 18;

export function setupDrag(ctx: DragContext): { active(): boolean } {
  let pending: {
    key: PageKey;
    tile: HTMLElement;
    pointerId: number;
    x: number;
    y: number;
    touch: boolean;
    timer: ReturnType<typeof setTimeout> | undefined;
    ready: boolean;
  } | null = null;
  let drag: {
    keys: PageKey[];
    pointerId: number;
    x: number;
    y: number;
    ghost: HTMLElement;
    target: Target | null;
    frame: number;
  } | null = null;
  const marker = document.createElement('div');
  marker.className = 'ws-marker';
  marker.setAttribute('aria-hidden', 'true');
  /** Nach dem Ziehen den folgenden Klick verschlucken (er würde die Auswahl ändern) */
  let swallowClick = false;

  function ghostFor(keys: readonly PageKey[], tile: HTMLElement): HTMLElement {
    const ghost = document.createElement('div');
    ghost.className = 'ws-ghost';
    ghost.setAttribute('aria-hidden', 'true');
    const paper = tile.querySelector<HTMLElement>('.ws-paper');
    const copy = document.createElement('div');
    copy.className = `ws-paper ${paper?.classList.contains('wide') ? 'wide' : 'tall'}`;
    copy.style.aspectRatio = paper?.style.aspectRatio ?? '';
    const source = paper?.querySelector('canvas');
    if (source && source.width > 0) {
      const canvas = document.createElement('canvas');
      canvas.width = source.width;
      canvas.height = source.height;
      canvas.getContext('2d')?.drawImage(source, 0, 0);
      copy.append(canvas);
    }
    const sheet = document.createElement('div');
    sheet.className = 'ws-sheet';
    sheet.append(copy);
    ghost.append(sheet);
    if (keys.length > 1) {
      const count = document.createElement('span');
      count.className = 'ws-ghost-count';
      count.textContent = String(keys.length);
      ghost.append(count);
    }
    return ghost;
  }

  function start(): void {
    if (!pending) return;
    const { key, tile, pointerId, x, y } = pending;
    pending = null;
    const { store } = ctx;
    if (!store.selection.keys.has(key)) store.select(selectOnly(key));
    const keys = inPageOrder(store.state, store.selection.keys).map((p) => p.key);
    const ghost = ghostFor(keys, tile);
    document.body.append(ghost, marker);
    for (const k of keys) {
      ctx.board.querySelector(`.ws-page[data-key="${CSS.escape(k)}"]`)?.classList.add('dragging');
    }
    try {
      tile.setPointerCapture(pointerId);
    } catch {
      // Zeiger schon weg: Ziehen endet mit dem nächsten pointerup/pointercancel
    }
    drag = { keys, pointerId, x, y, ghost, target: null, frame: 0 };
    document.documentElement.classList.add('ws-dragging');
    update();
    drag.frame = requestAnimationFrame(tick);
  }

  /** Ziel unter dem Zeiger: Spalte und Einfügestelle wie beim Lesen (Zeilen, dann Spalten) */
  function targetAt(
    x: number,
    y: number,
  ): { target: Target; rect: DOMRect | null; after: boolean; list: HTMLElement } | null {
    const col = document.elementsFromPoint(x, y).find((el) => el.classList.contains('ws-col')) as
      HTMLElement | undefined;
    const doc = col?.dataset.doc;
    const list = col?.querySelector<HTMLElement>('.ws-pages');
    if (!col || !doc || !list) return null;
    const tiles = [...list.children] as HTMLElement[];
    for (const [i, tile] of tiles.entries()) {
      const r = tile.getBoundingClientRect();
      if (y < r.bottom && (y < r.top || x < r.left + r.width / 2)) {
        return { target: { doc, index: i }, rect: r, after: false, list };
      }
    }
    const last = tiles[tiles.length - 1];
    return {
      target: { doc, index: tiles.length },
      rect: last ? last.getBoundingClientRect() : null,
      after: true,
      list,
    };
  }

  function update(): void {
    if (!drag) return;
    const { x, y, ghost } = drag;
    ghost.style.transform = `translate(${x + 12}px, ${y + 8}px) rotate(-3deg)`;
    const found = targetAt(x, y);
    for (const col of ctx.board.querySelectorAll('.ws-col.drop-target')) {
      if (col.getAttribute('data-doc') !== found?.target.doc) col.classList.remove('drop-target');
    }
    if (!found) {
      marker.hidden = true;
      if (drag.target) ctx.announce(DRAG_NO_TARGET);
      drag.target = null;
      return;
    }
    ctx.board
      .querySelector(`.ws-col[data-doc="${CSS.escape(found.target.doc)}"]`)
      ?.classList.add('drop-target');
    marker.hidden = false;
    if (found.rect) {
      const r = found.rect;
      marker.className = 'ws-marker vertical';
      marker.style.left = `${found.after ? r.right + 2 : r.left - 6}px`;
      marker.style.top = `${r.top + 4}px`;
      marker.style.width = '';
      marker.style.height = `${r.height - 8}px`;
    } else {
      const r =
        found.list.parentElement?.getBoundingClientRect() ?? found.list.getBoundingClientRect();
      marker.className = 'ws-marker horizontal';
      marker.style.left = `${r.left + 16}px`;
      marker.style.top = `${r.top + 14}px`;
      marker.style.width = `${r.width - 32}px`;
      marker.style.height = '';
    }
    const changed =
      drag.target?.doc !== found.target.doc || drag.target.index !== found.target.index;
    drag.target = found.target;
    if (changed) announceTarget(found.target);
  }

  function announceTarget(target: Target): void {
    const doc = ctx.store.state.docs.find((d) => d.id === target.doc);
    if (!doc) return;
    const before = doc.pages[target.index];
    ctx.announce(dragTarget(doc.name, before ? target.index + 1 : null));
  }

  /** Mitscrollen am Rand: Spalte senkrecht, Brett waagerecht, Seite senkrecht */
  function tick(): void {
    if (!drag) return;
    const { x, y } = drag;
    const speed = (distance: number) =>
      distance < EDGE ? Math.ceil(((EDGE - distance) / EDGE) * MAX_SPEED) : 0;
    let scrolled = false;
    const body = document
      .elementsFromPoint(x, y)
      .find((el) => el.classList.contains('ws-col-body'));
    if (body) {
      const r = body.getBoundingClientRect();
      const dy = speed(y - r.top) ? -speed(y - r.top) : speed(r.bottom - y);
      if (dy !== 0) {
        body.scrollTop += dy;
        scrolled = true;
      }
    }
    const b = ctx.board.getBoundingClientRect();
    if (y >= b.top && y <= b.bottom) {
      const dx = speed(x - b.left) ? -speed(x - b.left) : speed(b.right - x);
      if (dx !== 0) {
        ctx.board.scrollLeft += dx;
        scrolled = true;
      }
    }
    const wy = speed(y) ? -speed(y) : speed(window.innerHeight - y);
    if (wy !== 0 && !body) {
      window.scrollBy(0, wy);
      scrolled = true;
    }
    if (scrolled) update();
    drag.frame = requestAnimationFrame(tick);
  }

  function end(apply: boolean, copy: boolean): void {
    if (pending) {
      clearTimeout(pending.timer);
      pending = null;
    }
    if (!drag) return;
    const { keys, target, ghost, frame } = drag;
    drag = null;
    cancelAnimationFrame(frame);
    ghost.remove();
    marker.remove();
    document.documentElement.classList.remove('ws-dragging');
    for (const el of ctx.board.querySelectorAll('.dragging, .drop-target')) {
      el.classList.remove('dragging', 'drop-target');
    }
    swallowClick = true;
    setTimeout(() => (swallowClick = false), 0);
    if (!apply || !target) {
      ctx.announce(DRAG_CANCELLED);
      return;
    }
    if (copy) ctx.actions.copyTo(keys, target.doc, target.index);
    else ctx.actions.moveTo(keys, target.doc, target.index);
  }

  ctx.board.addEventListener('pointerdown', (event) => {
    const tile = (event.target as Element).closest<HTMLElement>('.ws-page');
    const key = tile?.dataset.key;
    if (!tile || !key || drag || event.button !== 0 || ctx.isPhone()) return;
    const touch = event.pointerType !== 'mouse';
    pending = {
      key,
      tile,
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
  });

  window.addEventListener('pointermove', (event) => {
    if (pending && event.pointerId === pending.pointerId) {
      const moved = Math.hypot(event.clientX - pending.x, event.clientY - pending.y);
      if (pending.touch && moved > TOUCH_SLOP) {
        // Vor Ablauf der Haltezeit bewegt: Das ist Scrollen, kein Ziehen.
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
    update();
  });

  // Während eines Touch-Ziehens nicht scrollen (passive: false, sonst wirkt preventDefault nicht)
  window.addEventListener(
    'touchmove',
    (event) => {
      if (drag || pending?.ready) event.preventDefault();
    },
    { passive: false },
  );
  // Langes Drücken öffnet sonst das Kontextmenü des Browsers
  ctx.board.addEventListener('contextmenu', (event) => {
    if (drag) event.preventDefault();
  });

  window.addEventListener('pointerup', (event) => {
    if (pending && event.pointerId === pending.pointerId) {
      clearTimeout(pending.timer);
      pending = null;
      return;
    }
    if (drag && event.pointerId === drag.pointerId) end(true, event.altKey);
  });
  window.addEventListener('pointercancel', (event) => {
    if (pending?.pointerId === event.pointerId) end(false, false);
    if (drag?.pointerId === event.pointerId) end(false, false);
  });
  window.addEventListener(
    'keydown',
    (event) => {
      if (!drag || event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      end(false, false);
    },
    true,
  );
  ctx.board.addEventListener(
    'click',
    (event) => {
      if (!swallowClick) return;
      event.stopPropagation();
      event.preventDefault();
    },
    true,
  );

  return { active: () => drag !== null };
}
