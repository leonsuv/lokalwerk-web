import { degrees, PDFDocument, PDFRawStream } from 'pdf-lib';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { addHeaderFooter, HeaderFooterError } from '../../../src/core/pdf/header-footer.ts';
import type { HeaderFooterOptions } from '../../../src/core/pdf/header-footer-layout.ts';

const EMPTY_ROW = { left: '', center: '', right: '' };

async function makePdf(pages: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i += 1) doc.addPage([595.28, 841.89]);
  return doc.save();
}

function options(over: Partial<HeaderFooterOptions> = {}): HeaderFooterOptions {
  return {
    texts: { header: { ...EMPTY_ROW, left: 'Vertrag' }, footer: { ...EMPTY_ROW } },
    number: { row: 'footer', slot: 'center', format: 'Seite {n} von {N}' },
    fontSize: 10,
    marginMm: 10,
    pages: null,
    ...over,
  };
}

/**
 * Anzahl der Textzeichen-Operatoren (Tj) in allen Inhaltsströmen. Inhalte werden entpackt, wenn
 * sie komprimiert sind.
 */
async function countTextOps(bytes: Uint8Array): Promise<number> {
  const doc = await PDFDocument.load(bytes);
  let count = 0;
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream)) continue;
    let data: Uint8Array = obj.contents;
    try {
      data = inflateSync(obj.contents);
    } catch {
      // Nicht komprimiert: die Bytes sind schon Text.
    }
    count += new TextDecoder('latin1').decode(data).match(/\bTj\b/g)?.length ?? 0;
  }
  return count;
}

describe('addHeaderFooter', () => {
  it('schreibt auf alle Seiten und behält die Seitenzahl', async () => {
    const input = await makePdf(3);
    const out = await addHeaderFooter(input, options());
    const reread = await PDFDocument.load(out);
    expect(reread.getPageCount()).toBe(3);
    // Zwei Texte je Seite: Kopf links, Seitenzahl unten
    expect(await countTextOps(out)).toBe(6);
  });

  it('nur die gewählten Seiten bekommen Text', async () => {
    const input = await makePdf(4);
    const out = await addHeaderFooter(input, options({ pages: [1, 3] }));
    expect(await countTextOps(out)).toBe(4);
  });

  it('Originalinhalt bleibt erhalten: die Seiten sind größer geworden, nicht ersetzt', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([300, 300]);
    page.drawText('Bestand', { x: 20, y: 150, size: 12 });
    const input = await doc.save();
    const out = await addHeaderFooter(input, options({ pages: [0] }));
    expect(await countTextOps(out)).toBe((await countTextOps(input)) + 2);
    expect(out.byteLength).toBeGreaterThan(input.byteLength);
  });

  it('ohne Seitenzahl und mit Leerzeilen bleibt Text frei', async () => {
    const input = await makePdf(1);
    const out = await addHeaderFooter(
      input,
      options({
        number: null,
        texts: { header: EMPTY_ROW, footer: { ...EMPTY_ROW, right: 'Entwurf' } },
      }),
    );
    expect(await countTextOps(out)).toBe(1);
  });

  it('meldet nicht darstellbare Zeichen und schreibt nichts', async () => {
    const input = await makePdf(1);
    const error = await addHeaderFooter(
      input,
      options({ texts: { header: { ...EMPTY_ROW, left: 'Pfeil → und →' }, footer: EMPTY_ROW } }),
    ).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HeaderFooterError);
    expect((error as HeaderFooterError).code).toBe('unsupported-chars');
    expect((error as HeaderFooterError).chars).toEqual(['→']);
  });

  it('ohne jeden Eintrag gibt es keinen Lauf', async () => {
    const input = await makePdf(1);
    const error = await addHeaderFooter(
      input,
      options({ texts: { header: EMPTY_ROW, footer: EMPTY_ROW }, number: null }),
    ).catch((e: unknown) => e);
    expect((error as HeaderFooterError).code).toBe('nothing');
  });

  it('gedrehte Seiten bekommen den Text auf der sichtbaren Seite', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([300, 400]).setRotation(degrees(90));
    const out = await addHeaderFooter(await doc.save(), options());
    const reread = await PDFDocument.load(out);
    expect(reread.getPageCount()).toBe(1);
    expect(await countTextOps(out)).toBe(2);
  });
});
