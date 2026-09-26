import { readFileSync } from 'node:fs';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { A4, buildIdCopyPdf, layoutIdPage } from '../../../src/core/pdf/id-copy.ts';

const jpeg = new Uint8Array(
  readFileSync(new URL('../../fixtures/images/ohne-metadaten.jpg', import.meta.url)),
);

describe('layoutIdPage', () => {
  it('zwei Ausweisseiten untereinander, gleich breit, innerhalb der Ränder', () => {
    // Personalausweis im Querformat, etwa 85,6 × 54 mm
    const [front, back] = layoutIdPage([
      { width: 856, height: 540 },
      { width: 856, height: 540 },
    ]);
    expect(front?.width).toBeCloseTo(back?.width ?? 0);
    expect(front?.y ?? 0).toBeGreaterThan((back?.y ?? 0) + (back?.height ?? 0));
    for (const p of [front, back]) {
      expect(p?.x ?? 0).toBeGreaterThan(0);
      expect((p?.x ?? 0) + (p?.width ?? 0)).toBeLessThan(A4.width);
      expect(p?.y ?? 0).toBeGreaterThan(0);
    }
  });

  it('verkleinert hohe Bilder, bis beide auf die Seite passen', () => {
    const places = layoutIdPage([
      { width: 1000, height: 3000 },
      { width: 1000, height: 3000 },
    ]);
    expect(places.at(-1)?.y ?? -1).toBeGreaterThan(0);
  });
});

describe('buildIdCopyPdf', () => {
  it('eine A4-Seite mit den Bildern, ohne Metadaten', async () => {
    const out = await buildIdCopyPdf([
      { jpeg, width: 640, height: 480 },
      { jpeg, width: 640, height: 480 },
    ]);
    const doc = await PDFDocument.load(out, { updateMetadata: false });
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getPage(0).getSize()).toEqual({ width: A4.width, height: A4.height });
    expect(doc.getTitle()).toBeUndefined();
    expect(doc.getProducer()).toBeUndefined();
  });

  it('lehnt eine leere Liste ab', async () => {
    await expect(buildIdCopyPdf([])).rejects.toMatchObject({ code: 'no-pages' });
  });
});
