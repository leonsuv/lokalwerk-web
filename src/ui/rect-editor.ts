/**
 * Rechtecke auf einer Seitenvorschau zeichnen, verschieben und in der Größe ändern
 * (Schwärzen, Unterschrift). Koordinaten sind Anteile 0–1 der angezeigten Seite, Ursprung oben
 * links; so passen sie zu jeder Vorschaugröße und zur gerasterten Seite.
 *
 * Bedienung: mit Maus, Stift oder Finger ziehen. Ohne Ziehen (WCAG 2.2, 2.1.1 und 2.5.7): Bereich
 * über einen Knopf anlegen, dann mit Pfeiltasten verschieben, mit Umschalt und Pfeiltasten die
 * Größe ändern, mit Entf löschen.
 */

import { fitRect, MIN_SIDE as MIN, type NormRect } from '../core/geometry/norm-rect.ts';

export type { NormRect };

export interface RectEditorOptions {
  /** Ebene über der Vorschau; die Rechtecke werden darin angelegt */
  layer: HTMLElement;
  /** Neue Rechtecke durch Ziehen auf freier Fläche (sonst nur verschieben und ändern) */
  draw: boolean;
  /** Festes Seitenverhältnis Breite/Höhe in Seitenpixeln, z. B. für ein Bild */
  aspect?: () => number | undefined;
  /** Beschriftung für Screenreader, z. B. „Bereich 2“ */
  label: (index: number) => string;
  /** id eines Textes mit der Tastaturbedienung */
  describedBy: string;
  /** Rechtecke lassen sich löschen (Standard); aus beim Zuschneiden mit genau einem Rechteck */
  deletable?: boolean;
  /** Bekommt den Fokus, wenn das letzte Rechteck gelöscht wurde */
  home?: HTMLElement;
  /** Inhalt eines Rechtecks, z. B. das Bild der Unterschrift */
  decorate?: (el: HTMLElement) => void;
  onChange: (rects: readonly NormRect[]) => void;
}

