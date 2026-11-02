import { inflateSync } from 'node:zlib';
import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFRawStream,
  PDFRef,
  PDFString,
} from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import {
  AttachmentError,
  editAttachments,
  listAttachments,
} from '../../../src/core/pdf/attachments.ts';
import { sumAttachmentSizes } from '../../../src/core/pdf/attachment-totals.ts';
import { PdfError } from '../../../src/core/pdf/merge.ts';

const enc = (text: string) => new TextEncoder().encode(text);

/** PDF mit einer Seite und den angegebenen Anhängen (Name, Inhalt) */
async function withAttachments(files: [string, string][]): Promise<Uint8Array> {
  const doc = await PDFDocument.create({ updateMetadata: false });
  doc.addPage([200, 200]);
  for (const [name, text] of files) {
    await doc.attach(enc(text), name, { mimeType: 'text/plain' });
  }
  return doc.save();
}

/** Dateianhänge in der Reihenfolge des (flachen) Namensbaums: Name und unkomprimierter Inhalt */
async function flatFiles(bytes: Uint8Array): Promise<{ name: string; data: string }[]> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const names = doc.catalog.lookup(PDFName.of('Names'));
  if (!(names instanceof PDFDict)) return [];
  const ef = names.lookup(PDFName.of('EmbeddedFiles'));
  if (!(ef instanceof PDFDict)) return [];
  const leaves = ef.lookup(PDFName.of('Names'));
  if (!(leaves instanceof PDFArray)) return [];
  const out: { name: string; data: string }[] = [];
  for (let i = 0; i + 1 < leaves.size(); i += 2) {
    const key = doc.context.lookup(leaves.get(i));
    const spec = doc.context.lookup(leaves.get(i + 1));
    if (!(key instanceof PDFHexString) || !(spec instanceof PDFDict)) continue;
    const fileStream = doc.context.lookup(
      (spec.lookup(PDFName.of('EF')) as PDFDict).get(PDFName.of('F')),
    );
    if (!(fileStream instanceof PDFRawStream)) continue;
    // pdf-lib komprimiert neue Anhänge mit Flate, vorhandene bleiben, wie sie waren
    const raw = fileStream.contents;
    const plain =
      fileStream.dict.get(PDFName.of('Filter')) === PDFName.of('FlateDecode')
        ? inflateSync(raw)
        : raw;
    out.push({ name: key.decodeText(), data: new TextDecoder().decode(plain) });
  }
  return out;
}

describe('listAttachments', () => {
  it('liefert bei einer PDF ohne Anhänge eine leere Liste', async () => {
    const doc = await PDFDocument.create({ updateMetadata: false });
    doc.addPage();
    expect(await listAttachments(await doc.save())).toEqual([]);
  });

  it('liest Name, Größe und Reihenfolge der Anhänge', async () => {
    const bytes = await withAttachments([
      ['erster.txt', 'Hallo'],
      ['zweiter.csv', 'a;b\n1;2'],
    ]);
    expect(await listAttachments(bytes)).toEqual([
      { index: 0, name: 'erster.txt', size: 5, readable: true },
      { index: 1, name: 'zweiter.csv', size: 7, readable: true },
    ]);
  });

  it('findet Anhänge auch in einem verschachtelten Namensbaum (Kids)', async () => {
    const bytes = await withAttachments([
      ['a.txt', 'A'],
      ['b.txt', 'BB'],
    ]);
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    const names = doc.catalog.lookup(PDFName.of('Names')) as PDFDict;
    const ef = names.lookup(PDFName.of('EmbeddedFiles')) as PDFDict;
    const leaves = ef.get(PDFName.of('Names')) as PDFArray;
    const child = doc.context.register(doc.context.obj({ Names: leaves }));
    ef.delete(PDFName.of('Names'));
    ef.set(PDFName.of('Kids'), doc.context.obj([child]));
    const list = await listAttachments(await doc.save());
    expect(list.map((a) => a.name)).toEqual(['a.txt', 'b.txt']);
  });

  it('meldet Einträge ohne lesbaren Inhalt als nicht lesbar', async () => {
    const bytes = await withAttachments([['gut.txt', 'Inhalt']]);
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    const names = doc.catalog.lookup(PDFName.of('Names')) as PDFDict;
    const ef = names.lookup(PDFName.of('EmbeddedFiles')) as PDFDict;
    const leaves = ef.get(PDFName.of('Names')) as PDFArray;
    leaves.push(PDFString.of('kaputt.bin'));
    leaves.push(doc.context.obj({ Type: 'Filespec', F: PDFString.of('kaputt.bin') }));
    const list = await listAttachments(await doc.save());
    expect(list[1]).toEqual({ index: 1, name: 'kaputt.bin', size: null, readable: false });
    expect(list[0]?.readable).toBe(true);
  });

  it('wirft PdfError für leere und beschädigte Dateien', async () => {
    await expect(listAttachments(new Uint8Array())).rejects.toBeInstanceOf(PdfError);
    await expect(listAttachments(enc('kein pdf'))).rejects.toBeInstanceOf(PdfError);
  });
});

