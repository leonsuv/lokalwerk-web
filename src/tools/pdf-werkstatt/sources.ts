/**
 * Dateien der PDF-Werkstatt im Hauptthread: je Quelle die `File` und das pdf.js-Dokument für
 * Vorschaubilder. pdf.js öffnet eine Quelle erst beim ersten Vorschaubild; die Bytes gehen dabei
 * an den pdf.js-Worker und bleiben nicht im Hauptthread (plan-phase3.md Abschnitt 3).
 */

import type { SourceId } from '../../core/workshop/model.ts';
import type { PDFDocumentProxy } from '../../ui/pdfjs/pdfjs.ts';
import { decodeImage } from './image-pages.ts';

/** Breite der zwischengespeicherten Bilder für Vorschaubilder, in Pixeln */
const THUMB_IMAGE_WIDTH = 480;

type PdfJs = typeof import('../../ui/pdfjs/pdfjs.ts');

export class SourceFiles {
  private readonly files = new Map<SourceId, File>();
  private readonly docs = new Map<SourceId, Promise<PDFDocumentProxy>>();
  private readonly images = new Map<SourceId, Promise<ImageBitmap>>();

  constructor(private readonly pdfjs: Promise<PdfJs>) {}

  add(id: SourceId, file: File): void {
    this.files.set(id, file);
  }

  file(id: SourceId): File | undefined {
    return this.files.get(id);
  }

  /** pdf.js-Dokument der Quelle; wirft, wenn pdf.js sie nicht öffnen kann */
  pdf(id: SourceId): Promise<PDFDocumentProxy> {
    let doc = this.docs.get(id);
    if (!doc) {
      const file = this.files.get(id);
      if (!file) return Promise.reject(new Error(`Quelle ${id} fehlt`));
      doc = (async () => {
        const { openPdf } = await this.pdfjs;
        return openPdf(new Uint8Array(await file.arrayBuffer()));
      })();
      this.docs.set(id, doc);
    }
    return doc;
  }

  /** Verkleinertes Bild einer Bildquelle für Vorschaubilder, einmal dekodiert */
  thumbImage(id: SourceId): Promise<ImageBitmap> {
    let image = this.images.get(id);
    if (!image) {
      const file = this.files.get(id);
      if (!file) return Promise.reject(new Error(`Quelle ${id} fehlt`));
      image = decodeImage(file, THUMB_IMAGE_WIDTH);
      this.images.set(id, image);
    }
    return image;
  }

  release(ids: readonly SourceId[]): void {
    for (const id of ids) {
      this.files.delete(id);
      const image = this.images.get(id);
      this.images.delete(id);
      void image?.then(
        (bitmap) => bitmap.close(),
        () => undefined,
      );
      const doc = this.docs.get(id);
      this.docs.delete(id);
      if (doc) {
        void Promise.all([doc, this.pdfjs]).then(
          ([opened, { closePdf }]) => closePdf(opened),
          () => undefined,
        );
      }
    }
  }
}
