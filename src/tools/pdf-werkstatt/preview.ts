/**
 * Große Vorschau der PDF-Werkstatt (plan-phase3.md 5.1, 6.2): eine Seite in hoher Auflösung,
 * nur solange sie offen ist. Pfeiltasten blättern im Dokument, R dreht, Esc schließt (natives
 * <dialog>); danach liegt der Fokus auf der zuletzt gezeigten Seite.
 */

import { indexPages, visiblePageSize, type PageKey } from '../../core/workshop/model.ts';
import { $ } from '../../ui/dom.ts';
import { drawWorkshopPage } from './page-canvas.ts';
import type { SourceFiles } from './sources.ts';
import type { WorkshopStore } from './store.ts';
import { NO_PREVIEW, previewTitle } from './texts.ts';

type PdfJs = typeof import('../../ui/pdfjs/pdfjs.ts');

export class Preview {
  private readonly dialog = $<HTMLDialogElement>('#ws-preview');
  private readonly stage = $('#ws-preview-stage');
  private key: PageKey | null = null;
  private token = 0;

  constructor(
    private readonly store: WorkshopStore,
    private readonly files: SourceFiles,
    private readonly pdfjs: Promise<PdfJs>,
    private readonly handlers: {
      rotate(key: PageKey): void;
      shift(key: PageKey, delta: -1 | 1): void;
      /** Beim Schließen: Fokus auf diese Seite */
      closed(key: PageKey): void;
    },
  ) {
    $('#ws-preview-prev').addEventListener('click', () => this.step(-1));
    $('#ws-preview-next').addEventListener('click', () => this.step(1));
    $('#ws-preview-rotate').addEventListener('click', () => this.rotate());
    // Handy (W10): Umsortieren in der Vorschau
    $('#ws-preview-forward').addEventListener(
      'click',
      () => this.key && this.handlers.shift(this.key, -1),
    );
    $('#ws-preview-back').addEventListener(
      'click',
      () => this.key && this.handlers.shift(this.key, 1),
    );
    this.dialog.addEventListener('keydown', (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === 'ArrowLeft') this.step(-1);
      else if (event.key === 'ArrowRight') this.step(1);
      else if (event.key.toLowerCase() === 'r' && !event.shiftKey) this.rotate();
      else return;
      event.preventDefault();
    });
    this.dialog.addEventListener('close', () => {
      this.token++;
      this.clear();
      if (this.key) this.handlers.closed(this.key);
    });
  }

  get open(): boolean {
    return this.dialog.open;
  }

  show(key: PageKey): void {
    this.key = key;
    if (!this.dialog.open) this.dialog.showModal();
    void this.render();
  }

  /** Nach Änderungen (z. B. Drehen, Rückgängig) neu zeichnen oder schließen */
  refresh(): void {
    if (!this.dialog.open || !this.key) return;
    if (!indexPages(this.store.state).has(this.key)) this.dialog.close();
    else void this.render();
  }

  private step(delta: number): void {
    if (!this.key) return;
    const at = indexPages(this.store.state).get(this.key);
    const next = at?.doc.pages[at.pageIndex + delta];
    if (next) this.show(next.key);
  }

  private rotate(): void {
    if (this.key) this.handlers.rotate(this.key);
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
    if (!at) return;
    const token = ++this.token;
    const { doc, pageIndex, page } = at;
    $('#ws-preview-title').textContent = previewTitle(doc.name, pageIndex + 1, doc.pages.length);
    $<HTMLButtonElement>('#ws-preview-prev').disabled = pageIndex === 0;
    $<HTMLButtonElement>('#ws-preview-next').disabled = pageIndex === doc.pages.length - 1;

    // Größe: so groß wie möglich in der Bühne, scharf nach devicePixelRatio
    const size = visiblePageSize(this.store.state, page);
    const box = this.stage.getBoundingClientRect();
    const fit = Math.min(box.width / size.width, box.height / size.height);
    const cssWidth = Math.max(1, Math.floor(size.width * fit));
    const pixels = cssWidth * (globalThis.devicePixelRatio || 1);
    let canvas: HTMLCanvasElement;
    try {
      canvas = await drawWorkshopPage(this.store.state, page, this.files, this.pdfjs, pixels);
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
    canvas.setAttribute('aria-label', $('#ws-preview-title').textContent ?? '');
    this.clear();
    this.stage.append(canvas);
  }
}
