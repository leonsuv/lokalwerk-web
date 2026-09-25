import { readFileSync } from 'node:fs';
import { PDFDocument, PDFName, PDFString } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import {
  countEarlierVersions,
  formatPdfDate,
  inspectPdf,
  stripPdfMetadata,
} from '../../../src/core/pdf/metadata.ts';

const fixture = (name: string) =>
  new Uint8Array(readFileSync(new URL(`../../fixtures/pdf/${name}`, import.meta.url)));

/** PDF mit allem, was das Werkzeug finden soll. */
async function richPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create({ updateMetadata: false });
  doc.setTitle('Kündigung Wohnung');
  doc.setAuthor('Anna Beispiel');
  doc.setSubject('Privat');
  doc.setKeywords(['Miete', 'Vertrag']);
  doc.setCreator('Textprogramm 12');
  doc.setProducer('PDF-Drucker 3');
  doc.setCreationDate(new Date(Date.UTC(2026, 8, 25, 12, 30)));
  const ctx = doc.context;
  const info = ctx.lookup(ctx.trailerInfo.Info);
  if (info && 'set' in info) {
    (info as { set(k: PDFName, v: PDFString): void }).set(
      PDFName.of('Firma'),
      PDFString.of('Muster GmbH'),
    );
  }

  const page = doc.addPage([200, 200]);
  doc.addPage([200, 200]);
  // XMP des Dokuments
  const xmp = ctx.stream('<x:xmpmeta xmlns:x="adobe:ns:meta/">Anna</x:xmpmeta>', {
    Type: 'Metadata',
    Subtype: 'XML',
  });
  doc.catalog.set(PDFName.of('Metadata'), ctx.register(xmp));
  // eigene Metadaten der Seite
  page.node.set(PDFName.of('PieceInfo'), ctx.obj({ Programm: { Private: 'x' } }));
  page.node.set(PDFName.of('Metadata'), ctx.register(ctx.stream('Seiten-XMP')));
  // Kommentar mit Verfasser, dazu ein Verweis (zählt nicht als Kommentar)
  const note = ctx.obj({
    Type: 'Annot',
    Subtype: 'Text',
    Rect: [10, 10, 30, 30],
    T: PDFString.of('Anna Beispiel'),
    Contents: PDFString.of('Bitte prüfen'),
  });
  const link = ctx.obj({ Type: 'Annot', Subtype: 'Link', Rect: [40, 40, 60, 60] });
  page.node.set(PDFName.of('Annots'), ctx.obj([ctx.register(note), ctx.register(link)]));
  await doc.attach(new TextEncoder().encode('geheim'), 'notizen.txt', {
    mimeType: 'text/plain',
  });
  doc.addJavaScript('hallo', 'app.alert("Hallo")');
  doc.getForm().createTextField('name').addToPage(page, { x: 10, y: 100 });
  return doc.save();
}

describe('formatPdfDate (ISO 32000-2, 7.9.4)', () => {
  it.each([
    ["D:20260925143015+02'00'", '25.09.2026 14:30'],
    ['D:20260925', '25.09.2026'],
    ['D:2026', '01.01.2026'],
    ['D:199812231952-08', '23.12.1998 19:52'],
    ['kein Datum', null],
  ])('%s → %s', (raw, text) => {
    expect(formatPdfDate(raw)).toBe(text);
  });
});

describe('countEarlierVersions', () => {
  const pdf = (body: string) => new TextEncoder().encode(body);
  it('zählt Abschlüsse nach dem ersten als frühere Fassungen', () => {
    expect(countEarlierVersions(pdf('%PDF-1.7\n…\n%%EOF\n'))).toBe(0);
    expect(countEarlierVersions(pdf('%PDF-1.7\n…\n%%EOF\n…\n%%EOF\n…\n%%EOF\n'))).toBe(2);
  });
  it('zieht bei linearisierten PDFs den zusätzlichen Abschluss am Anfang ab', () => {
    expect(
      countEarlierVersions(pdf('%PDF-1.7\n1 0 obj <</Linearized 1>>\n%%EOF\n…\n%%EOF\n')),
    ).toBe(0);
  });
});

describe('inspectPdf', () => {
  it('findet Angaben, XMP, Anhänge, Kommentare, Formulare, JavaScript und Seiten-Metadaten', async () => {
    const result = await inspectPdf(await richPdf());
    expect(result.pages).toBe(2);
    expect(result.version).toMatch(/^\d\.\d$/);
    expect(result.info).toEqual(
      expect.arrayContaining([
        { key: 'Title', value: 'Kündigung Wohnung' },
        { key: 'Author', value: 'Anna Beispiel' },
        { key: 'Subject', value: 'Privat' },
        { key: 'Keywords', value: 'Miete Vertrag' },
        { key: 'Creator', value: 'Textprogramm 12' },
        { key: 'Producer', value: 'PDF-Drucker 3' },
        { key: 'CreationDate', value: '25.09.2026 12:30' },
        { key: 'Firma', value: 'Muster GmbH' },
      ]),
    );
    expect(result.xmpBytes).toBeGreaterThan(0);
    expect(result.attachments).toBe(1);
    expect(result.comments).toBe(1);
    expect(result.formFields).toBe(1);
    expect(result.javascript).toBe(true);
    expect(result.pagesWithMetadata).toBe(1);
    expect(result.earlierVersions).toBe(0);
  });

  it('findet in einer schlichten PDF nichts davon', async () => {
    const doc = await PDFDocument.create({ updateMetadata: false });
    doc.addPage();
    const result = await inspectPdf(await doc.save());
    expect(result).toMatchObject({
      info: [],
      xmpBytes: null,
      attachments: 0,
      comments: 0,
      formFields: 0,
      bookmarks: false,
      javascript: false,
      pagesWithMetadata: 0,
    });
  });

  it('liest die Angaben einer mit macOS erzeugten PDF', async () => {
    const result = await inspectPdf(fixture('coregraphics-2-seiten.pdf'));
    expect(result.pages).toBe(2);
    expect(result.info.some((e) => e.key === 'Producer')).toBe(true);
  });
});

describe('stripPdfMetadata', () => {
  it('entfernt alles außer Seiten und Kommentaren, und die Prüfung findet danach nichts', async () => {
    const original = await richPdf();
    const stripped = await stripPdfMetadata(original);
    const result = await inspectPdf(stripped);
    expect(result).toMatchObject({
      pages: 2,
      info: [],
      xmpBytes: null,
      attachments: 0,
      formFields: 0,
      javascript: false,
      pagesWithMetadata: 0,
      earlierVersions: 0,
    });
    // Kommentare bleiben (so steht es auch auf der Seite)
    expect(result.comments).toBe(1);
    const text = new TextDecoder('latin1').decode(stripped);
    for (const secret of ['Kündigung', 'Muster GmbH', 'Textprogramm', 'notizen.txt', 'app.alert'])
      expect(text).not.toContain(secret);
    expect(text).not.toMatch(/pdf-lib/i);
  });
});
