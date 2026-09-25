/**
 * PDFs prüfen und zusammenfügen mit pdf-lib. Ohne DOM, läuft im Web Worker und in Tests.
 *
 * pdf-lib wird nicht mehr gepflegt. Bekannte Grenzen, die uns betreffen, stehen in
 * docs/pdf-lib.md (u. a. verschlüsselte PDFs, Formularfelder, Lesezeichen, Speicherbedarf).
 */

import { PDFDocument } from 'pdf-lib';

export type PdfErrorCode = 'empty' | 'encrypted' | 'damaged' | 'no-pages' | 'out-of-memory';

export class PdfError extends Error {
  readonly code: PdfErrorCode;

  constructor(code: PdfErrorCode, options?: ErrorOptions) {
    super(`PDF-Fehler: ${code}`, options);
    this.name = 'PdfError';
    this.code = code;
  }
}

/** Speicherfehler der Browser: V8 „Array buffer allocation failed“, WebKit/Gecko „out of memory“. */
const OUT_OF_MEMORY = /allocation failed|out of memory/i;

export function toPdfError(error: unknown): PdfError {
  if (error instanceof PdfError) return error;
  if (error instanceof Error && OUT_OF_MEMORY.test(error.message)) {
    return new PdfError('out-of-memory', { cause: error });
  }
  return new PdfError('damaged', { cause: error });
}

/** Lädt eine PDF und prüft Verschlüsselung und Seitenzahl. Wirft PdfError. */
export async function loadPdf(bytes: Uint8Array): Promise<PDFDocument> {
  if (bytes.length === 0) throw new PdfError('empty');
  let doc: PDFDocument;
  try {
    // Verschlüsselung selbst prüfen statt über EncryptedPDFError: pdf-lib ist nach ES5
    // übersetzt, `instanceof` auf seine Fehlerklassen schlägt fehl (docs/pdf-lib.md).
    doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  } catch (error) {
    throw toPdfError(error);
  }
  // pdf-lib kann keine verschlüsselten PDFs verarbeiten, auch nicht solche, die sich ohne
  // Passwort öffnen lassen und nur Rechte einschränken (docs/pdf-lib.md).
  if (doc.isEncrypted) throw new PdfError('encrypted');

  let pages: number;
  try {
    pages = doc.getPageCount();
  } catch (error) {
    throw toPdfError(error);
  }
  if (pages === 0) throw new PdfError('no-pages');
  return doc;
}

/** Liest eine PDF und gibt die Seitenzahl zurück. Wirft PdfError. */
export async function countPages(bytes: Uint8Array): Promise<number> {
  return (await loadPdf(bytes)).getPageCount();
}

export interface MergeResult {
  bytes: Uint8Array;
  pages: number;
}

/**
 * Fügt alle Seiten der Quellen in dieser Reihenfolge zu einer neuen PDF zusammen.
 * Quellen werden erst bei Bedarf und nacheinander gelesen, damit nie alle Dateien
 * gleichzeitig im Speicher liegen. Übernommen werden nur die Seiten, keine Metadaten
 * der Originale (Titel, Autor), keine Lesezeichen und keine Formular-Definitionen.
 */
export async function mergePdfs(
  sources: ReadonlyArray<() => Promise<Uint8Array>>,
  onProgress?: (done: number, total: number) => void,
): Promise<MergeResult> {
  try {
    // Ohne Producer/Creator von pdf-lib, siehe docs/pdf-lib.md Nr. 8 und 9 (tote Adresse im Bundle).
    const out = await PDFDocument.create({ updateMetadata: false });
    for (const [index, read] of sources.entries()) {
      const source = await loadPdf(await read());
      const pages = await out.copyPages(source, source.getPageIndices());
      for (const page of pages) out.addPage(page);
      onProgress?.(index + 1, sources.length);
    }
    return { bytes: await out.save(), pages: out.getPageCount() };
  } catch (error) {
    throw toPdfError(error);
  }
}
