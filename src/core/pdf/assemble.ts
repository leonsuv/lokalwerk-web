/**
 * PDFs aus Seitenverweisen zusammensetzen (plan-phase3.md Schritt 1.2): mehrere Dokumente aus
 * mehreren Quellen, mit Drehung, Leerseiten und Bildseiten. Ohne DOM, läuft im Worker.
 * „PDF-Seiten bearbeiten“ (organize.ts) ist der Sonderfall mit einer Quelle.
 *
 * Wie beim Teilen und Umsortieren werden nur Seiten übernommen: keine Metadaten, Lesezeichen,
 * Formular-Definitionen oder Signaturen (docs/pdf-lib.md). Ausnahme: Ein Dokument, das
 * unverändert eine einzige Quelle ist, wird als Originaldatei ausgegeben (W12, `original`).
 *
 * Drehung: /Rotate der Seite in Schritten von 90 Grad im Uhrzeigersinn (ISO 32000-2, 7.7.3.3);
 * die zusätzliche Drehung wird zur vorhandenen addiert.
 *
 * Seiten-Operationen (plan-phase3.md 7.2, Schritt 2.2): Unterschriften werden vor der
 * zusätzlichen Drehung gesetzt, also am Inhalt verankert; Stempel danach, so wie die Seite am
 * Ende zu sehen ist.
 *
 * Dokument-Operationen (plan-phase3.md 7.2) werden zuletzt angewendet, auf die fertige
 * Seitenfolge: Seitenzahlen zählen die Seiten des Ergebnisses in ihrer Endreihenfolge.
 */