describe('editAttachments', () => {
  it('entfernt einen Anhang und lässt den anderen byte-genau stehen', async () => {
    const bytes = await withAttachments([
      ['weg.txt', 'Dieser Inhalt verschwindet'],
      ['bleibt.txt', 'Dieser Inhalt bleibt'],
    ]);
    const before = await flatFiles(bytes);
    const out = await editAttachments(bytes, { remove: new Set([0]), add: [] });

    expect(await listAttachments(out)).toEqual([
      { index: 0, name: 'bleibt.txt', size: 20, readable: true },
    ]);
    expect(await flatFiles(out)).toEqual([before[1]]);

    // Der entfernte Dateistrom ist nicht mehr in der Datei: nur noch ein Dateistrom
    const doc = await PDFDocument.load(out, { updateMetadata: false });
    const streams = doc.context
      .enumerateIndirectObjects()
      .filter(
        ([, obj]) =>
          obj instanceof PDFRawStream &&
          obj.dict.get(PDFName.of('Type')) === PDFName.of('EmbeddedFile'),
      );
    expect(streams).toHaveLength(1);
  });

  it('entfernt Verweise aus /AF und aus Dateianhang-Anmerkungen', async () => {
    const bytes = await withAttachments([
      ['a.txt', 'A'],
      ['b.txt', 'B'],
    ]);
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    const names = doc.catalog.lookup(PDFName.of('Names')) as PDFDict;
    const ef = names.lookup(PDFName.of('EmbeddedFiles')) as PDFDict;
    const leaves = ef.get(PDFName.of('Names')) as PDFArray;
    const specA = leaves.get(1) as PDFRef;
    const page = doc.getPage(0);
    page.node.set(
      PDFName.of('Annots'),
      doc.context.obj([
        doc.context.register(
          doc.context.obj({
            Type: 'Annot',
            Subtype: 'FileAttachment',
            Rect: [10, 10, 30, 30],
            FS: specA,
          }),
        ),
      ]),
    );
    const withAnnot = await doc.save();

    const out = await editAttachments(withAnnot, { remove: new Set([0]), add: [] });
    const check = await PDFDocument.load(out, { updateMetadata: false });
    const af = check.catalog.lookup(PDFName.of('AF')) as PDFArray;
    expect(af.size()).toBe(1);
    const annots = check.getPage(0).node.Annots();
    expect(annots?.size() ?? 0).toBe(0);
  });

  it('entfernt auch einen nicht lesbaren Eintrag', async () => {
    const bytes = await withAttachments([['gut.txt', 'Inhalt']]);
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    const names = doc.catalog.lookup(PDFName.of('Names')) as PDFDict;
    const ef = names.lookup(PDFName.of('EmbeddedFiles')) as PDFDict;
    const leaves = ef.get(PDFName.of('Names')) as PDFArray;
    leaves.push(PDFString.of('kaputt.bin'));
    leaves.push(doc.context.obj({ Type: 'Filespec', F: PDFString.of('kaputt.bin') }));
    const out = await editAttachments(await doc.save(), { remove: new Set([1]), add: [] });
    expect((await listAttachments(out)).map((a) => a.name)).toEqual(['gut.txt']);
  });

  it('hängt neue Dateien an und nennt Größe und Typ', async () => {
    const bytes = await withAttachments([['alt.txt', 'Alt']]);
    const neu = enc('%PDF-1.4 neu');
    const out = await editAttachments(bytes, {
      remove: new Set(),
      add: [{ name: 'neu.pdf', bytes: neu, mimeType: 'application/pdf' }],
    });
    const list = await listAttachments(out);
    expect(list.map((a) => [a.name, a.size])).toEqual([
      ['alt.txt', 3],
      ['neu.pdf', neu.length],
    ]);
    const files = await flatFiles(out);
    expect(files[1]).toEqual({ name: 'neu.pdf', data: '%PDF-1.4 neu' });
  });

  it('legt die Anhänge in einer PDF ohne Anhänge an', async () => {
    const doc = await PDFDocument.create({ updateMetadata: false });
    doc.addPage();
    const out = await editAttachments(await doc.save(), {
      remove: new Set(),
      add: [{ name: 'hallo.txt', bytes: enc('hallo') }],
    });
    expect(await listAttachments(out)).toEqual([
      { index: 0, name: 'hallo.txt', size: 5, readable: true },
    ]);
  });

  it('erlaubt einen neuen Anhang mit dem Namen eines entfernten', async () => {
    const bytes = await withAttachments([['bericht.txt', 'alt']]);
    const out = await editAttachments(bytes, {
      remove: new Set([0]),
      add: [{ name: 'bericht.txt', bytes: enc('neu') }],
    });
    expect(await flatFiles(out)).toEqual([{ name: 'bericht.txt', data: 'neu' }]);
  });

  it('lehnt einen Namen ab, der schon verwendet wird', async () => {
    const bytes = await withAttachments([['bericht.txt', 'alt']]);
    await expect(
      editAttachments(bytes, {
        remove: new Set(),
        add: [{ name: 'bericht.txt', bytes: enc('x') }],
      }),
    ).rejects.toMatchObject({ code: 'duplicate-name' });
    await expect(
      editAttachments(bytes, {
        remove: new Set(),
        add: [
          { name: 'neu.txt', bytes: enc('x') },
          { name: 'neu.txt', bytes: enc('y') },
        ],
      }),
    ).rejects.toBeInstanceOf(AttachmentError);
  });

  it('ohne Änderungen bleibt der Inhalt erhalten', async () => {
    const bytes = await withAttachments([
      ['a.txt', 'Eins'],
      ['b.txt', 'Zwei'],
    ]);
    const out = await editAttachments(bytes, { remove: new Set(), add: [] });
    expect(await flatFiles(out)).toEqual(await flatFiles(bytes));
  });
});

describe('sumAttachmentSizes', () => {
  it('summiert die bekannten Größen', () => {
    expect(sumAttachmentSizes([3, null, 4])).toBe(7);
    expect(sumAttachmentSizes([])).toBe(0);
    expect(sumAttachmentSizes([null])).toBe(0);
  });
});
