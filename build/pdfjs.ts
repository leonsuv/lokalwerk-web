/**
 * Dekoder von pdf.js für JPEG 2000 und JBIG2/CCITT (plan-phase2.md Abschnitt 5.1):
 *
 * - Ohne WebAssembly: liefert die JS-Ersatzdekoder aus, aber nur, wenn der Build pdf.js überhaupt
 *   enthält. pdf.js lädt sie im Worker per import() von `${wasmUrl}${Dateiname}`. Deshalb stehen
 *   sie unter festem Namen in dist/pdfjs/ statt als gehashte Bundle-Teile (src/ui/pdfjs/fallbacks.ts).
 * - Mit WebAssembly: `pdfjs-dist/wasm/<name>.wasm?inline` wird zu einem JS-Modul mit dem Inhalt
 *   als Base64-Text (Vite kann .wasm nicht als ?inline laden). Der Modulpfad bleibt in
 *   node_modules/pdfjs-dist, damit Lizenz- und Adressprüfung das Paket zuordnen.
 */

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import type { Plugin } from 'vite';
import { FALLBACK_DIR, FALLBACK_FILES } from '../src/ui/pdfjs/fallbacks.ts';
import { recordFilePackages } from './shipped-packages.ts';

const PDFJS_MODULE = /[\\/]node_modules[\\/]pdfjs-dist[\\/]/;
const WASM_INLINE = /^pdfjs-dist\/wasm\/([a-z0-9_]+\.wasm)\?inline$/;
const WASM_BASE64 = '?pdfjs-base64';

function wasmDir(): string {
  const require = createRequire(import.meta.url);
  return join(dirname(require.resolve('pdfjs-dist/package.json')), 'wasm');
}

export function pdfjsFallbacks({ wasm }: { wasm: boolean }): Plugin {
  return {
    name: 'lokalwerk-pdfjs-fallbacks',
    enforce: 'pre',
    resolveId(id) {
      const name = WASM_INLINE.exec(id)?.[1];
      return name ? `${join(wasmDir(), name)}${WASM_BASE64}` : null;
    },
    load(id) {
      if (!id.endsWith(WASM_BASE64)) return null;
      const bytes = readFileSync(id.slice(0, -WASM_BASE64.length));
      return `export default ${JSON.stringify(`data:application/wasm;base64,${bytes.toString('base64')}`)};`;
    },
    configureServer(server) {
      if (wasm) return;
      server.middlewares.use((req, res, next) => {
        const file = FALLBACK_FILES.find((f) => req.url === `/${FALLBACK_DIR}/${f}`);
        if (!file) return next();
        res.setHeader('Content-Type', 'text/javascript');
        res.end(readFileSync(join(wasmDir(), file)));
      });
    },
    generateBundle(_options, bundle) {
      if (wasm) return;
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
