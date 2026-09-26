import { readFileSync } from 'node:fs';
import { degrees, PDFDocument, PDFName } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { organizePdf } from '../../../src/core/pdf/organize.ts';

const fixture = (name: string) =>
  new Uint8Array(readFileSync(new URL(`../../fixtures/pdf/${name}`, import.meta.url)));

/** PDF mit Seiten unterschiedlicher Breite, damit die Reihenfolge erkennbar ist */
async function makePdf(widths: number[], rotate: number[] = []): Promise<Uint8Array> {
  const doc = await PDFDocument.create({ updateMetadata: false });
  doc.setTitle('Titel des Originals');
  for (const [i, w] of widths.entries()) {
    const page = doc.addPage([w, 800]);
    if (rotate[i]) page.setRotation(degrees(rotate[i]));
  }
  return doc.save();
}

async function describePages(bytes: Uint8Array) {
  const doc = await PDFDocument.load(bytes);
  return doc.getPages().map((p) => [p.getWidth(), p.getRotation().angle]);
}

describe('organizePdf', () => {
  it('sortiert um, löscht und dreht', async () => {
    const out = await organizePdf(await makePdf([100, 200, 300, 400]), [
      { source: 3, rotate: 0 },
      { source: 1, rotate: 90 },
      { source: 4, rotate: 270 },
    ]);
    expect(await describePages(out)).toEqual([
      [300, 0],
      [100, 90],
      [400, 270],
    ]);
  });

  it('addiert die Drehung zur vorhandenen /Rotate', async () => {
    const out = await organizePdf(await makePdf([100, 200], [90, 270]), [
      { source: 1, rotate: 90 },
      { source: 2, rotate: 180 },
    ]);
    expect(await describePages(out)).toEqual([
      [100, 180],
      [200, 90],
    ]);
  });

  it('kann eine Seite mehrfach übernehmen', async () => {
    const out = await organizePdf(await makePdf([100, 200]), [
      { source: 2, rotate: 0 },
      { source: 2, rotate: 0 },
    ]);
    expect(await describePages(out)).toEqual([
      [200, 0],
      [200, 0],
    ]);
  });

  it('übernimmt keine Metadaten und schreibt keine eigenen', async () => {
    const out = await organizePdf(await makePdf([100]), [{ source: 1, rotate: 0 }]);
    const doc = await PDFDocument.load(out, { updateMetadata: false });
    expect(doc.getTitle()).toBeUndefined();
    expect(doc.getProducer()).toBeUndefined();
    expect(doc.catalog.has(PDFName.of('Metadata'))).toBe(false);
  });

  it('lehnt leere Pläne, falsche Seiten und verschlüsselte PDFs ab', async () => {
    const pdf = await makePdf([100]);
    await expect(organizePdf(pdf, [])).rejects.toMatchObject({ code: 'no-pages' });
    await expect(organizePdf(pdf, [{ source: 2, rotate: 0 }])).rejects.toThrow(RangeError);
    await expect(
      organizePdf(fixture('passwort-zum-oeffnen.pdf'), [{ source: 1, rotate: 0 }]),
    ).rejects.toMatchObject({ code: 'encrypted' });
    await expect(organizePdf(new Uint8Array(), [{ source: 1, rotate: 0 }])).rejects.toMatchObject({
      code: 'empty',
    });
  });
});