import { degrees, PDFDocument, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib';
import type { NormRect } from '../geometry/norm-rect.ts';
import { imagePagePlacement, type PageImage } from './image-layout.ts';
import { loadPdf, PdfError, toPdfError } from './merge.ts';
import type { PageNumberOptions } from './page-numbers.ts';
import { drawPlacedImage } from './place-image.ts';
import { normalizeRotation } from './stamp-geometry.ts';
import { drawPageNumbers, drawStamp, stampFont, type StampOptions } from './stamp.ts';

/** Seiten-Operationen: erst beim Export angewendet */
export interface AssemblePageOps {
  stamp?: Omit<StampOptions, 'pages'>;
  /** PNG je Unterschrift; gleiche `id` = gleiches Bild, nur einmal eingebettet */
  signatures?: readonly { id: string; png: Uint8Array; rect: NormRect }[];
}

export type AssemblePage =
  /** Seite einer Quelle, `index` ab 0; Bilder haben nur Seite 0 */
  | ({ kind: 'source'; source: string; index: number; rotate: number } & AssemblePageOps)
  /** Leerseite, Größe in pt */
  | ({ kind: 'blank'; width: number; height: number; rotate: number } & AssemblePageOps);

export interface AssembleDoc {
  /** Dateiname des Ergebnisses */
  name: string;
  pages: readonly AssemblePage[];
  /** Quelle, deren Originaldatei unverändert ausgegeben wird (statt `pages` neu zu setzen) */
  original?: string;
  /** Seitenzahlen auf das fertige Dokument setzen (Dokument-Operation) */
  numbers?: PageNumberOptions;
}

export type AssembleSource =
  | { kind: 'pdf'; bytes: Uint8Array }
  /** Schon neu kodiert, ohne Metadaten (wie in „Bilder zu PDF“) */
  | { kind: 'image'; image: PageImage };

export interface AssembledDoc {
  name: string;
  bytes: Uint8Array;
  /** Originaldatei unverändert übernommen (Hinweis beim Export, W12) */
  unchanged: boolean;
}

function sourceOf(sources: ReadonlyMap<string, AssembleSource>, id: string): AssembleSource {
  const source = sources.get(id);
  if (!source) throw new RangeError(`Quelle ${id} gibt es nicht`);
  return source;
}

function checkIndex(index: number, count: number): void {
  if (!Number.isInteger(index) || index < 0 || index >= count) {
    throw new RangeError(`Seite ${index + 1} gibt es nicht`);
  }
}

/**
 * Setzt die Dokumente nacheinander zusammen. Jede PDF-Quelle wird höchstens einmal geladen und
 * nach ihrer letzten Verwendung wieder freigegeben. Seiten derselben Quelle werden je Dokument
 * in einem Aufruf kopiert, damit gemeinsame Schriften und Bilder nur einmal im Ergebnis landen.
 * Wirft PdfError (leer, verschlüsselt, beschädigt, keine Seiten, zu wenig Speicher) oder
 * RangeError bei Verweisen auf Seiten oder Quellen, die es nicht gibt.
 */
export async function assemblePdfs(
  docs: readonly AssembleDoc[],
  sources: ReadonlyMap<string, AssembleSource>,
  onProgress?: (done: number, total: number) => void,
): Promise<AssembledDoc[]> {
  const total = docs.reduce((sum, d) => sum + d.pages.length, 0);
  let done = 0;
  const lastUse = new Map<string, number>();
  for (const [i, doc] of docs.entries()) {
    if (doc.pages.length === 0) throw new PdfError('no-pages');
    for (const p of doc.pages) if (p.kind === 'source') lastUse.set(p.source, i);
  }

  const loaded = new Map<string, PDFDocument>();
  async function load(id: string): Promise<PDFDocument> {
    const cached = loaded.get(id);
    if (cached) return cached;
    const source = sourceOf(sources, id);
    if (source.kind !== 'pdf') throw new RangeError(`Quelle ${id} ist keine PDF`);
    const pdf = await loadPdf(source.bytes);
    loaded.set(id, pdf);
    return pdf;
  }

  const results: AssembledDoc[] = [];
  for (const [i, doc] of docs.entries()) {
    // Mit Operationen wird immer neu gesetzt, auch wenn die Seiten unverändert sind.
    if (doc.original !== undefined && !doc.numbers) {
      const source = sourceOf(sources, doc.original);
      if (source.kind !== 'pdf') throw new RangeError(`Quelle ${doc.original} ist keine PDF`);
      results.push({ name: doc.name, bytes: source.bytes, unchanged: true });
    } else {
      results.push({
        name: doc.name,
        bytes: await assembleOne(doc, sources, load),
        unchanged: false,
      });
    }
    for (const [id, last] of lastUse) if (last === i) loaded.delete(id);
    done += doc.pages.length;
    onProgress?.(done, total);
  }
  return results;
}

async function assembleOne(
  doc: AssembleDoc,
  sources: ReadonlyMap<string, AssembleSource>,
  load: (id: string) => Promise<PDFDocument>,
): Promise<Uint8Array> {
  // Erst alle Quellen laden und Verweise prüfen, dann zusammensetzen.
  const bySource = new Map<string, number[]>();
  for (const [position, p] of doc.pages.entries()) {
    if (p.kind !== 'source') continue;
    const source = sourceOf(sources, p.source);
    checkIndex(p.index, source.kind === 'pdf' ? (await load(p.source)).getPageCount() : 1);
    const positions = bySource.get(p.source) ?? [];
    positions.push(position);
    bySource.set(p.source, positions);
  }

  try {
    // Ohne Producer/Creator von pdf-lib, siehe docs/pdf-lib.md Nr. 8 und 9.
    const out = await PDFDocument.create({ updateMetadata: false });
    const copied = new Map<number, PDFPage>();
    for (const [id, positions] of bySource) {
      if (sourceOf(sources, id).kind !== 'pdf') continue;
      const indices = positions.map((pos) => (doc.pages[pos] as { index: number }).index);
      const pages = await out.copyPages(await load(id), indices);
      for (const [n, page] of pages.entries()) copied.set(positions[n] as number, page);
    }

    const images = new Map<string, PDFImage>();
    const signatures = new Map<string, PDFImage>();
    let font: PDFFont | null = null;
    for (const [position, p] of doc.pages.entries()) {
      let page: PDFPage;
      if (p.kind === 'blank') {
        page = out.addPage([p.width, p.height]);
      } else {
        const source = sourceOf(sources, p.source);
        const copy = copied.get(position);
        if (copy) {
          page = out.addPage(copy);
        } else if (source.kind === 'image') {
          const { image } = source;
          let embedded = images.get(p.source);
          if (!embedded) {
            embedded =
              image.type === 'image/jpeg'
                ? await out.embedJpg(image.bytes)
                : await out.embedPng(image.bytes);
            images.set(p.source, embedded);
          }
          const place = imagePagePlacement(image.width, image.height);
          page = out.addPage([place.pageWidth, place.pageHeight]);
          page.drawImage(embedded, {
            x: place.x,
            y: place.y,
            width: place.width,
            height: place.height,
          });
        } else {
          throw new RangeError(`Seite ${p.index + 1} von ${p.source} fehlt`);
        }
      }
      for (const signature of p.signatures ?? []) {
        let image = signatures.get(signature.id);
        if (!image) {
          image = await out.embedPng(signature.png);
          signatures.set(signature.id, image);
        }
        drawPlacedImage(page, image, signature.rect);
      }
      if (p.rotate % 360 !== 0) {
        page.setRotation(degrees(normalizeRotation(page.getRotation().angle + p.rotate)));
      }
      if (p.stamp) {
        font ??= await stampFont(out);
        drawStamp(page, font, p.stamp);
      }
    }
    if (doc.numbers) await drawPageNumbers(out, doc.numbers);
    return await out.save();
  } catch (error) {
    throw toPdfError(error);
  }
}
