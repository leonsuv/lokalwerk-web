import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { pdfjsFallbacks } from '../../build/pdfjs.ts';

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
  const bundle = { 'assets/a.js': { type: 'chunk', moduleIds } };
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
