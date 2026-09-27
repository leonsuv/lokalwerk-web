/**
 * Dateien der PDF-Werkstatt im Hauptthread: je Quelle die `File` und das pdf.js-Dokument für
 * Vorschaubilder. pdf.js öffnet eine Quelle erst beim ersten Vorschaubild; die Bytes gehen dabei
 * an den pdf.js-Worker und bleiben nicht im Hauptthread (plan-phase3.md Abschnitt 3).
 */

import type { SourceId } from '../../core/workshop/model.ts';
import type { PDFDocumentProxy } from '../../ui/pdfjs/pdfjs.ts';

type PdfJs = typeof import('../../ui/pdfjs/pdfjs.ts');

export class SourceFiles {
  private readonly files = new Map<SourceId, File>();
  private readonly docs = new Map<SourceId, Promise<PDFDocumentProxy>>();

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

  release(ids: readonly SourceId[]): void {
    for (const id of ids) {
      this.files.delete(id);
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
