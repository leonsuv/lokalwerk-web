/**
 * Auswahlrechteck auf der Arbeitsfläche (Umbau zum Editor): Mit der Maus auf freier Fläche
 * aufziehen wählt alle Seiten, die es berührt. Umschalt ergänzt, Strg/Cmd schaltet um. Am Rand
 * scrollt die Fläche mit. Ein Klick ohne Ziehen hebt die Auswahl auf (page.ts).
 */

import { boxFrom, intersects } from '../../core/workshop/layout.ts';
import { bandSelection, type Selection } from '../../core/workshop/selection.ts';
import type { WorkshopStore } from './store.ts';

export interface BandContext {
  store: WorkshopStore;
  scroller: HTMLElement;
  band: HTMLElement;
  tiles(): HTMLElement[];
  disabled(): boolean;
  done(): void;
}

const THRESHOLD = 4;
const EDGE = 40;

export function setupBand(ctx: BandContext): { active(): boolean } {
  let start: {
    x: number;
    y: number;
    scroll: number;
    pointerId: number;
    base: Selection;
    mode: 'replace' | 'add' | 'toggle';
  } | null = null;
  let moving = false;
  let last = { x: 0, y: 0 };
  let frame = 0;
  let swallow = false;

  function contentPoint(x: number, y: number): { x: number; y: number } {
    const r = ctx.scroller.getBoundingClientRect();
    return { x: x - r.left + ctx.scroller.scrollLeft, y: y - r.top + ctx.scroller.scrollTop };
  }

  function update(): void {
    if (!start) return;
    const r = ctx.scroller.getBoundingClientRect();
    const a = { x: start.x, y: start.y };
    const b = contentPoint(last.x, last.y);
    const box = boxFrom(a.x, a.y, b.x, b.y);
    Object.assign(ctx.band.style, {
      left: `${box.left}px`,
      top: `${box.top}px`,
      width: `${box.right - box.left}px`,
      height: `${box.bottom - box.top}px`,
    });
    // In Bildschirmkoordinaten vergleichen
    const screen = {
      left: box.left + r.left - ctx.scroller.scrollLeft,
      right: box.right + r.left - ctx.scroller.scrollLeft,
      top: box.top + r.top - ctx.scroller.scrollTop,
      bottom: box.bottom + r.top - ctx.scroller.scrollTop,
    };
    const keys = ctx
      .tiles()
      .filter((tile) => {
        const t = tile.getBoundingClientRect();
        return intersects(screen, { left: t.left, top: t.top, right: t.right, bottom: t.bottom });
      })
      .flatMap((tile) => tile.dataset.key ?? []);
    const next = bandSelection(start.base, keys, start.mode);
    const now = ctx.store.selection;
    const same = next.keys.size === now.keys.size && [...next.keys].every((k) => now.keys.has(k));
    if (!same) ctx.store.select(next);
  }

  function tick(): void {
    if (!start || !moving) return;
    const r = ctx.scroller.getBoundingClientRect();
    const dy = last.y < r.top + EDGE ? -12 : last.y > r.bottom - EDGE ? 12 : 0;
    if (dy !== 0) {
      ctx.scroller.scrollTop += dy;
      update();
    }
    frame = requestAnimationFrame(tick);
  }

  ctx.scroller.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || event.pointerType !== 'mouse' || ctx.disabled()) return;
    const target = event.target as Element;
    if (
      target.closest(
        '.ws-page, .ws-sec-head, button, input, label, .ws-gap, .ws-cutline, .ws-newdoc-drop',
      )
    )
      return;
    const p = contentPoint(event.clientX, event.clientY);
    start = {
      ...p,
      scroll: ctx.scroller.scrollTop,
      pointerId: event.pointerId,
      base: ctx.store.selection,
      mode: event.ctrlKey || event.metaKey ? 'toggle' : event.shiftKey ? 'add' : 'replace',
    };
    last = { x: event.clientX, y: event.clientY };
    moving = false;
  });

  window.addEventListener('pointermove', (event) => {
    if (!start || event.pointerId !== start.pointerId) return;
    last = { x: event.clientX, y: event.clientY };
    if (!moving) {
      const p = contentPoint(event.clientX, event.clientY);
      if (Math.hypot(p.x - start.x, p.y - start.y) < THRESHOLD) return;
      moving = true;
      ctx.band.hidden = false;
      document.documentElement.classList.add('ws-banding');
      try {
        ctx.scroller.setPointerCapture(event.pointerId);
      } catch {
        // Zeiger schon weg
      }
      frame = requestAnimationFrame(tick);
    }
    update();
  });

  const stop = (event: PointerEvent) => {
    if (!start || event.pointerId !== start.pointerId) return;
    if (moving) {
      swallow = true;
      setTimeout(() => (swallow = false), 0);
      ctx.done();
    }
    start = null;
    moving = false;
    cancelAnimationFrame(frame);
    ctx.band.hidden = true;
    document.documentElement.classList.remove('ws-banding');
  };
  window.addEventListener('pointerup', stop);
  window.addEventListener('pointercancel', stop);
  ctx.scroller.addEventListener(
    'click',
    (event) => {
      if (!swallow) return;
      event.stopPropagation();
      event.preventDefault();
    },
    true,
  );

  return { active: () => moving };
}
