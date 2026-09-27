/**
 * Einzelseite groß (Umbau zum Editor; ersetzt die große Vorschau): die Seite mit dem Fokus in
 * der Mitte, eingepasst in die Arbeitsfläche und mit dem Zoom vergrößert. Gezeichnet wird nur,
 * solange die Ansicht offen ist, mit Stempeln, Unterschriften und Seitenzahlen wie beim
 * Speichern. Blättern mit den Knöpfen, Pfeil links/rechts, Bild auf/ab.
 */

import {
  indexPages,
  pageNumbersOf,
  visiblePageSize,
  type PageKey,
} from '../../core/workshop/model.ts';
import { $ } from '../../ui/dom.ts';
import { drawWorkshopPage } from './page-canvas.ts';
import type { SourceFiles } from './sources.ts';
import type { WorkshopStore } from './store.ts';
import { NO_PREVIEW, previewTitle } from './texts.ts';

type PdfJs = typeof import('../../ui/pdfjs/pdfjs.ts');

export class SingleView {
  readonly el = $('#ws-single');
  private readonly stage = $('#ws-single-stage');
  private key: PageKey | null = null;
  private token = 0;
  private drawn = '';
  private frame = 0;

  constructor(
    private readonly store: WorkshopStore,
    private readonly files: SourceFiles,
    private readonly pdfjs: Promise<PdfJs>,
    /** Zur Seite blättern (Fokus der Auswahl setzen) */
    private readonly go: (key: PageKey) => void,
  ) {
    $('#ws-single-prev').addEventListener('click', () => this.step(-1));
    $('#ws-single-next').addEventListener('click', () => this.step(1));
    this.stage.addEventListener('keydown', (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === 'ArrowLeft' || event.key === 'PageUp') this.step(-1);
      else if (event.key === 'ArrowRight' || event.key === 'PageDown') this.step(1);
      else return;
      event.preventDefault();
      event.stopPropagation();
    });
    new ResizeObserver(() => {
      if (this.open) this.schedule(true);
    }).observe(this.stage);
  }

  get open(): boolean {
    return !this.el.hidden;
  }

  get page(): PageKey | null {
    return this.key;
  }

  show(key: PageKey | null, zoom: number): void {
    this.key = key;
    this.zoom = zoom;
    this.schedule(false);
  }

  close(): void {
    this.token++;
    this.drawn = '';
    this.clear();
  }

  focus(): void {
    this.stage.focus({ preventScroll: true });
  }

  step(delta: number): void {
    if (!this.key) return;
    const at = indexPages(this.store.state).get(this.key);
    const next = at?.doc.pages[at.pageIndex + delta];
    if (next) this.go(next.key);
  }

  private zoom = 100;

  private schedule(force: boolean): void {
    if (force) this.drawn = '';
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => void this.render());
  }

  private clear(): void {
    for (const canvas of this.stage.querySelectorAll('canvas')) {
      canvas.width = 0;
      canvas.height = 0;
    }
    this.stage.replaceChildren();
  }

  private async render(): Promise<void> {
    const key = this.key;
    const at = key ? indexPages(this.store.state).get(key) : undefined;
    const title = $('#ws-single-title');
    $<HTMLButtonElement>('#ws-single-prev').disabled = !at || at.pageIndex === 0;
    $<HTMLButtonElement>('#ws-single-next').disabled =
      !at || at.pageIndex === at.doc.pages.length - 1;
    if (!at) {
      title.textContent = '';
      this.clear();
      return;
    }
    const { doc, pageIndex, page } = at;
    title.textContent = previewTitle(doc.name, pageIndex + 1, doc.pages.length);
    const size = visiblePageSize(this.store.state, page);
    const box = this.stage.getBoundingClientRect();
    const fit = Math.min((box.width - 48) / size.width, (box.height - 48) / size.height);
    const cssWidth = Math.max(40, Math.floor(size.width * fit * (this.zoom / 100)));
    const pixels = Math.min(4000, cssWidth * (globalThis.devicePixelRatio || 1));
    // Nichts Neues zu zeichnen: Seite, Operationen, Seitenzahl und Größe gleich
    const numbers = pageNumbersOf(doc);
    const signature = [
      key,
      JSON.stringify(page),
      numbers ? JSON.stringify(numbers) : '',
      pageIndex,
      doc.pages.length,
      Math.round(pixels),
    ].join('|');
    if (signature === this.drawn) return;
    this.drawn = signature;
    const token = ++this.token;
    let canvas: HTMLCanvasElement;
    try {
      canvas = await drawWorkshopPage(this.store.state, page, this.files, this.pdfjs, pixels, {
        numbers: numbers ? { options: numbers, index: pageIndex, count: doc.pages.length } : null,
      });
    } catch {
      if (token !== this.token) return;
      const err = document.createElement('p');
      err.className = 'err';
      err.textContent = NO_PREVIEW;
      this.clear();
      this.stage.append(err);
      return;
    }
    if (token !== this.token) {
      canvas.width = 0;
      canvas.height = 0;
      return;
    }
    canvas.style.width = `${cssWidth}px`;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', title.textContent);
    this.clear();
    this.stage.append(canvas);
  }
}
