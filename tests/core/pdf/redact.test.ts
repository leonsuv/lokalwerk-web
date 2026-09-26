import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRawStream, StandardFonts } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { buildRasterPdf } from '../../../src/core/pdf/redact.ts';

const SECRETS = [
  'DE89 3704 0044 0532 0130 00',
  'Max Mustermann',
  'Vertraulicher Titel',
  'Autorin Geheim',
  'Feldinhalt geheim',
  'Anhang geheim',
];

/** Original mit Text, Metadaten, Formularfeld und Dateianhang */
async function original(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle('Vertraulicher Titel');
  doc.setAuthor('Autorin Geheim');
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText('IBAN: DE89 3704 0044 0532 0130 00', { x: 50, y: 700, size: 14, font });
  page.drawText('Name: Max Mustermann', { x: 50, y: 670, size: 14, font });
  const field = doc.getForm().createTextField('kontakt');
  field.setText('Feldinhalt geheim');
  field.addToPage(page, { x: 50, y: 600, width: 200, height: 20 });
  await doc.attach(new TextEncoder().encode('Anhang geheim'), 'anhang.txt', {
    mimeType: 'text/plain',
  });
  return doc.save({ useObjectStreams: false });
}

/** Alle Texte aus einer PDF mit pdf.js, wie ein PDF-Programm sie zum Kopieren anbietet */
async function extractText(bytes: Uint8Array): Promise<string> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: bytes.slice(), verbosity: 0 }).promise;
  const parts: string[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const content = await (await doc.getPage(n)).getTextContent();
    for (const item of content.items) if ('str' in item) parts.push(item.str);
  }
  await doc.loadingTask.destroy();
  return parts.join(' ');
}

/** Rohdaten der Datei, alle Objekte und alle entpackten Ströme */
async function allBytes(bytes: Uint8Array): Promise<Buffer[]> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const chunks = [Buffer.from(bytes)];
  for (const [, object] of doc.context.enumerateIndirectObjects()) {
    // Auch Objekte aus komprimierten Objektströmen, so wie pdf-lib sie gelesen hat
    chunks.push(Buffer.from(object.toString(), 'latin1'));
    if (!(object instanceof PDFRawStream)) continue;
    const raw = Buffer.from(object.getContents());
    chunks.push(raw);
    try {
      chunks.push(inflateSync(raw));
    } catch {
      // kein Flate-Strom (z. B. das JPEG)
    }
  }
  return chunks;
}

/**
 * Steckt `secret` irgendwo drin? Als Latin-1 oder UTF-16 (PDF-Textstrings), jeweils auch als
 * Hex-Folge, wie pdf-lib Text auf die Seite schreibt (<4D6178…> Tj) und Info-Werte ablegt.
 */
function containsSecret(chunks: Buffer[], secret: string): boolean {
  const encoded = [
    Buffer.from(secret, 'latin1'),
    Buffer.from(secret, 'utf16le'),
    Buffer.from(secret, 'utf16le').swap16(),
  ];
  const forms = encoded.flatMap((b) => [
    b,
    Buffer.from(b.toString('hex'), 'latin1'),
    Buffer.from(b.toString('hex').toUpperCase(), 'latin1'),
  ]);
  return chunks.some((c) => forms.some((f) => c.includes(f)));
}

describe('buildRasterPdf (Schwärzen, Leon 25.09.2026: nichts vom Original übernehmen)', () => {
  const jpeg = new Uint8Array(
    readFileSync(new URL('../../fixtures/images/ohne-metadaten.jpg', import.meta.url)),
  );

  it('Gegenprobe: im Original stecken die Geheimnisse und sind auffindbar', async () => {
    const bytes = await original();
    const text = await extractText(bytes);
    expect(text).toContain('DE89 3704 0044 0532 0130 00');
    expect(text).toContain('Max Mustermann');
    const chunks = await allBytes(bytes);
    for (const secret of SECRETS) expect(containsSecret(chunks, secret), secret).toBe(true);
  });

  it('im Ergebnis steckt kein Text und nichts aus dem Original', async () => {
    // Die Funktion bekommt die Original-PDF gar nicht; hier nur die gerasterte Seite.
    const out = await buildRasterPdf([{ jpeg, width: 595, height: 842 }]);
    expect((await extractText(out)).trim()).toBe('');
    const chunks = await allBytes(out);
    for (const secret of SECRETS) expect(containsSecret(chunks, secret), secret).toBe(false);
  });

  it('das Ergebnis besteht nur aus Seiten mit je einem Bild', async () => {
    const out = await buildRasterPdf([
      { jpeg, width: 595, height: 842 },
      { jpeg, width: 842, height: 595 },
    ]);
    const doc = await PDFDocument.load(out, { updateMetadata: false });
    expect(doc.getPages().map((p) => [p.getWidth(), p.getHeight(), p.getRotation().angle])).toEqual(
      [
        [595, 842, 0],
        [842, 595, 0],
      ],
    );
    for (const key of ['AcroForm', 'Names', 'Outlines', 'Metadata', 'OCProperties']) {
      expect(doc.catalog.has(PDFName.of(key)), key).toBe(false);
    }
    for (const page of doc.getPages()) {
      // pdf-lib legt leere /Annots, /Font und /ExtGState an; sie müssen leer bleiben.
      const annots = page.node.lookup(PDFName.of('Annots'));
      expect(annots instanceof PDFArray ? annots.size() : 0).toBe(0);
      const resources = page.node.Resources();
      for (const key of resources?.keys() ?? []) {
        const entry = resources?.lookup(key);
        const size = entry instanceof PDFDict ? entry.keys().length : -1;
        expect(size, key.toString()).toBe(key.toString() === '/XObject' ? 1 : 0);
      }
    }
    expect(doc.context.trailerInfo.Info).toBeUndefined();
    expect(doc.getTitle()).toBeUndefined();
    expect(doc.getAuthor()).toBeUndefined();
    expect(doc.getProducer()).toBeUndefined();
  });

  it('lehnt eine leere Seitenliste ab', async () => {
    await expect(buildRasterPdf([])).rejects.toMatchObject({ code: 'no-pages' });
  });
});
