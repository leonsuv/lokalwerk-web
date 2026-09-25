import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { recordShippedPackages, writeShippedManifest } from '../../build/shipped-packages.ts';

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
