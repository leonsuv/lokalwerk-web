/**
 * JS-Ersatzdekoder von pdf.js für JPEG 2000 und JBIG2/CCITT (plan-phase2.md Abschnitt 5.1, E4:
 * ohne WebAssembly). Werden nur ausgeliefert, wenn der Build pdf.js überhaupt enthält.
 * pdf.js lädt sie im Worker per import() von `${wasmUrl}${Dateiname}`. Deshalb stehen sie unter
 * festem Namen in dist/pdfjs/ statt als gehashte Bundle-Teile (src/ui/pdfjs/fallbacks.ts).
 *
 * Außerdem: core-js im Legacy-Build von pdf.js (docs/pdfjs-kompatibilitaet.md). Steckt core-js
 * im Build, muss es genau die Version sein, deren Lizenz auf /lizenzen/ steht (CORE_JS_VERSION);
 * dass der Eintrag dort steht, prüft verifyLicensesListed über REQUIRED_DATA_LICENSES.
 */

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import type { Plugin } from 'vite';
import { FALLBACK_DIR, FALLBACK_FILES } from '../src/ui/pdfjs/fallbacks.ts';
import { CORE_JS_LICENSE_FILE, CORE_JS_VERSION, REQUIRED_DATA_LICENSES } from './licenses.ts';
import { recordFilePackages } from './shipped-packages.ts';

const PDFJS_MODULE = /[\\/]node_modules[\\/]pdfjs-dist[\\/]/;

function wasmDir(): string {
  const require = createRequire(import.meta.url);
  return join(dirname(require.resolve('pdfjs-dist/package.json')), 'wasm');
}

/** core-js führt seine Lizenzadresse mit Version als Zeichenkette mit (shared-store) */
const CORE_JS_MARKER = /zloirock\/core-js\/blob\/v(\d+\.\d+\.\d+)\/LICENSE/g;

/**
 * Probleme mit core-js in den ausgelieferten Skripten: eine andere Version als die, deren
 * Lizenz aufgeführt ist, oder core-js, ohne dass dessen Lizenz bei pdfjs-dist verlangt wird.
 */
export function checkCoreJs(
  files: readonly { name: string; code: string }[],
  expected = CORE_JS_VERSION,
  licensed = (REQUIRED_DATA_LICENSES['pdfjs-dist'] ?? []).some(
    (l) => l.file === CORE_JS_LICENSE_FILE,
  ),
): string[] {
  const problems: string[] = [];
  for (const { name, code } of files) {
    const versions = new Set([...code.matchAll(CORE_JS_MARKER)].map((m) => m[1]));
    for (const version of versions) {
      if (!licensed) problems.push(`${name}: enthält core-js ${version}, dessen Lizenz fehlt`);
      else if (version !== expected) {
        problems.push(
          `${name}: enthält core-js ${version}, aufgeführt ist ${expected}. Lizenztext und CORE_JS_VERSION in build/licenses.ts anpassen.`,
        );
      }
    }
  }
  return problems;
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
      const scripts = Object.values(bundle).flatMap((o) =>
        o.type === 'chunk'
          ? [{ name: o.fileName, code: o.code }]
          : o.fileName.endsWith('.js')
            ? [
                {
                  name: o.fileName,
                  code:
                    typeof o.source === 'string' ? o.source : new TextDecoder().decode(o.source),
                },
              ]
            : [],
      );
      const problems = checkCoreJs(scripts);
      if (problems.length > 0) this.error(`core-js: ${problems.join('; ')}`);
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
