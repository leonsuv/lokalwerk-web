import { degrees, PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { A4, A5, LETTER } from '../../../src/core/pdf/image-layout.ts';
import { ResizeError, resizePages } from '../../../src/core/pdf/resize.ts';

/** Seite mit Inhalt; leere Seiten lassen sich nicht einbetten (pdf-lib) */
function filled(d: PDFDocument, width: number, height: number) {
  const page = d.addPage([width, height]);
  page.drawRectangle({ x: 0, y: 0, width, height });
  return page;
}

async function doc(): Promise<Uint8Array> {
  const d = await PDFDocument.create();
  filled(d, 400, 200);
  filled(d, 400, 200).setRotation(degrees(90));
  filled(d, 300, 600);
  return d.save();
}

describe('resizePages', () => {
  it('jede Seite bekommt die Zielgröße, Querformat bleibt quer', async () => {
    const out = await PDFDocument.load(
      await resizePages(await doc(), { size: 'a4', mode: 'scale' }),
    );
    const [a, b, c] = out.getPages();
    expect(out.getPageCount()).toBe(3);
    expect(a?.getSize()).toEqual({ width: A4.height, height: A4.width });
    // Gedrehte Seite: sichtbar 200 × 400, also hoch
    expect(b?.getSize()).toEqual({ width: A4.width, height: A4.height });
    expect(c?.getSize()).toEqual({ width: A4.width, height: A4.height });
  });

  it('A5 und Letter als Zielgröße', async () => {
    const a5 = await PDFDocument.load(
      await resizePages(await doc(), { size: 'a5', mode: 'center' }),
    );
    expect(a5.getPages()[1]?.getSize()).toEqual({ width: A5.width, height: A5.height });
    const letter = await PDFDocument.load(
      await resizePages(await doc(), { size: 'letter', mode: 'center' }),
    );
    expect(letter.getPages()[1]?.getSize()).toEqual({ width: LETTER.width, height: LETTER.height });
  });

  it('„Wie das Blatt“ behält die Seitengröße', async () => {
    const out = await PDFDocument.load(
      await resizePages(await doc(), { size: 'keep', mode: 'center' }),
    );
    const sizes = out.getPages().map((p) => p.getSize());
    expect(sizes).toEqual([
      { width: 400, height: 200 },
      { width: 200, height: 400 },
      { width: 300, height: 600 },
    ]);
  });

  it('Originalgröße: Seiten bleiben gleich groß, nur die Anordnung ändert sich', async () => {
    const out = await PDFDocument.load(
      await resizePages(await doc(), { size: 'keep', mode: 'center' }),
    );
    expect(out.getPages()[0]?.getSize()).toEqual({ width: 400, height: 200 });
  });

  it('wirft ResizeError mit Seitennummer, wenn der Rand nicht passt', async () => {
    const tiny = await PDFDocument.create();
    filled(tiny, 15, 15);
    await expect(
      resizePages(await tiny.save(), { size: 'keep', mode: 'scale' }),
    ).rejects.toBeInstanceOf(ResizeError);
    await expect(
      resizePages(await tiny.save(), { size: 'keep', mode: 'scale' }),
    ).rejects.toMatchObject({ code: 'page-too-small', page: 1 });
  });

  it('bei Originalgröße ohne Rand ist eine kleine Seite kein Fehler', async () => {
    const tiny = await PDFDocument.create();
    filled(tiny, 15, 15);
    const out = await PDFDocument.load(
      await resizePages(await tiny.save(), { size: 'keep', mode: 'center' }),
    );
    expect(out.getPages()[0]?.getSize()).toEqual({ width: 15, height: 15 });
  });
});
