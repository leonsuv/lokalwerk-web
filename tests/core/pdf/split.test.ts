import { readFileSync } from 'node:fs';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { PdfError } from '../../../src/core/pdf/merge.ts';
import { splitPdf } from '../../../src/core/pdf/split.ts';

const fixture = (name: string) =>
  new Uint8Array(readFileSync(new URL(`../../fixtures/pdf/${name}`, import.meta.url)));

/** Seite k hat die Breite 100 + k, damit man sie im Ergebnis wiedererkennt. */
async function makePdf(pages: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle('Geheimer Titel');
  doc.setAuthor('Anna Beispiel');
  for (let k = 1; k <= pages; k++) doc.addPage([100 + k, 500]);
  return doc.save();
}

const widths = async (bytes: Uint8Array) =>
  (await PDFDocument.load(bytes)).getPages().map((p) => p.getWidth() - 100);

describe('splitPdf', () => {
  it('übernimmt die Bereiche in der angegebenen Reihenfolge, eine PDF je Gruppe', async () => {
    const out = await splitPdf(await makePdf(6), [
      [
        { from: 5, to: 6 },
        { from: 1, to: 1 },
      ],
      [{ from: 2, to: 3 }],
    ]);
    expect(out).toHaveLength(2);
    expect(await widths(out[0] ?? new Uint8Array())).toEqual([5, 6, 1]);
    expect(await widths(out[1] ?? new Uint8Array())).toEqual([2, 3]);
  });

  it('meldet den Fortschritt je fertiger Datei', async () => {
    const progress: [number, number][] = [];
    await splitPdf(
      await makePdf(3),
      [[{ from: 1, to: 1 }], [{ from: 2, to: 2 }], [{ from: 3, to: 3 }]],
      (done, total) => progress.push([done, total]),
    );
    expect(progress).toEqual([
      [1, 3],
      [2, 3],
      [3, 3],
    ]);
  });

  it('übernimmt keine Metadaten und schreibt keine eigenen', async () => {
    const [out] = await splitPdf(await makePdf(2), [[{ from: 1, to: 2 }]]);
    const text = new TextDecoder('latin1').decode(out);
    expect(text).not.toContain('Geheimer Titel');
    expect(text).not.toContain('Anna Beispiel');
    expect(text).not.toMatch(/pdf-lib/i);
  });

  it('teilt auch eine mit macOS CoreGraphics erzeugte PDF', async () => {
    const out = await splitPdf(fixture('coregraphics-2-seiten.pdf'), [
      [{ from: 2, to: 2 }],
      [{ from: 1, to: 1 }],
    ]);
    for (const bytes of out) expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });

  it('lehnt verschlüsselte PDFs ab', async () => {
    await expect(
      splitPdf(fixture('passwort-zum-oeffnen.pdf'), [[{ from: 1, to: 1 }]]),
    ).rejects.toSatisfy((e) => e instanceof PdfError && e.code === 'encrypted');
  });
});
