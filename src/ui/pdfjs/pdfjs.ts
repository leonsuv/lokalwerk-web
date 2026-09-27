/**
 * pdf.js-Einbindung (plan-phase2.md Abschnitt 5.1, Paket 4 Schritt 0). Nur dynamisch laden, und
 * zwar gleich beim Seitenaufruf, damit das Werkzeug danach offline funktioniert:
 * `const pdfjs = import('../../ui/pdfjs/pdfjs.ts');`
 *
 * - Worker lokal über workerPort (kein workerSrc, kein CDN).
 * - Keine Nachladedaten: cMapUrl, standardFontDataUrl und iccUrl bleiben leer, useWorkerFetch ist
 *   aus. Alle Dateianfragen von pdf.js beantwortet LocalBinaryDataFactory ohne Netzwerk.
 * - Legacy-Build von pdfjs-dist (Leon, 27.09.2026, docs/pdfjs-kompatibilitaet.md): Der moderne
 *   Build setzt die jeweils neuesten Browser voraus; der Legacy-Build ergänzt fehlende APIs mit
 *   core-js. Unterstützt laut pdf.js: Chrome/Edge 125+, Firefox ESR, Safari 18+.
 * - Kein PDF-JavaScript: Das führt pdf.js nur im Viewer über pdf.sandbox aus, das hier nicht
 *   eingebunden ist (scripts/check-dist.mjs prüft es). Die frühere Option isEvalSupported gibt
 *   es in pdf.js 6.3 nicht mehr. Kein eval und kein new Function; einzige Ausnahme ist die nie
 *   erreichte Stelle Function('return this') aus core-js (docs/pdfjs-kompatibilitaet.md 3.2).
 * - Kein WebAssembly (plan-phase2.md E4): Die CSP bleibt ohne 'wasm-unsafe-eval'.
 * - Schriften über die FontFace-API, keine <style>-Elemente.
 */

import {
  AnnotationMode,
  getDocument,
  GlobalWorkerOptions,
  VerbosityLevel,
  type PDFDocumentProxy,
} from 'pdfjs-dist/legacy/build/pdf.mjs';
import { LocalBinaryDataFactory } from './binary-data.ts';
import { FALLBACK_DIR } from './fallbacks.ts';
import { missingPdfjsApis } from './support.ts';

GlobalWorkerOptions.workerPort = new Worker(new URL('./pdfjs.worker.ts', import.meta.url), {
  type: 'module',
});

export type { PDFDocumentProxy };

/** `unsupported`: Browser zu alt für pdf.js (support.ts) */
export type PdfOpenCode = 'empty' | 'encrypted' | 'damaged' | 'unsupported';

/** PDF ließ sich mit pdf.js nicht öffnen; `code` wie in core/pdf/merge.ts. */
export class PdfOpenError extends Error {
  readonly code: PdfOpenCode;

  constructor(code: PdfOpenCode, options?: ErrorOptions) {
    super(`pdf.js: ${code}`, options);
    this.name = 'PdfOpenError';
    this.code = code;
  }
}

/**
 * Öffnet eine PDF zum Anzeigen. Achtung: pdf.js übergibt `data` an seinen Worker und macht den
 * Puffer dabei unbrauchbar; wer die Bytes noch braucht, übergibt eine Kopie.
 */
export async function openPdf(data: Uint8Array): Promise<PDFDocumentProxy> {
  if (data.length === 0) throw new PdfOpenError('empty');
  // Zweite Sicherung neben loadPdfjs: nie „beschädigt“ melden, wenn der Browser zu alt ist.
  if (missingPdfjsApis().length > 0) throw new PdfOpenError('unsupported');
  try {
    return await getDocument({
      data,
      BinaryDataFactory: LocalBinaryDataFactory,
      useWorkerFetch: false,
      // Kein WebAssembly (E4, CSP ohne 'wasm-unsafe-eval'). Die JS-Ersatzdekoder lädt pdf.js per
      // import() von wasmUrl; sie liegen dort und sind im Worker vorgeladen (./pdfjs.worker.ts).
      useWasm: false,
      wasmUrl: new URL(`/${FALLBACK_DIR}/`, location.origin).href,
      enableXfa: false,
      verbosity: VerbosityLevel.ERRORS,
    }).promise;
  } catch (error) {
    const name = error instanceof Error ? error.name : '';
    throw new PdfOpenError(name === 'PasswordException' ? 'encrypted' : 'damaged', {
      cause: error,
    });
  }
}

/** Gibt den Speicher der PDF im Worker frei. Der Worker selbst läuft weiter. */
export function closePdf(doc: PDFDocumentProxy): Promise<void> {
  return doc.loadingTask.destroy();
}

/** Größe der Seite, wie sie angezeigt wird (mit /Rotate und `extraRotation`), in Punkt */
export async function pageSize(
  doc: PDFDocumentProxy,
  pageNumber: number,
  extraRotation = 0,
): Promise<{ width: number; height: number }> {
  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1, rotation: (page.rotate + extraRotation) % 360 });
  return { width: viewport.width, height: viewport.height };
}

export interface RenderOptions {
  /** Pixel je Punkt; 1 entspricht 72 dpi */
  scale: number;
  /** Zusätzliche Drehung im Uhrzeigersinn, zur Seitendrehung der PDF hinzu */
  extraRotation?: number;
  /** Weißer Hintergrund statt durchsichtig (für JPEG) */
  background?: string;
  canvas?: HTMLCanvasElement;
}

/**
 * Zeichnet eine Seite in ein Canvas mit genau der Größe Seitengröße × `scale`.
 * Wirft, wenn der Browser das Canvas nicht anlegen kann (zu groß für den Speicher).
 */
export async function renderPageAt(
  doc: PDFDocumentProxy,
  pageNumber: number,
  {
    scale,
    extraRotation = 0,
    background,
    canvas = document.createElement('canvas'),
  }: RenderOptions,
): Promise<HTMLCanvasElement> {
  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale, rotation: (page.rotate + extraRotation) % 360 });
  canvas.width = Math.max(1, Math.round(viewport.width));
  canvas.height = Math.max(1, Math.round(viewport.height));
  if (!canvas.getContext('2d')) throw new Error('canvas');
  await page.render({
    canvas,
    viewport,
    annotationMode: AnnotationMode.ENABLE,
    ...(background ? { background } : {}),
  }).promise;
  page.cleanup();
  return canvas;
}

/**
 * Zeichnet eine Seite für die Vorschau in der gewünschten Breite in CSS-Pixeln.
 * Die Auflösung folgt devicePixelRatio, damit die Vorschau scharf ist.
 */
export async function renderPage(
  doc: PDFDocumentProxy,
  pageNumber: number,
  cssWidth: number,
  { extraRotation = 0, canvas }: { extraRotation?: number; canvas?: HTMLCanvasElement } = {},
): Promise<HTMLCanvasElement> {
  const size = await pageSize(doc, pageNumber, extraRotation);
  const ratio = globalThis.devicePixelRatio || 1;
  const result = await renderPageAt(doc, pageNumber, {
    scale: (cssWidth / size.width) * ratio,
    extraRotation,
    ...(canvas ? { canvas } : {}),
  });
  result.style.width = `${cssWidth}px`;
  return result;
}
