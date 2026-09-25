/**
 * Worker von pdf.js, lokal gebündelt (kein workerSrc, kein CDN).
 *
 * Ohne WebAssembly lädt pdf.js die Ersatzdekoder erst, wenn eine PDF sie braucht. Hier werden
 * sie beim Start vorgeladen: import() mit derselben Adresse findet sie danach im Modulspeicher
 * des Workers, auch ohne Internetverbindung (plan.md N4).
 */

import 'pdfjs-dist/build/pdf.worker.mjs';
import { FALLBACK_DIR, FALLBACK_FILES } from './fallbacks.ts';
import { PDFJS_WASM } from './mode.ts';

if (!PDFJS_WASM) {
  for (const file of FALLBACK_FILES) {
    void import(/* @vite-ignore */ new URL(`/${FALLBACK_DIR}/${file}`, self.location.origin).href);
  }
}
