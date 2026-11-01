import { degrees, PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { halvePages, halves, userRect } from '../../../src/core/pdf/halve.ts';

async function twoPageDoc(rotate = 0): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const a = doc.addPage([400, 200]);
  a.setRotation(degrees(rotate));
  a.drawText('Doppelseite');
  doc.addPage([400, 200]);
  return doc.save();
}

describe('userRect', () => {
  const box = { x: 10, y: 20, width: 400, height: 200 };

  it('ungedrehte Seite: linke und rechte Hälfte', () => {
    const [left, right] = halves('vertical');
    expect(userRect(box, 0, left)).toEqual({ x: 10, y: 20, width: 200, height: 200 });
    expect(userRect(box, 0, right)).toEqual({ x: 210, y: 20, width: 200, height: 200 });
  });

  it('obere und untere Hälfte, oben zuerst', () => {
    const [top, bottom] = halves('horizontal');
    expect(userRect(box, 0, top)).toEqual({ x: 10, y: 120, width: 400, height: 100 });
    expect(userRect(box, 0, bottom)).toEqual({ x: 10, y: 20, width: 400, height: 100 });
  });

  it.each([90, 180, 270] as const)(
    'gedrehte Seite (%i Grad): die Hälften ergeben zusammen wieder die ganze Seite',
    (rotation) => {
      const [a, b] = halves('vertical').map((r) => userRect(box, rotation, r)) as [
        ReturnType<typeof userRect>,
        ReturnType<typeof userRect>,
      ];
      const x0 = Math.min(a.x, b.x);
      const y0 = Math.min(a.y, b.y);
      const x1 = Math.max(a.x + a.width, b.x + b.width);
      const y1 = Math.max(a.y + a.height, b.y + b.height);
      expect([x0, y0, x1 - x0, y1 - y0]).toEqual([10, 20, 400, 200]);
      // überlappungsfrei: Flächen addieren sich
      expect(a.width * a.height + b.width * b.height).toBeCloseTo(400 * 200);
    },
  );

  it('um 90 Grad gedreht liegt die linke angezeigte Hälfte unten im Benutzerraum', () => {
    // /Rotate 90: der Benutzerraum wird im Uhrzeigersinn gedreht angezeigt; links = unten
    const [left] = halves('vertical');
    const part = userRect(box, 90, left);
    expect(part).toEqual({ x: 10, y: 20, width: 400, height: 100 });
  });
});

describe('halvePages', () => {
  it('macht aus jeder Seite zwei, in der Reihenfolge links, rechts', async () => {
    const out = await PDFDocument.load(await halvePages(await twoPageDoc(), 'vertical'));
    expect(out.getPageCount()).toBe(4);
    const boxes = out.getPages().map((p) => p.getCropBox());
    expect(boxes[0]).toMatchObject({ x: 0, width: 200, height: 200 });
    expect(boxes[1]).toMatchObject({ x: 200, width: 200, height: 200 });
  });

  it('oben zuerst bei horizontaler Teilung', async () => {
    const out = await PDFDocument.load(await halvePages(await twoPageDoc(), 'horizontal'));
    const boxes = out.getPages().map((p) => p.getCropBox());
    expect(boxes[0]).toMatchObject({ y: 100, width: 400, height: 100 });
    expect(boxes[1]).toMatchObject({ y: 0, width: 400, height: 100 });
  });

  it('behält die Drehung der Seite', async () => {
    const out = await PDFDocument.load(await halvePages(await twoPageDoc(90), 'vertical'));
    expect(out.getPage(0).getRotation().angle).toBe(90);
    expect(out.getPage(1).getRotation().angle).toBe(90);
  });

  it('meldet Fortschritt je Quellseite und lehnt Unbrauchbares ab', async () => {
    const seen: number[] = [];
    await halvePages(await twoPageDoc(), 'vertical', (done) => seen.push(done));
    expect(seen).toEqual([1, 2]);
    await expect(halvePages(new Uint8Array(0), 'vertical')).rejects.toMatchObject({
      code: 'empty',
    });
  });
});
