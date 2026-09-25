import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import type { Plugin } from 'vite';
import { describe, expect, it } from 'vitest';
import { pdfjsFallbacks } from '../../build/pdfjs.ts';

const wasmDir = join(
  dirname(createRequire(import.meta.url).resolve('pdfjs-dist/package.json')),
  'wasm',
);

type Hook = (...args: unknown[]) => unknown;
const hook = (plugin: Plugin, name: keyof Plugin): Hook => plugin[name] as Hook;

/** Ruft generateBundle mit einem nachgebildeten Bundle auf und sammelt die ausgegebenen Dateien. */
function emitted(wasm: boolean, moduleIds: string[]): string[] {
  const files: string[] = [];
  const context = { emitFile: (f: { fileName: string }) => files.push(f.fileName) };
  const bundle = { 'assets/a.js': { type: 'chunk', moduleIds } };
  hook(pdfjsFallbacks({ wasm }), 'generateBundle').call(context, {}, bundle);
  return files;
}

describe('pdf.js-Dekoder im Build (build/pdfjs.ts)', () => {
  it('liefert die Ersatzdekoder nur aus, wenn pdf.js im Build ist und WASM aus ist', () => {
    const pdfjs = ['/p/node_modules/pdfjs-dist/build/pdf.mjs'];
    expect(emitted(false, pdfjs)).toEqual([
      'pdfjs/openjpeg_nowasm_fallback.js',
      'pdfjs/jbig2_nowasm_fallback.js',
    ]);
    expect(emitted(false, ['/p/src/tools/x/page.ts'])).toEqual([]);
    expect(emitted(true, pdfjs)).toEqual([]);
  });

  it('macht aus .wasm?inline ein Modul mit denselben Bytes, Pfad bleibt im Paket', () => {
    const plugin = pdfjsFallbacks({ wasm: true });
    const id = hook(plugin, 'resolveId')('pdfjs-dist/wasm/jbig2.wasm?inline') as string;
    expect(id).toMatch(/[\\/]node_modules[\\/]pdfjs-dist[\\/]wasm[\\/]jbig2\.wasm\?/);
    const code = hook(plugin, 'load')(id) as string;
    const url = JSON.parse(code.replace(/^export default /, '').replace(/;$/, '')) as string;
    expect(url.startsWith('data:application/wasm;base64,')).toBe(true);
    const bytes = Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
    expect(bytes.equals(readFileSync(join(wasmDir, 'jbig2.wasm')))).toBe(true);
    expect(hook(plugin, 'resolveId')('pdfjs-dist/wasm/quickjs-eval.wasm')).toBeNull();
  });
});
