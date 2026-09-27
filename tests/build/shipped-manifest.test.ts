import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  packagesByTool,
  recordShippedPackages,
  writeShippedManifest,
  type BundleChunk,
} from '../../build/shipped-packages.ts';

type Hook = (options: unknown, bundle: Record<string, unknown>) => void;

describe('Zuordnung Datei → Pakete (plan-phase2.md E14)', () => {
  it('schreibt je Datei im Build die enthaltenen Pakete, Dateien ohne Pakete fehlen', () => {
    const generate = recordShippedPackages().generateBundle as unknown as Hook;
    generate.call(
      {},
      {},
      {
        a: {
          type: 'chunk',
          fileName: 'assets/tabelle.worker-X1.js',
          moduleIds: [
            '/p/node_modules/xlsx/xlsx.mjs',
            '/p/src/core/sheet/xlsx.ts',
            '/p/node_modules/xlsx/xlsx.mjs?commonjs',
          ],
        },
        b: {
          type: 'chunk',
          fileName: 'assets/nur-eigener-code-X2.js',
          moduleIds: ['/p/src/core/search/match.ts'],
        },
        c: { type: 'asset', fileName: 'assets/main.css' },
      },
    );

    const file = join(mkdtempSync(join(tmpdir(), 'lokalwerk-')), 'shipped-files.json');
    (writeShippedManifest(file).closeBundle as () => void).call({});
    const manifest = JSON.parse(readFileSync(file, 'utf8')) as Record<string, string[]>;
    expect(manifest['assets/tabelle.worker-X1.js']).toEqual(['xlsx']);
    expect(manifest).not.toHaveProperty('assets/nur-eigener-code-X2.js');
    expect(manifest).not.toHaveProperty('assets/main.css');
  });
});

describe('packagesByTool (Lizenzseite: welche Werkzeuge welche Pakete laden)', () => {
  const chunk = (fileName: string, over: Partial<BundleChunk> = {}): BundleChunk => ({
    fileName,
    code: '',
    imports: [],
    dynamicImports: [],
    moduleIds: [],
    ...over,
  });

  it('folgt statischen und dynamischen Importen und den Workern im Code', () => {
    const chunks = [
      chunk('assets/pdf-teilen/index.html-A.js', {
        moduleIds: ['/p/src/tools/pdf-teilen/page.ts'],
        code: 'new Worker(new URL("/assets/split.worker-X.js", import.meta.url))',
        dynamicImports: ['assets/pdfjs-B.js'],
      }),
      chunk('assets/pdfjs-B.js', { moduleIds: ['/p/node_modules/pdfjs-dist/build/pdf.mjs'] }),
      chunk('assets/index.html-H.js', {
        moduleIds: ['/p/src/tools/home/page.ts'],
        dynamicImports: ['assets/pdf-teilen/index.html-A.js'],
      }),
    ];
    const files = new Map([
      ['assets/split.worker-X.js', new Set(['pdf-lib', 'pako'])],
      ['assets/sheet.worker-Y.js', new Set(['xlsx'])],
    ]);
    const result = packagesByTool(chunks, files, new Set(['pdf-teilen']));
    expect([...result.keys()]).toEqual(['pdf-teilen']);
    expect([...(result.get('pdf-teilen') ?? [])].sort()).toEqual(['pako', 'pdf-lib', 'pdfjs-dist']);
  });

  it('zählt ein nachgeladenes anderes Werkzeug nicht mit (Knopf zur PDF-Werkstatt)', () => {
    const chunks = [
      chunk('assets/pdf-zu-bildern/index.html-A.js', {
        moduleIds: ['/p/src/tools/pdf-zu-bildern/page.ts', '/p/src/ui/workshop-link.ts'],
        dynamicImports: ['assets/workshop-switch-S.js'],
      }),
      chunk('assets/workshop-switch-S.js', {
        moduleIds: ['/p/src/ui/workshop-switch.ts'],
        dynamicImports: ['assets/page-W.js'],
      }),
      chunk('assets/page-W.js', {
        moduleIds: ['/p/src/tools/pdf-werkstatt/page.ts'],
        code: 'new Worker(new URL("/assets/workshop.worker-X.js", import.meta.url))',
      }),
    ];
    const files = new Map([['assets/workshop.worker-X.js', new Set(['pdf-lib'])]]);
    const result = packagesByTool(chunks, files, new Set(['pdf-zu-bildern', 'pdf-werkstatt']));
    expect([...(result.get('pdf-zu-bildern') ?? [])]).toEqual([]);
    expect([...(result.get('pdf-werkstatt') ?? [])]).toEqual(['pdf-lib']);
  });
});
