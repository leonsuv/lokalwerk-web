import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { PDFDocument, PDFName, PDFRawStream, PDFString } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import {
  addPageNumbers,
  addStamp,
  diagonalFontSize,
  inspectForStamp,
  pageNumberText,
  standardFontCharset,
  unsupportedChars,
} from '../../../src/core/pdf/stamp.ts';

const fixture = (name: string) =>
  new Uint8Array(readFileSync(new URL(`../../fixtures/pdf/${name}`, import.meta.url)));

async function makePdf(pages: number, rotate = 0): Promise<Uint8Array> {
  const doc = await PDFDocument.create({ updateMetadata: false });
  doc.setTitle('Bleibt erhalten');
  for (let i = 0; i < pages; i++) {
    const page = doc.addPage([595, 842]);
    if (rotate) page.node.set(PDFName.of('Rotate'), doc.context.obj(rotate));
  }
  return doc.save({ useObjectStreams: false });
}

/** PDF mit Signaturfeld und Signaturwert wie nach dem Signieren (vereinfacht) */
async function signedPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create({ updateMetadata: false });
  const page = doc.addPage([200, 200]);
  const ctx = doc.context;
  const sigValue = ctx.obj({
    Type: 'Sig',
    Filter: 'Adobe.PPKLite',
    SubFilter: 'adbe.pkcs7.detached',
    ByteRange: [0, 10, 20, 30],
    Contents: PDFString.of('00'),
  });
  const field = ctx.obj({
    FT: 'Sig',
    T: PDFString.of('Unterschrift'),
    V: ctx.register(sigValue),
    Type: 'Annot',
    Subtype: 'Widget',
    Rect: [0, 0, 0, 0],
    P: page.ref,
  });
  const fieldRef = ctx.register(field);
  page.node.set(PDFName.of('Annots'), ctx.obj([fieldRef]));
  doc.catalog.set(PDFName.of('AcroForm'), ctx.obj({ Fields: [fieldRef], SigFlags: 3 }));
  return doc.save({ useObjectStreams: false });
}

describe('WinAnsi (E8a)', () => {
  it('meldet Zeichen, die Helvetica nicht kann, jedes einmal', async () => {
    const charset = new Set(await standardFontCharset());
    expect(unsupportedChars('Entwurf – Kopie für Straße, 12 € ÄÖÜ', charset)).toEqual([]);
    // ó gibt es in WinAnsi, Ł und ź nicht
    expect(unsupportedChars('Łódź Łódź ✓ 😀', charset)).toEqual(['Ł', 'ź', '✓', '😀']);
  });
});

describe('pageNumberText', () => {
  it.each([
    ['n', '3'],
    ['seite-n', 'Seite 3'],
    ['seite-n-von-m', 'Seite 3 von 12'],
    ['n-von-m', '3 / 12'],
    ['strich', '– 3 –'],
  ] as const)('%s → %s', (format, text) => {
    expect(pageNumberText(format, 3, 12)).toBe(text);
  });
});

describe('inspectForStamp', () => {
  it('erkennt signierte PDFs', async () => {
    expect(await inspectForStamp(await signedPdf())).toEqual({ pages: 1, signed: true });
    expect(await inspectForStamp(await makePdf(2))).toEqual({ pages: 2, signed: false });
    expect((await inspectForStamp(fixture('coregraphics-2-seiten.pdf'))).signed).toBe(false);
  });

  it('lehnt verschlüsselte PDFs ab', async () => {
    await expect(inspectForStamp(fixture('passwort-zum-oeffnen.pdf'))).rejects.toMatchObject({
      code: 'encrypted',
    });
  });
});

/** Seiteninhalt als Text, Flate-Ströme entpackt */
async function contentOf(bytes: Uint8Array, page: number): Promise<string> {
  const doc = await PDFDocument.load(bytes);
  const contents = doc.getPage(page).node.Contents();
  const streams =
    contents && 'asArray' in contents ? contents.asArray() : contents ? [contents] : [];
  return streams
    .map((s) => {
      const stream = doc.context.lookup(s);
      if (!(stream instanceof PDFRawStream)) return '';
      const raw = stream.getContents();
      // FlateDecode (zlib): mit 0x78 am Anfang
      return new TextDecoder('latin1').decode(raw[0] === 0x78 ? inflateSync(raw) : raw);
    })
    .join('\n');
}

describe('addPageNumbers', () => {
  it('nummeriert ab der gewählten Seite und behält Metadaten', async () => {
    const out = await addPageNumbers(await makePdf(3), {
      format: 'seite-n-von-m',
      anchor: 'bottom-center',
      fromPage: 2,
      startAt: 1,
      fontSize: 10,
      marginMm: 10,
    });
    const doc = await PDFDocument.load(out);
    expect(doc.getPageCount()).toBe(3);
    expect(doc.getTitle()).toBe('Bleibt erhalten');
    // pdf-lib schreibt Text als Hex-Glyphen; Seite 1 hat keinen Text, Seite 2 und 3 schon
    expect(await contentOf(out, 0)).not.toMatch(/Tj/);
    expect(await contentOf(out, 1)).toMatch(/Tj/);
  });
});

describe('addStamp', () => {
  it('stempelt nur die gewählten Seiten, halbtransparent', async () => {
    const out = await addStamp(await makePdf(3, 90), {
      text: 'ENTWURF',
      placement: 'diagonal',
      color: 'red',
      opacity: 0.3,
      pages: [{ from: 2, to: 3 }],
    });
    expect(await contentOf(out, 0)).not.toMatch(/Tj/);
    const page2 = await contentOf(out, 1);
    expect(page2).toMatch(/Tj/);
    expect(page2).toMatch(/\/GS-?\d+ gs|gs/);
  });

  it('Schriftgröße für die Diagonale bleibt in Grenzen', () => {
    expect(diagonalFontSize(1000, 5)).toBe(140);
    expect(diagonalFontSize(1000, 1)).toBe(150);
    expect(diagonalFontSize(100, 50)).toBe(12);
  });
});
