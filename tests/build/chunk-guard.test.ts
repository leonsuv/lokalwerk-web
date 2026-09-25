import { describe, expect, it } from 'vitest';
import { checkChunks, type ChunkInfo } from '../../build/chunk-guard.ts';

const chunk = (fileName: string, over: Partial<ChunkInfo> = {}): ChunkInfo => ({
  fileName,
  isEntry: false,
  imports: [],
  moduleIds: [],
  ...over,
});

describe('checkChunks', () => {
  it('lässt eine Seite mit eigenem Seitencode und gemeinsamen Hilfsmodulen zu', () => {
    expect(
      checkChunks([
        chunk('assets/page-a.js', {
          isEntry: true,
          imports: ['assets/dom.js'],
          moduleIds: ['/p/src/tools/pdf-teilen/page.ts'],
        }),
        chunk('assets/dom.js', { moduleIds: ['/p/src/ui/dom.ts'] }),
      ]),
    ).toEqual([]);
  });

  it('meldet, wenn eine Seite den Seitencode eines anderen Werkzeugs mitlädt (Fehler vom 25.09.2026)', () => {
    expect(
      checkChunks([
        chunk('assets/page-dup.js', {
          isEntry: true,
          imports: ['assets/page-stamp.js'],
          moduleIds: ['/p/src/tools/duplikate-finden/page.ts'],
        }),
        chunk('assets/page-stamp.js', {
          moduleIds: [
            '/p/src/tools/pdf-stempel/page.ts',
            '/p/src/ui/local-counter.ts',
            '/p/node_modules/pdf-lib/es/index.js',
          ],
        }),
      ]),
    ).toEqual([
      'assets/page-dup.js lädt Seitencode mehrerer Werkzeuge: duplikate-finden, pdf-stempel',
      'assets/page-dup.js lädt im Hauptthread: pdf-lib (gehört in einen Worker)',
    ]);
  });

  it('zählt dynamische Importe nicht (Startseite lädt Werkzeuge erst beim Ablegen)', () => {
    expect(
      checkChunks([
        chunk('assets/index.html.js', { isEntry: true, moduleIds: ['/p/src/tools/home/page.ts'] }),
        chunk('assets/page-x.js', { moduleIds: ['/p/src/tools/pdf-teilen/page.ts'] }),
      ]),
    ).toEqual([]);
  });

  it('meldet SheetJS im Hauptthread', () => {
    expect(
      checkChunks([
        chunk('assets/e.js', { isEntry: true, moduleIds: ['/p/node_modules/xlsx/xlsx.mjs'] }),
      ]),
    ).toEqual(['assets/e.js lädt im Hauptthread: xlsx (gehört in einen Worker)']);
  });
});
