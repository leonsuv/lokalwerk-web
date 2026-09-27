/**
 * Dezente Bewegung in der Werkstatt (Umbau zum Editor): Seiten gleiten an ihren neuen Platz
 * (FLIP: erst messen, dann umstellen, dann von der alten Stelle aus hinübergleiten). Unter 200 ms,
 * bei prefers-reduced-motion gar nicht.
 */

export const MOTION_MS = 160;
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

export function motionAllowed(): boolean {
  return !reduced.matches;
}

/** Stellen der Elemente vor einer Änderung; nur sichtbare, damit große Dokumente billig bleiben */
export function measure(
  elements: Iterable<HTMLElement>,
  within: DOMRect,
): Map<HTMLElement, DOMRect> {
  const rects = new Map<HTMLElement, DOMRect>();
  if (!motionAllowed()) return rects;
  const margin = 200;
  for (const el of elements) {
    if (!el.isConnected) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0) continue;
    if (r.bottom < within.top - margin || r.top > within.bottom + margin) continue;
    rects.set(el, r);
  }
  return rects;
}

/** Von den alten Stellen an die neuen gleiten; neue Elemente blenden kurz ein */
export function play(before: Map<HTMLElement, DOMRect>, fresh: Iterable<HTMLElement> = []): void {
  if (!motionAllowed()) return;
  const moved: HTMLElement[] = [];
  for (const [el, old] of before) {
    if (!el.isConnected) continue;
    const now = el.getBoundingClientRect();
    const dx = old.left - now.left;
    const dy = old.top - now.top;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
    el.style.transition = 'none';
    el.style.transform = `translate(${dx}px, ${dy}px)`;
    moved.push(el);
  }
  const appeared = [...fresh].filter((el) => el.isConnected);
  for (const el of appeared) {
    el.style.transition = 'none';
    el.style.opacity = '0';
    el.style.transform = 'scale(0.92)';
  }
  if (moved.length === 0 && appeared.length === 0) return;
  // Einmal Layout erzwingen, dann mit Übergang zurück auf die neue Stelle
  void document.body.offsetWidth;
  for (const el of [...moved, ...appeared]) {
    el.style.transition = `transform ${MOTION_MS}ms cubic-bezier(0.2, 0.7, 0.2, 1), opacity ${MOTION_MS}ms`;
    el.style.transform = '';
    el.style.opacity = '';
    const done = () => {
      el.style.transition = '';
      el.removeEventListener('transitionend', done);
    };
    el.addEventListener('transitionend', done);
    setTimeout(done, MOTION_MS + 60);
  }
}

/** Element von einer Bildschirmstelle aus einrasten lassen (nach dem Ablegen) */
export function settleFrom(el: HTMLElement, from: DOMRect): void {
  if (!motionAllowed() || !el.isConnected) return;
  const now = el.getBoundingClientRect();
  if (now.width === 0) return;
  const dx = from.left - now.left;
  const dy = from.top - now.top;
  const s = from.width / now.width;
  el.style.transition = 'none';
  el.style.transformOrigin = '0 0';
  el.style.transform = `translate(${dx}px, ${dy}px) scale(${s})`;
  void el.offsetWidth;
  el.style.transition = `transform ${MOTION_MS + 30}ms cubic-bezier(0.2, 0.8, 0.2, 1)`;
  el.style.transform = '';
  setTimeout(() => {
    el.style.transition = '';
    el.style.transformOrigin = '';
  }, MOTION_MS + 90);
}
