/**
 * Bereiche zum Schwärzen auf den Seiten eines Dokuments festlegen (Stufe 2.3): Seite für Seite,
 * wie sie angezeigt wird, mit den Rechtecken aus „PDF schwärzen“ (src/ui/rect-editor.ts, Maus,
 * Touch und Tastatur). Natives <dialog>, Esc bricht ab. Geschwärzt wird erst in der rechten
 * Spalte („Dokument schwärzen“, redact-bake.ts).
 */

import type { NormRect } from '../../core/geometry/norm-rect.ts';
import { indexPages, visiblePageSize, type PageKey } from '../../core/workshop/model.ts';
import { $ } from '../../ui/dom.ts';
import { RectEditor } from '../../ui/rect-editor.ts';
import { dialogPageWidth, drawWorkshopPage } from './page-canvas.ts';
import type { SourceFiles } from './sources.ts';
import type { WorkshopStore } from './store.ts';
import * as t from './texts.ts';

type PdfJs = typeof import('../../ui/pdfjs/pdfjs.ts');

/** Bereiche je Seite; Seiten ohne Bereich fehlen */
export type RedactAreas = ReadonlyMap<PageKey, readonly NormRect[]>;

/** Neuer Bereich per Knopf, wie im Einzelwerkzeug */
const DEFAULT_RECT: NormRect = { x: 0.3, y: 0.45, w: 0.4, h: 0.05 };

export class RedactDialog {
  private readonly dialog = $<HTMLDialogElement>('#ws-redact');
  private readonly view = $('#ws-redact-view');
  private keys: PageKey[] = [];
  private at = 0;
  private areas = new Map<PageKey, NormRect[]>();
  private resolve: ((areas: RedactAreas | null) => void) | null = null;
  private token = 0;
  private readonly editor: RectEditor;

  constructor(
    private readonly store: WorkshopStore,
    private readonly files: SourceFiles,
    private readonly pdfjs: Promise<PdfJs>,
  ) {
    this.editor = new RectEditor({
      layer: $('#ws-redact-layer'),
      draw: true,
      label: (i) => t.redactRectLabel(i + 1, this.at + 1),
      describedBy: 'ws-redact-keys',
      home: $('#ws-redact-add'),
      onChange: (rects) => {
        const key = this.keys[this.at];
        if (key) this.areas.set(key, [...rects]);
        this.update();
      },
    });
    $('#ws-redact-add').addEventListener('click', () => this.editor.add(DEFAULT_RECT));
    $('#ws-redact-clear-page').addEventListener('click', () => {
      this.editor.set([]);
      const key = this.keys[this.at];
      if (key) this.areas.set(key, []);
      this.update();
      $('#ws-redact-add').focus();
    });
    $('#ws-redact-prev').addEventListener('click', () => this.show(this.at - 1));
    $('#ws-redact-next').addEventListener('click', () => this.show(this.at + 1));
    $('#ws-redact-ok').addEventListener('click', () => this.finish(this.result()));
    $('#ws-redact-cancel').addEventListener('click', () => this.finish(null));
    this.dialog.addEventListener('close', () => this.finish(null));
  }

  /**
   * Seiten `keys` eines Dokuments, beginnend bei `start`. Ergebnis: die Bereiche nach
   * „Übernehmen“, null nach „Abbrechen“ oder Esc.
   */
  open(
    name: string,
    keys: readonly PageKey[],
    areas: RedactAreas,
    start = 0,
  ): Promise<RedactAreas | null> {
    this.finish(null);
    this.keys = [...keys];
    this.areas = new Map([...areas].map(([k, v]) => [k, [...v]]));
    $('#ws-redact-title').textContent = t.redactDialogTitle(name);
    this.dialog.showModal();
    this.show(Math.max(0, Math.min(start, keys.length - 1)));
    return new Promise((resolve) => (this.resolve = resolve));
  }

  private show(index: number): void {
    if (index < 0 || index >= this.keys.length) return;
    this.at = index;
    this.editor.set(this.areas.get(this.keys[index] ?? '') ?? []);
    this.update();
    void this.draw();
  }

  private update(): void {
    $('#ws-redact-page').textContent = t.redactPageLabel(this.at + 1, this.keys.length);
    $<HTMLButtonElement>('#ws-redact-prev').disabled = this.at === 0;
    $<HTMLButtonElement>('#ws-redact-next').disabled = this.at >= this.keys.length - 1;
    $<HTMLButtonElement>('#ws-redact-clear-page').disabled = this.editor.value.length === 0;
  }

  private result(): RedactAreas {
    const out = new Map<PageKey, readonly NormRect[]>();
    for (const [key, rects] of this.areas) if (rects.length > 0) out.set(key, rects);
    return out;
  }

  private async draw(): Promise<void> {
    const key = this.keys[this.at];
    const at = key ? indexPages(this.store.state).get(key) : undefined;
    const token = ++this.token;
    this.clearCanvas();
    if (!at) return;
    const size = visiblePageSize(this.store.state, at.page);
    const cssWidth = dialogPageWidth($('#ws-redact-stage'), size);
    let canvas: HTMLCanvasElement | HTMLElement;
    try {
      canvas = await drawWorkshopPage(
        this.store.state,
        at.page,
        this.files,
        this.pdfjs,
        cssWidth * (globalThis.devicePixelRatio || 1),
      );
      canvas.style.width = `${cssWidth}px`;
      canvas.setAttribute('aria-hidden', 'true');
    } catch {
      canvas = document.createElement('p');
      canvas.className = 'err';
      canvas.textContent = t.NO_PREVIEW;
    }
    if (token !== this.token || !this.dialog.open) {
      if (canvas instanceof HTMLCanvasElement) canvas.width = canvas.height = 0;
      return;
    }
    this.view.prepend(canvas);
  }

  private clearCanvas(): void {
    for (const old of this.view.querySelectorAll('canvas, .err')) {
      if (old instanceof HTMLCanvasElement) old.width = old.height = 0;
      old.remove();
    }
  }

  private finish(areas: RedactAreas | null): void {
    this.token++;
    const resolve = this.resolve;
    this.resolve = null;
    if (this.dialog.open) this.dialog.close();
    this.clearCanvas();
    this.editor.set([]);
    resolve?.(areas);
  }
}
