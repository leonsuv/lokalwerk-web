/**
 * Unterschrift auf eine Seite der Werkstatt setzen (Stufe 2.2): die Seite groß, wie sie
 * angezeigt wird, darüber die Rechtecke wie in „Unterschrift einfügen“ (src/ui/rect-editor.ts,
 * mit Maus, Touch und Tastatur). Natives <dialog>, Esc bricht ab.
 */

import type { NormRect } from '../../core/geometry/norm-rect.ts';
import { indexPages, visiblePageSize, type PageKey } from '../../core/workshop/model.ts';
import { $ } from '../../ui/dom.ts';
import { RectEditor } from '../../ui/rect-editor.ts';
import { drawWorkshopPage } from './page-canvas.ts';
import type { SourceFiles } from './sources.ts';
import type { WorkshopStore } from './store.ts';
import * as t from './texts.ts';

type PdfJs = typeof import('../../ui/pdfjs/pdfjs.ts');

/** Bild der Unterschrift zur Anzeige */
export interface SignaturePreview {
  url: string;
  width: number;
  height: number;
}

/** Neue Unterschrift: rechts unten, wie in „Unterschrift einfügen“ */
const DEFAULT_RECT: NormRect = { x: 0.55, y: 0.78, w: 0.3, h: 0.08 };
const MAX_WIDTH = 720;
/** Untergrenze beim Einpassen in die Höhe */
const MIN_WIDTH = 360;
/** Innenabstand oben und unten von .ws-sign-stage (0,2 rem + 0,8 rem) */
const STAGE_PADDING = 16;

export class SignDialog {
  private readonly dialog = $<HTMLDialogElement>('#ws-sign');
  private readonly view = $('#ws-sign-view');
  private readonly layer = $('#ws-sign-layer');
  private image: SignaturePreview | null = null;
  private pageLabel = '';
  private resolve: ((rects: NormRect[] | null) => void) | null = null;
  private token = 0;
  private readonly editor: RectEditor;

  constructor(
    private readonly store: WorkshopStore,
    private readonly files: SourceFiles,
    private readonly pdfjs: Promise<PdfJs>,
  ) {
    this.editor = new RectEditor({
      layer: this.layer,
      draw: false,
      aspect: () => (this.image ? this.image.width / this.image.height : undefined),
      label: (i) => t.signatureRectLabel(i + 1, this.pageLabel),
      describedBy: 'ws-sign-keys',
      home: $('#ws-sign-add'),
      decorate: (el) => {
        if (!this.image) return;
        const img = document.createElement('img');
        img.src = this.image.url;
        img.alt = '';
        el.append(img);
      },
      onChange: () => undefined,
    });
    $('#ws-sign-add').addEventListener('click', () => this.editor.add(DEFAULT_RECT));
    $('#ws-sign-ok').addEventListener('click', () => this.finish([...this.editor.value]));
    $('#ws-sign-cancel').addEventListener('click', () => this.finish(null));
    this.dialog.addEventListener('close', () => this.finish(null));
  }

  /**
   * Zeigt die Seite mit den Rechtecken (wie die Seite angezeigt wird). Ergebnis: die Rechtecke
   * nach „Übernehmen“ (auch leer), null nach „Abbrechen“ oder Esc.
   */
  open(
    key: PageKey,
    image: SignaturePreview,
    rects: readonly NormRect[],
  ): Promise<NormRect[] | null> {
    const at = indexPages(this.store.state).get(key);
    if (!at) return Promise.resolve(null);
    this.finish(null);
    this.image = image;
    this.pageLabel = t.pageOf(at.pageIndex + 1, at.doc.name);
    $('#ws-sign-title').textContent = t.signDialogTitle(at.pageIndex + 1, at.doc.name);
    this.dialog.showModal();
    void this.draw(key);
    this.editor.set(rects);
    return new Promise((resolve) => (this.resolve = resolve));
  }

  private async draw(key: PageKey): Promise<void> {
    const at = indexPages(this.store.state).get(key);
    if (!at) return;
    const token = ++this.token;
    for (const old of this.view.querySelectorAll('canvas, .err')) old.remove();
    const size = visiblePageSize(this.store.state, at.page);
    const stageEl = $('#ws-sign-stage');
    const byWidth =
      Math.min(MAX_WIDTH, stageEl.getBoundingClientRect().width || MAX_WIDTH) / size.width;
    // Die ganze Seite sichtbar, damit man sieht, wo man unterschreibt; auf sehr niedrigen
    // Fenstern nicht schmaler als MIN_WIDTH (dann scrollt die Fläche).
    const maxHeight = parseFloat(getComputedStyle(stageEl).maxHeight) - STAGE_PADDING;
    const byHeight =
      Number.isFinite(maxHeight) && maxHeight > 0 ? maxHeight / size.height : byWidth;
    const fit = Math.min(byWidth, Math.max(byHeight, MIN_WIDTH / size.width));
    const cssWidth = Math.max(1, Math.floor(size.width * fit));
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

  private finish(rects: NormRect[] | null): void {
    this.token++;
    const resolve = this.resolve;
    this.resolve = null;
    if (this.dialog.open) this.dialog.close();
    for (const canvas of this.view.querySelectorAll('canvas')) {
      canvas.width = 0;
      canvas.height = 0;
      canvas.remove();
    }
    this.editor.set([]);
    resolve?.(rects);
  }
}
