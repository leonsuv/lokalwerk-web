import { readFileSync } from 'node:fs';
import { PDFDocument, PDFName } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { countPages, mergePdfs, PdfError } from '../../../src/core/pdf/merge.ts';

const fixture = (name: string) =>
  new Uint8Array(readFileSync(new URL(`../../fixtures/pdf/${name}`, import.meta.url)));

/** PDF mit Seiten, deren Breite die Herkunft verrät: Datei n, Seite k → Breite n*100+k. */
async function makePdf(fileNo: number, pages: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let k = 1; k <= pages; k++) doc.addPage([fileNo * 100 + k, 500]);
  return doc.save();
}

async function widths(bytes: Uint8Array): Promise<number[]> {
  const doc = await PDFDocument.load(bytes);
  return doc.getPages().map((p) => p.getWidth());
}

async function errorCode(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof PdfError) return error.code;
    throw error;
  }
  throw new Error('kein Fehler geworfen');
}

const from = (bytes: Uint8Array) => () => Promise.resolve(bytes);

describe('countPages', () => {
  it('zählt Seiten einer mit pdf-lib erzeugten PDF', async () => {
    expect(await countPages(await makePdf(1, 3))).toBe(3);
  });

  it('zählt Seiten einer mit macOS CoreGraphics erzeugten PDF', async () => {
    expect(await countPages(fixture('coregraphics-2-seiten.pdf'))).toBe(2);
  });

  it('erkennt eine leere Datei', async () => {
    expect(await errorCode(countPages(new Uint8Array()))).toBe('empty');
  });

  it('erkennt eine PDF mit Passwort zum Öffnen', async () => {
    expect(await errorCode(countPages(fixture('passwort-zum-oeffnen.pdf')))).toBe('encrypted');
  });

  it('erkennt eine PDF, die nur Rechte einschränkt, ebenfalls als verschlüsselt', async () => {
    expect(await errorCode(countPages(fixture('nur-rechteschutz.pdf')))).toBe('encrypted');
  });

  it.each([0.9, 0.5, 0.1])(
    'erkennt eine auf %d abgeschnittene PDF als beschädigt',
    async (share) => {
      const bytes = await makePdf(1, 3);
      const cut = bytes.slice(0, Math.floor(bytes.length * share));
      expect(await errorCode(countPages(cut))).toBe('damaged');
    },
  );

  it('erkennt Nicht-PDF-Inhalt als beschädigt', async () => {
    expect(await errorCode(countPages(new TextEncoder().encode('Hallo Welt')))).toBe('damaged');
  });

  it('erkennt eine PDF ohne Seiten', async () => {
    const empty = await (await PDFDocument.create()).save({ addDefaultPage: false });
    expect(await errorCode(countPages(empty))).toBe('no-pages');
  });
});

describe('mergePdfs', () => {
  it('fügt alle Seiten in der angegebenen Reihenfolge zusammen', async () => {
    const a = await makePdf(1, 2);
    const b = await makePdf(2, 1);
    const c = await makePdf(3, 3);
    const result = await mergePdfs([from(c), from(a), from(b)]);
    expect(result.pages).toBe(6);
    expect(await widths(result.bytes)).toEqual([301, 302, 303, 101, 102, 201]);
  });

  it('verarbeitet PDFs aus anderen Programmen', async () => {
    const result = await mergePdfs([
      from(fixture('coregraphics-2-seiten.pdf')),
      from(await makePdf(1, 1)),
    ]);
    expect(result.pages).toBe(3);
  });

  it('meldet den Fortschritt nach jeder Datei', async () => {
    const calls: [number, number][] = [];
    await mergePdfs([from(await makePdf(1, 1)), from(await makePdf(2, 1))], (done, total) =>
      calls.push([done, total]),
    );
    expect(calls).toEqual([
      [1, 2],
      [2, 2],
    ]);
  });

  it('liest die Quellen nacheinander und erst bei Bedarf', async () => {
    const order: string[] = [];
    const source = (name: string, bytes: Uint8Array) => () => {
      order.push(`lesen ${name}`);
      return Promise.resolve(bytes);
    };
    await mergePdfs([source('a', await makePdf(1, 1)), source('b', await makePdf(2, 1))], (done) =>
      order.push(`fertig ${done}`),
    );
    expect(order).toEqual(['lesen a', 'fertig 1', 'lesen b', 'fertig 2']);
  });

  it('bricht bei einer verschlüsselten Quelle mit passendem Code ab', async () => {
    const merge = mergePdfs([from(await makePdf(1, 1)), from(fixture('passwort-zum-oeffnen.pdf'))]);
    expect(await errorCode(merge)).toBe('encrypted');
  });

  it('übernimmt keine Metadaten der Originale und schreibt keine eigenen', async () => {
    const source = await PDFDocument.create();
    source.setTitle('Geheimer Titel');
    source.setAuthor('Max Mustermann');
    source.addPage();
    const result = await mergePdfs([from(await source.save()), from(await makePdf(1, 1))]);
    const text = new TextDecoder('latin1').decode(result.bytes);
    expect(text).not.toContain('Geheimer Titel');
    expect(text).not.toContain('Mustermann');
    expect(text).not.toMatch(/\/Producer|\/Creator|pdf-lib/);
  });

  // Dokumentierte Grenze (docs/pdf-lib.md): Formular-Definitionen und Lesezeichen gehören zum
  // Dokument, nicht zur Seite, und werden beim Kopieren von Seiten nicht übernommen.
  it('übernimmt keine Formularfelder und keine Lesezeichen', async () => {
    const source = await PDFDocument.create();
    const page = source.addPage();
    source.getForm().createTextField('name').addToPage(page);
    const result = await mergePdfs([from(await source.save()), from(await makePdf(1, 1))]);
    const merged = await PDFDocument.load(result.bytes);
    expect(merged.getForm().getFields()).toHaveLength(0);
    expect(merged.catalog.get(PDFName.of('Outlines'))).toBeUndefined();
  });
});
