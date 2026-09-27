import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CORE_JS_VERSION } from '../../build/licenses.ts';
import { checkCoreJs, pdfjsFallbacks } from '../../build/pdfjs.ts';

const wasmDir = join(
  dirname(createRequire(import.meta.url).resolve('pdfjs-dist/package.json')),
  'wasm',
);

type Emitted = { fileName: string; source: Buffer };
type Hook = (...args: unknown[]) => unknown;

/** Ruft generateBundle mit einem nachgebildeten Bundle auf und sammelt die ausgegebenen Dateien. */
function emitted(moduleIds: string[]): Emitted[] {
  const files: Emitted[] = [];
  const context = { emitFile: (f: Emitted) => files.push(f) };
  const bundle = { 'assets/a.js': { type: 'chunk', fileName: 'assets/a.js', code: '', moduleIds } };
  (pdfjsFallbacks().generateBundle as Hook).call(context, {}, bundle);
  return files;
}

describe('pdf.js-Ersatzdekoder im Build (build/pdfjs.ts)', () => {
  it('liefert sie unverändert unter festem Namen aus, wenn pdf.js im Build ist', () => {
    const files = emitted(['/p/node_modules/pdfjs-dist/build/pdf.mjs']);
    expect(files.map((f) => f.fileName)).toEqual([
      'pdfjs/openjpeg_nowasm_fallback.js',
      'pdfjs/jbig2_nowasm_fallback.js',
    ]);
    for (const f of files) {
      const original = readFileSync(join(wasmDir, f.fileName.replace('pdfjs/', '')));
      expect(f.source.equals(original), f.fileName).toBe(true);
    }
  });

  it('liefert nichts aus, wenn keine Seite pdf.js verwendet', () => {
    expect(emitted(['/p/src/tools/x/page.ts'])).toEqual([]);
  });
});

describe('core-js im Legacy-Build von pdf.js (docs/pdfjs-kompatibilitaet.md)', () => {
  const legacy = (file: string) =>
    readFileSync(join(wasmDir, '..', 'legacy', 'build', file), 'utf8');

  it('erkennt core-js im Hauptthread- und im Worker-Teil, mit der aufgeführten Version', () => {
    const files = ['pdf.mjs', 'pdf.worker.mjs'].map((f) => ({ name: f, code: legacy(f) }));
    expect(checkCoreJs(files)).toEqual([]);
    expect(checkCoreJs(files, '3.49.0')).toEqual([
      'pdf.mjs: enthält core-js 3.50.0, aufgeführt ist 3.49.0. Lizenztext und CORE_JS_VERSION in build/licenses.ts anpassen.',
      'pdf.worker.mjs: enthält core-js 3.50.0, aufgeführt ist 3.49.0. Lizenztext und CORE_JS_VERSION in build/licenses.ts anpassen.',
    ]);
    expect(checkCoreJs(files, CORE_JS_VERSION, false)).toHaveLength(2);
  });

  it('meldet nichts, wo kein core-js drin ist (moderner Build, eigener Code)', () => {
    const modern = readFileSync(join(wasmDir, '..', 'build', 'pdf.mjs'), 'utf8');
    expect(checkCoreJs([{ name: 'pdf.mjs', code: modern }], CORE_JS_VERSION, false)).toEqual([]);
  });

  it('bricht den Build ab, wenn die Version nicht passt', () => {
    const code = legacy('pdf.mjs');
    const errors: string[] = [];
    const context = {
      emitFile: () => undefined,
      error: (message: string) => {
        errors.push(message);
        throw new Error(message);
      },
    };
    const bundle = {
      'assets/w.js': {
        type: 'asset',
        fileName: 'assets/w.js',
        source: new TextEncoder().encode(code.replace(/v3\.50\.0/g, 'v3.51.0')),
      },
    };
    expect(() => (pdfjsFallbacks().generateBundle as Hook).call(context, {}, bundle)).toThrow();
    expect(errors[0]).toContain('assets/w.js: enthält core-js 3.51.0');
  });
});
