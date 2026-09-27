/**
 * Prüfhilfen „nichts vom Original“ für Schwärzen (Einzelwerkzeug und PDF-Werkstatt): ein
 * Original voller Geheimnisse und die Suche danach in Text, Objekten und entpackten Strömen.
 */

import { inflateSync } from 'node:zlib';
import { PDFDocument, PDFRawStream, StandardFonts } from 'pdf-lib';

export const SECRETS = [
  'DE89 3704 0044 0532 0130 00',
  'Max Mustermann',
  'Vertraulicher Titel',
  'Autorin Geheim',
  'Feldinhalt geheim',
  'Anhang geheim',
];

/** Original mit Text, Metadaten, Formularfeld und Dateianhang; weitere Seiten mit dem Namen */
export async function original(pages = 1): Promise<Uint8Array> {
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
  for (let n = 2; n <= pages; n++) {
    doc
      .addPage([595, 842])
      .drawText(`Seite ${n}: Max Mustermann`, { x: 50, y: 700, size: 14, font });
  }
  await doc.attach(new TextEncoder().encode('Anhang geheim'), 'anhang.txt', {
    mimeType: 'text/plain',
  });
  return doc.save({ useObjectStreams: false });
}

/** Alle Texte aus einer PDF mit pdf.js, wie ein PDF-Programm sie zum Kopieren anbietet */
export async function extractText(bytes: Uint8Array): Promise<string> {
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
export async function allBytes(bytes: Uint8Array): Promise<Buffer[]> {
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
export function containsSecret(chunks: Buffer[], secret: string): boolean {
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
