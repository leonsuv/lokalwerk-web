import { readFileSync } from 'node:fs';
import { PDFArray, PDFDict, PDFDocument, PDFName } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { buildRasterPdf } from '../../../src/core/pdf/redact.ts';
import { allBytes, containsSecret, extractText, original, SECRETS } from './secrets.ts';

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
