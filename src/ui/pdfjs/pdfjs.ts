/**
 * pdf.js-Einbindung (plan-phase2.md Abschnitt 5.1, Paket 4 Schritt 0). Nur dynamisch laden, und
 * zwar gleich beim Seitenaufruf, damit das Werkzeug danach offline funktioniert:
 * `const pdfjs = import('../../ui/pdfjs/pdfjs.ts');`
 *
 * - Worker lokal über workerPort (kein workerSrc, kein CDN).
 * - Keine Nachladedaten: cMapUrl, standardFontDataUrl und iccUrl bleiben leer, useWorkerFetch ist
 *   aus. Alle Dateianfragen von pdf.js beantwortet LocalBinaryDataFactory ohne Netzwerk.
 * - Kein PDF-JavaScript: Das führt pdf.js nur im Viewer über pdf.sandbox aus, das hier nicht
 *   eingebunden ist (scripts/check-dist.mjs prüft es). Die frühere Option isEvalSupported gibt
 *   es in pdf.js 6.3 nicht mehr; beide Bundles enthalten kein eval und kein new Function.
 * - Kein WebAssembly (plan-phase2.md E4): Die CSP bleibt ohne 'wasm-unsafe-eval'.
 * - Schriften über die FontFace-API, keine <style>-Elemente.
 */

import {
  AnnotationMode,
  getDocument,
  GlobalWorkerOptions,
  VerbosityLevel,
  type PDFDocumentProxy,
} from 'pdfjs-dist';
import { LocalBinaryDataFactory } from './binary-data.ts';
import { FALLBACK_DIR } from './fallbacks.ts';

GlobalWorkerOptions.workerPort = new Worker(new URL('./pdfjs.worker.ts', import.meta.url), {
  type: 'module',
});

export type { PDFDocumentProxy };

export function openPdf(data: Uint8Array): Promise<PDFDocumentProxy> {
  return getDocument({
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
}

/** Gibt den Speicher der PDF im Worker frei. Der Worker selbst läuft weiter. */
export function closePdf(doc: PDFDocumentProxy): Promise<void> {
  return doc.loadingTask.destroy();
}

/**
 * Zeichnet eine Seite in ein Canvas mit der gewünschten Breite in CSS-Pixeln.
 * Die Auflösung folgt devicePixelRatio, damit die Vorschau scharf ist.
 */
export async function renderPage(
  doc: PDFDocumentProxy,
  pageNumber: number,
  cssWidth: number,
  canvas: HTMLCanvasElement = document.createElement('canvas'),
): Promise<HTMLCanvasElement> {
  const page = await doc.getPage(pageNumber);
  const unscaled = page.getViewport({ scale: 1 });
  const ratio = globalThis.devicePixelRatio || 1;
  const viewport = page.getViewport({ scale: (cssWidth / unscaled.width) * ratio });
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  canvas.style.width = `${cssWidth}px`;
  await page.render({ canvas, viewport, annotationMode: AnnotationMode.ENABLE }).promise;
  page.cleanup();
  return canvas;
}
