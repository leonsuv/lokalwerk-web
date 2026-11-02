import { degrees, PDFDict, PDFDocument, PDFName, StandardFonts, rgb } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { A4, LETTER } from '../../../src/core/pdf/image-layout.ts';
import { LetterheadError, overlayLetterhead } from '../../../src/core/pdf/letterhead.ts';
import { PdfError } from '../../../src/core/pdf/merge.ts';

/** Brief mit Text und einer Vektorlinie auf jeder Seite; leere Seiten lassen sich nicht einbetten */
async function letter(pages: { width: number; height: number }[]): Promise<Uint8Array> {
  const d = await PDFDocument.create();
  const font = await d.embedFont(StandardFonts.Helvetica);
  for (const { width, height } of pages) {
    const page = d.addPage([width, height]);
    page.drawText('Sehr geehrte Damen und Herren', { x: 72, y: height - 150, size: 12, font });
    page.drawLine({ start: { x: 72, y: 300 }, end: { x: 300, y: 300 }, color: rgb(0, 0, 0) });
  }
  return d.save();
}

/** Briefpapier: auf jeder Seite ein farbiges Rechteck oben */
async function letterhead(pages: { width: number; height: number }[]): Promise<Uint8Array> {
  const d = await PDFDocument.create();
  for (const { width, height } of pages) {
    const page = d.addPage([width, height]);
    page.drawRectangle({ x: 0, y: height - 80, width, height: 80, color: rgb(0.8, 0.1, 0.1) });
  }
  return d.save();
}

/** Anzahl der eingebetteten Formulare (Brief und Briefpapier) auf einer Seite */
function xObjectCount(doc: PDFDocument, index: number): number {
  const page = doc.getPage(index);
  const xObjects = page.node.Resources()?.lookup(PDFName.of('XObject'), PDFDict);
  return xObjects?.entries().length ?? 0;
}

const first = { pick: 'first', fit: false } as const;

describe('overlayLetterhead', () => {
  it('jede Briefseite wird eine Seite in der Größe des Briefpapiers, mit zwei Formularen', async () => {
    const out = await PDFDocument.load(
      await overlayLetterhead(
        await letter([A4, A4]),
        await letterhead([{ width: A4.width, height: A4.height }]),
        first,
      ),
    );
    expect(out.getPageCount()).toBe(2);
    for (const [i, page] of out.getPages().entries()) {
      expect(page.getSize()).toEqual({ width: A4.width, height: A4.height });
      expect(xObjectCount(out, i)).toBe(2);
    }
  });

  it('„first“ nutzt bei mehrseitigem Briefpapier immer die erste Seite', async () => {
    const out = await PDFDocument.load(
      await overlayLetterhead(
        await letter([A4, A4, A4]),
        await letterhead([
          { width: A4.width, height: A4.height },
          { width: LETTER.width, height: LETTER.height },
        ]),
        first,
      ),
    );
    const sizes = out.getPages().map((p) => p.getSize());
    expect(sizes.every((s) => s.width === A4.width && s.height === A4.height)).toBe(true);
  });

  it('„match“ nimmt die Seite mit gleicher Nummer, überzählige Seiten die letzte', async () => {
    const out = await PDFDocument.load(
      await overlayLetterhead(
        await letter([A4, A4, A4]),
        await letterhead([
          { width: A4.width, height: A4.height },
          { width: LETTER.width, height: LETTER.height },
        ]),
        { pick: 'match', fit: false },
      ),
    );
    expect(out.getPages().map((p) => p.getSize())).toEqual([
      { width: A4.width, height: A4.height },
      { width: LETTER.width, height: LETTER.height },
      { width: LETTER.width, height: LETTER.height },
    ]);
  });

  it('mit Anpassen wird der Brief in die Größe des Briefpapiers gebracht, Seitengröße bleibt die des Papiers', async () => {
    const out = await PDFDocument.load(
      await overlayLetterhead(
        await letter([{ width: 1190, height: 1684 }]),
        await letterhead([{ width: LETTER.width, height: LETTER.height }]),
        { pick: 'first', fit: true },
      ),
    );
    expect(out.getPage(0).getSize()).toEqual({ width: LETTER.width, height: LETTER.height });
    expect(xObjectCount(out, 0)).toBe(2);
  });

  it('ein Briefpapier mit gedrehter Seite ergibt eine Seite mit der sichtbaren Größe', async () => {
    const d = await PDFDocument.create();
    const page = d.addPage([A4.width, A4.height]);
    page.drawRectangle({ x: 0, y: 0, width: A4.width, height: A4.height });
    page.setRotation(degrees(90));
    const rotated = await d.save();
    const out = await PDFDocument.load(await overlayLetterhead(await letter([A4]), rotated, first));
    expect(out.getPage(0).getSize()).toEqual({ width: A4.height, height: A4.width });
  });

  it('ein kaputtes Briefpapier meldet den Fehler für das Briefpapier', async () => {
    await expect(
      overlayLetterhead(await letter([A4]), new Uint8Array([1, 2, 3, 4]), first),
    ).rejects.toBeInstanceOf(LetterheadError);
  });

  it('ein leeres Briefpapier meldet den Fehler für das Briefpapier', async () => {
    await expect(
      overlayLetterhead(await letter([A4]), new Uint8Array(), first),
    ).rejects.toMatchObject({ code: 'letterhead-invalid' });
  });

  it('ein leerer Brief meldet die normale PDF-Fehlermeldung', async () => {
    await expect(
      overlayLetterhead(new Uint8Array(), await letterhead([A4]), first),
    ).rejects.toBeInstanceOf(PdfError);
  });
});
