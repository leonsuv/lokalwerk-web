/**
 * Vier Eckpunkte auf einer Bildvorschau setzen („Dokument scannen“, plan-phase2.md Vorschlag C).
 * Koordinaten sind Anteile 0–1 des angezeigten Bildes, Reihenfolge oben links, oben rechts,
 * unten rechts, unten links.
 *
 * Bedienung: Ecken mit Maus, Stift oder Finger ziehen. Ohne Ziehen (WCAG 2.2, 2.1.1 und 2.5.7):
 * Ecke mit Tab wählen, mit den Pfeiltasten fein verschieben, mit Umschalt und Pfeiltasten in
 * größeren Schritten.
 */

import type { Point } from '../core/images/perspective.ts';

export const CORNER_NAMES = ['oben links', 'oben rechts', 'unten rechts', 'unten links'] as const;

export interface CornerEditorOptions {
  /** Ebene über der Vorschau */
  layer: HTMLElement;
  /** id eines Textes mit der Tastaturbedienung */
  describedBy: string;
  onChange: (corners: readonly Point[]) => void;
}

const STEP = 0.005;
const BIG_STEP = 0.05;
const clamp = (v: number) => Math.min(1, Math.max(0, v));

export class CornerEditor {
  private corners: Point[] = [];
  private readonly options: CornerEditorOptions;
  private readonly outline: SVGPolygonElement;
  private readonly handles: HTMLElement[];
  private dragging: number | null = null;

  constructor(options: CornerEditorOptions) {
    this.options = options;
    const { layer } = options;
    // Über den HTML-Parser angelegt: Er setzt den SVG-Namensraum selbst
    const box = document.createElement('div');
    box.innerHTML =
      '<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polygon /></svg>';
    const svg = box.firstElementChild as SVGSVGElement;
    this.outline = svg.querySelector('polygon') as SVGPolygonElement;
    this.handles = CORNER_NAMES.map((name, i) => {
      const el = document.createElement('div');
      el.className = 'corner';
      el.tabIndex = 0;
      el.dataset.corner = String(i);
      el.setAttribute('role', 'group');
      el.setAttribute('aria-label', `Ecke ${name}`);
      el.setAttribute('aria-describedby', options.describedBy);
      return el;
    });
    layer.replaceChildren(svg, ...this.handles);
    layer.addEventListener('pointerdown', (e) => this.pointerDown(e));
    layer.addEventListener('pointermove', (e) => this.pointerMove(e));
    layer.addEventListener('pointerup', () => this.pointerUp());
    layer.addEventListener('pointercancel', () => this.pointerUp());
    layer.addEventListener('keydown', (e) => this.keyDown(e));
  }

  get value(): readonly Point[] {
    return this.corners;
  }

  set(corners: readonly Point[]): void {
    this.corners = corners.map((p) => ({ x: clamp(p.x), y: clamp(p.y) }));
    this.paint();
  }

  private point(e: PointerEvent): Point {
    const box = this.options.layer.getBoundingClientRect();
    return {
      x: clamp((e.clientX - box.left) / box.width),
      y: clamp((e.clientY - box.top) / box.height),
    };
  }

  private pointerDown(e: PointerEvent): void {
    if (e.button !== 0) return;
    const handle = (e.target as Element).closest<HTMLElement>('[data-corner]');
    let index = handle ? Number(handle.dataset.corner) : -1;
    if (index < 0) {
      // Neben eine Ecke getippt: die nächste Ecke springt dorthin (bequem auf dem Handy)
      const p = this.point(e);
      let best = Infinity;
      this.corners.forEach((c, i) => {
        const d = Math.hypot(c.x - p.x, c.y - p.y);
        if (d < best) [best, index] = [d, i];
      });
      if (index < 0) return;
      this.corners[index] = p;
      this.paint();
    }
    this.dragging = index;
    this.handles[index]?.focus();
    this.options.layer.setPointerCapture(e.pointerId);
    e.preventDefault();
  }

  private pointerMove(e: PointerEvent): void {
    if (this.dragging === null) return;
    this.corners[this.dragging] = this.point(e);
    this.paint();
  }

  private pointerUp(): void {
    if (this.dragging === null) return;
    this.dragging = null;
    this.options.onChange(this.corners);
  }

  private keyDown(e: KeyboardEvent): void {
    const target = e.target as HTMLElement;
    const index = Number(target.dataset.corner);
    const c = this.corners[index];
    if (!c || target.dataset.corner === undefined) return;
    const step = e.shiftKey ? BIG_STEP : STEP;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const move = moves[e.key];
    if (!move) return;
    e.preventDefault();
    this.corners[index] = { x: clamp(c.x + move[0]), y: clamp(c.y + move[1]) };
    this.paint();
    this.options.onChange(this.corners);
  }

  private paint(): void {
    this.outline.setAttribute(
      'points',
      this.corners.map((p) => `${p.x * 100},${p.y * 100}`).join(' '),
    );
    this.handles.forEach((el, i) => {
      const p = this.corners[i];
      el.hidden = !p;
      if (!p) return;
      // CSSOM, keine style-Attribute im Markup (CSP style-src 'self')
      el.style.left = `${p.x * 100}%`;
      el.style.top = `${p.y * 100}%`;
    });
  }
}
