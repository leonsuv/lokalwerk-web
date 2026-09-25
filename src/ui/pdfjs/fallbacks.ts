/**
 * Ort der JS-Ersatzdekoder von pdf.js (Variante ohne WebAssembly). Gemeinsam für den Worker
 * (src/ui/pdfjs/pdfjs.worker.ts), getDocument (wasmUrl) und den Build (build/pdfjs.ts), damit
 * die Adressen übereinstimmen: pdf.js lädt `${wasmUrl}${Dateiname}` per import().
 */

export const FALLBACK_DIR = 'pdfjs';
export const FALLBACK_FILES = ['openjpeg_nowasm_fallback.js', 'jbig2_nowasm_fallback.js'] as const;
