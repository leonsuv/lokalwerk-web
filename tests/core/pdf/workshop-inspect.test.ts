import { readFileSync } from 'node:fs';
import { degrees, PDFDict, PDFDocument, PDFName, PDFString } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { inspectForWorkshop } from '../../../src/core/pdf/workshop-inspect.ts';

const fixture = (name: string) =>
  new Uint8Array(readFileSync(new URL(`../../fixtures/pdf/${name}`, import.meta.url)));

describe('inspectForWorkshop', () => {
  it('liest CropBox (sonst MediaBox) und eigene Drehung je Seite', async () => {
    const doc = await PDFDocument.create({ updateMetadata: false });
    doc.addPage([600, 800]).setRotation(degrees(90));
    const cropped = doc.addPage([600, 800]);
    cropped.setCropBox(50, 50, 300, 400);
    doc.addPage([100, 200]).setRotation(degrees(-90));
    const info = await inspectForWorkshop(await doc.save());
    expect(info.pages).toEqual([
      { box: { width: 600, height: 800 }, rotate: 90 },
      { box: { width: 300, height: 400 }, rotate: 0 },
      { box: { width: 100, height: 200 }, rotate: 270 },
    ]);
    expect(info.facts).toEqual({
      form: false,
      xfa: false,
      outline: false,
      signed: false,
      metadata: false,
      pageMetadata: false,
    });
  });

  it('erkennt Formularfelder, XFA und Lesezeichen', async () => {
    const doc = await PDFDocument.create({ updateMetadata: false });
    const page = doc.addPage([200, 200]);
    doc.getForm().createTextField('name').addToPage(page);
    const acro = doc.catalog.lookup(PDFName.of('AcroForm'), PDFDict);
    acro.set(PDFName.of('XFA'), PDFString.of('<xdp/>'));
    const ctx = doc.context;
    const outlines = ctx.register(ctx.obj({ Type: 'Outlines', Count: 1 }));
    const item = ctx.register(
      ctx.obj({ Title: PDFString.of('Kapitel'), Parent: outlines, Dest: [page.ref, 'Fit'] }),
    );
    const root = ctx.lookup(outlines, PDFDict);
    root.set(PDFName.of('First'), item);
    root.set(PDFName.of('Last'), item);
    doc.catalog.set(PDFName.of('Outlines'), outlines);
    // Ohne updateFieldAppearances, sonst entfernt pdf-lib /XFA schon beim Speichern.
    const info = await inspectForWorkshop(await doc.save({ updateFieldAppearances: false }));
    expect(info.facts).toMatchObject({ form: true, xfa: true, outline: true, signed: false });
  });

  it('erkennt eine Signatur', async () => {
    const doc = await PDFDocument.create({ updateMetadata: false });
    const page = doc.addPage([200, 200]);
    const ctx = doc.context;
    const value = ctx.register(
      ctx.obj({ Type: 'Sig', ByteRange: [0, 10, 20, 30], Contents: PDFString.of('00') }),
    );
    const field = ctx.register(
      ctx.obj({
        FT: 'Sig',
        T: PDFString.of('U'),
        V: value,
        Subtype: 'Widget',
        Rect: [0, 0, 0, 0],
        P: page.ref,
      }),
    );
    page.node.set(PDFName.of('Annots'), ctx.obj([field]));
    doc.catalog.set(PDFName.of('AcroForm'), ctx.obj({ Fields: [field], SigFlags: 3 }));
    const info = await inspectForWorkshop(await doc.save({ useObjectStreams: false }));
    expect(info.facts.signed).toBe(true);
    expect(info.facts.form).toBe(true);
  });

  it('lehnt leere, verschlüsselte und kaputte Dateien ab', async () => {
    await expect(inspectForWorkshop(new Uint8Array())).rejects.toMatchObject({ code: 'empty' });
    await expect(inspectForWorkshop(fixture('passwort-zum-oeffnen.pdf'))).rejects.toMatchObject({
      code: 'encrypted',
    });
    await expect(
      inspectForWorkshop(new TextEncoder().encode('%PDF-1.7 kaputt')),
    ).rejects.toMatchObject({ code: 'damaged' });
  });

  it('erkennt versteckte Angaben im Dokument und auf Seiten (Schritt 2.4)', async () => {
    const withInfo = await PDFDocument.create({ updateMetadata: false });
    withInfo.addPage([200, 200]);
    withInfo.setAuthor('Autorin');
    expect((await inspectForWorkshop(await withInfo.save())).facts).toMatchObject({
      metadata: true,
      pageMetadata: false,
    });
    const withPage = await PDFDocument.create({ updateMetadata: false });
    withPage.addPage([200, 200]).node.set(PDFName.of('PieceInfo'), withPage.context.obj({}));
    expect((await inspectForWorkshop(await withPage.save())).facts).toMatchObject({
      metadata: false,
      pageMetadata: true,
    });
  });
});