const STEP = 0.01;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export class RectEditor {
  private rects: NormRect[] = [];
  private readonly options: RectEditorOptions;
  private drag: {
    mode: 'draw' | 'move' | 'resize';
    index: number;
    startX: number;
    startY: number;
    start: NormRect;
  } | null = null;

  constructor(options: RectEditorOptions) {
    this.options = options;
    const { layer } = options;
    layer.addEventListener('pointerdown', (e) => this.pointerDown(e));
    layer.addEventListener('pointermove', (e) => this.pointerMove(e));
    layer.addEventListener('pointerup', () => this.pointerUp());
    layer.addEventListener('pointercancel', () => this.pointerUp());
    layer.addEventListener('keydown', (e) => this.keyDown(e));
    layer.addEventListener('click', (e) => {
      const del = (e.target as Element).closest<HTMLElement>('[data-delete]');
      if (del) this.remove(Number(del.dataset.delete), true);
    });
  }

  get value(): readonly NormRect[] {
    return this.rects;
  }

  set(rects: readonly NormRect[]): void {
    this.rects = rects.map(fitRect);
    this.paint();
  }

  /** Neues Rechteck (z. B. per Knopf) und Fokus darauf */
  add(rect: NormRect): void {
    this.rects.push(fitRect(this.withAspect(rect, 'w')));
    this.commit();
    this.focus(this.rects.length - 1);
  }

  private aspectInPage(): number | undefined {
    const a = this.options.aspect?.();
    if (!a) return undefined;
    const box = this.options.layer.getBoundingClientRect();
    // Seitenverhältnis in Anteilen: (w·Breite)/(h·Höhe) = a
    return box.height > 0 ? (a * box.height) / box.width : undefined;
  }

  /** Passt Höhe (oder Breite) an das feste Seitenverhältnis an. */
  private withAspect(r: NormRect, keep: 'w' | 'h'): NormRect {
    const ratio = this.aspectInPage();
    if (!ratio) return r;
    return keep === 'w' ? { ...r, h: r.w / ratio } : { ...r, w: r.h * ratio };
  }

  private point(e: PointerEvent): { x: number; y: number } {
    const box = this.options.layer.getBoundingClientRect();
    return {
      x: clamp((e.clientX - box.left) / box.width, 0, 1),
      y: clamp((e.clientY - box.top) / box.height, 0, 1),
    };
  }

  private pointerDown(e: PointerEvent): void {
    if (e.button !== 0 || (e.target as Element).closest('[data-delete]')) return;
    const target = (e.target as Element).closest<HTMLElement>('[data-index]');
    const p = this.point(e);
    if (target) {
      const index = Number(target.dataset.index);
      const start = this.rects[index];
      if (!start) return;
      const mode = (e.target as Element).closest('.rect-handle') ? 'resize' : 'move';
      this.drag = { mode, index, startX: p.x, startY: p.y, start };
      target.focus();
    } else if (this.options.draw) {
      const start = { x: p.x, y: p.y, w: 0, h: 0 };
      this.rects.push(start);
      this.drag = { mode: 'draw', index: this.rects.length - 1, startX: p.x, startY: p.y, start };
    } else {
      return;
    }
    this.options.layer.setPointerCapture(e.pointerId);
    e.preventDefault();
  }

  private pointerMove(e: PointerEvent): void {
    const d = this.drag;
    if (!d) return;
    const p = this.point(e);
    const dx = p.x - d.startX;
    const dy = p.y - d.startY;
    let next: NormRect;
    if (d.mode === 'draw') {
      next = {
        x: Math.min(d.startX, p.x),
        y: Math.min(d.startY, p.y),
        w: Math.abs(dx),
        h: Math.abs(dy),
      };
      this.rects[d.index] = next;
    } else if (d.mode === 'move') {
      this.rects[d.index] = fitRect({ ...d.start, x: d.start.x + dx, y: d.start.y + dy });
    } else {
      next = this.withAspect({ ...d.start, w: d.start.w + dx, h: d.start.h + dy }, 'w');
      this.rects[d.index] = fitRect({
        ...next,
        w: Math.min(next.w, 1 - next.x),
        h: Math.min(next.h, 1 - next.y),
      });
    }
    this.paint();
  }

  private pointerUp(): void {
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    const r = this.rects[d.index];
    if (d.mode === 'draw' && r && (r.w < MIN || r.h < MIN)) {
      // Nur geklickt, nicht gezogen: kein Rechteck
      this.rects.splice(d.index, 1);
      this.paint();
      return;
    }
    if (r) this.rects[d.index] = fitRect(r);
    this.commit();
    if (d.mode === 'draw') this.focus(d.index);
  }

  private keyDown(e: KeyboardEvent): void {
    const target = (e.target as Element).closest<HTMLElement>('[data-index]');
    if (!target || e.target !== target) return;
    const index = Number(target.dataset.index);
    const r = this.rects[index];
    if (!r) return;
    if ((e.key === 'Delete' || e.key === 'Backspace') && this.options.deletable !== false) {
      e.preventDefault();
      this.remove(index, true);
      return;
    }
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-STEP, 0],
      ArrowRight: [STEP, 0],
      ArrowUp: [0, -STEP],
      ArrowDown: [0, STEP],
    };
    const move = moves[e.key];
    if (!move) return;
    e.preventDefault();
    const [dx, dy] = move;
    // Umschalt: rechts/links ändert die Breite, unten/oben die Höhe
    const next = e.shiftKey
      ? this.withAspect({ ...r, w: r.w + dx, h: r.h + dy }, dx !== 0 ? 'w' : 'h')
      : { ...r, x: r.x + dx, y: r.y + dy };
    this.rects[index] = fitRect(next);
    this.commit();
    this.focus(index);
  }

  private remove(index: number, moveFocus: boolean): void {
    this.rects.splice(index, 1);
    this.commit();
    if (!moveFocus) return;
    if (this.rects.length > 0) this.focus(Math.min(index, this.rects.length - 1));
    else this.options.home?.focus();
  }

  private focus(index: number): void {
    this.options.layer.querySelector<HTMLElement>(`[data-index="${index}"]`)?.focus();
  }

  private commit(): void {
    this.paint();
    this.options.onChange(this.rects);
  }

  private paint(): void {
    const { layer, label, describedBy, decorate } = this.options;
    const els = this.rects.map((r, i) => {
      const el = document.createElement('div');
      el.className = 'rect';
      el.tabIndex = 0;
      el.dataset.index = String(i);
      el.setAttribute('role', 'group');
      el.setAttribute('aria-label', label(i));
      el.setAttribute('aria-describedby', describedBy);
      // CSSOM, keine style-Attribute im Markup (CSP style-src 'self')
      el.style.left = `${r.x * 100}%`;
      el.style.top = `${r.y * 100}%`;
      el.style.width = `${r.w * 100}%`;
      el.style.height = `${r.h * 100}%`;
      decorate?.(el);
      const handle = document.createElement('span');
      handle.className = 'rect-handle';
      handle.setAttribute('aria-hidden', 'true');
      if (this.options.deletable === false) {
        el.append(handle);
        return el;
      }
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'rect-del';
      del.dataset.delete = String(i);
      del.setAttribute('aria-label', `${label(i)} löschen`);
      del.innerHTML = '<svg width="14" height="14" aria-hidden="true"><use href="#i-x" /></svg>';
      el.append(del, handle);
      return el;
    });
    // Beim Ziehen nicht neu anlegen, sonst verliert der Browser den Fokus
    const existing = [...layer.querySelectorAll<HTMLElement>(':scope > .rect')];
    if (existing.length === els.length && this.drag) {
      existing.forEach((el, i) => {
        const src = els[i];
        if (!src) return;
        for (const prop of ['left', 'top', 'width', 'height'] as const)
          el.style[prop] = src.style[prop];
      });
      return;
    }
    const active = document.activeElement;
    const activeIndex =
      active instanceof HTMLElement && layer.contains(active) ? active.dataset.index : undefined;
    layer.replaceChildren(...els);
    if (activeIndex !== undefined) this.focus(Number(activeIndex));
  }
}
