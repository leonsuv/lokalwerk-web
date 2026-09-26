/**
 * JS-Ersatzdekoder von pdf.js für JPEG 2000 und JBIG2/CCITT (plan-phase2.md Abschnitt 5.1, E4:
 * ohne WebAssembly). Werden nur ausgeliefert, wenn der Build pdf.js überhaupt enthält.
 * pdf.js lädt sie im Worker per import() von `${wasmUrl}${Dateiname}`. Deshalb stehen sie unter
 * festem Namen in dist/pdfjs/ statt als gehashte Bundle-Teile (src/ui/pdfjs/fallbacks.ts).
 */

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import type { Plugin } from 'vite';
import { FALLBACK_DIR, FALLBACK_FILES } from '../src/ui/pdfjs/fallbacks.ts';
import { recordFilePackages } from './shipped-packages.ts';

const PDFJS_MODULE = /[\\/]node_modules[\\/]pdfjs-dist[\\/]/;

function wasmDir(): string {
  const require = createRequire(import.meta.url);
  return join(dirname(require.resolve('pdfjs-dist/package.json')), 'wasm');
}

export function pdfjsFallbacks(): Plugin {
  return {
    name: 'lokalwerk-pdfjs-fallbacks',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const file = FALLBACK_FILES.find((f) => req.url === `/${FALLBACK_DIR}/${f}`);
        if (!file) return next();
        res.setHeader('Content-Type', 'text/javascript');
        res.end(readFileSync(join(wasmDir(), file)));
      });
    },
    generateBundle(_options, bundle) {
      const usesPdfjs = Object.values(bundle).some(
        (o) => o.type === 'chunk' && o.moduleIds.some((id) => PDFJS_MODULE.test(id)),
      );
      if (!usesPdfjs) return;
      for (const file of FALLBACK_FILES) {
        const fileName = `${FALLBACK_DIR}/${file}`;
        this.emitFile({ type: 'asset', fileName, source: readFileSync(join(wasmDir(), file)) });
        recordFilePackages(fileName, ['pdfjs-dist']);
      }
    },
  };
}
