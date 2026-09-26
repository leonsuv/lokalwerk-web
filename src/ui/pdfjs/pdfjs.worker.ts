/**
 * Worker von pdf.js, lokal gebündelt (kein workerSrc, kein CDN).
 *
 * pdf.js lädt die JS-Ersatzdekoder für JPEG 2000 und JBIG2/CCITT erst, wenn eine PDF sie braucht.
 * Hier werden sie beim Start vorgeladen: import() mit derselben Adresse findet sie danach im
 * Modulspeicher des Workers, auch ohne Internetverbindung (plan.md N4).
 */

import 'pdfjs-dist/build/pdf.worker.mjs';
import { FALLBACK_DIR, FALLBACK_FILES } from './fallbacks.ts';

for (const file of FALLBACK_FILES) {
  void import(/* @vite-ignore */ new URL(`/${FALLBACK_DIR}/${file}`, self.location.origin).href);
}
