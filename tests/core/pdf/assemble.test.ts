import { readFileSync } from 'node:fs';
import { degrees, PDFDict, PDFDocument, PDFName, StandardFonts } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import {
  assemblePdfs,
  type AssemblePage,
  type AssembleSource,
} from '../../../src/core/pdf/assemble.ts';
import { A4 } from '../../../src/core/pdf/image-layout.ts';

const fixture = (name: string) =>
  new Uint8Array(readFileSync(new URL(`../../fixtures/pdf/${name}`, import.meta.url)));

/** PDF, deren Seiten ihren Namen als Text tragen („A1“, „A2“ …); eine Schrift für alle Seiten */
async function labelledPdf(prefix: string, count: number, rotate: number[] = []) {
  const doc = await PDFDocument.create({ updateMetadata: false });
  doc.setTitle(`Titel ${prefix}`);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < count; i++) {
    const page = doc.addPage([300 + i * 10, 400]);
    page.drawText(`${prefix}${i + 1}`, { x: 20, y: 200, size: 24, font });
    const turn = rotate[i];
    if (turn) page.setRotation(degrees(turn));
  }
  return doc.save();
}

/** Kleinste gültige PNG-Datei: 1 × 1 Pixel (wie in from-images.test.ts) */
const PNG_1X1 = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  ),
  (c) => c.charCodeAt(0),
);

/** Text jeder Seite, mit pdf.js zurückgelesen */
async function pageTexts(bytes: Uint8Array): Promise<string[]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: bytes.slice(), verbosity: 0 }).promise;
  const texts: string[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const content = await (await doc.getPage(n)).getTextContent();
    texts.push(content.items.map((item) => ('str' in item ? item.str : '')).join(''));
  }
  await doc.loadingTask.destroy();
  return texts;
}

async function pageInfo(bytes: Uint8Array) {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  return doc.getPages().map((p) => ({
    width: Math.round(p.getWidth()),
    height: Math.round(p.getHeight()),
    rotate: p.getRotation().angle,
  }));
}

const src = (id: string, index: number, rotate = 0): AssemblePage => ({
  kind: 'source',
  source: id,
  index,
  rotate,
});

describe('assemblePdfs', () => {
  it('mischt Seiten aus mehreren Quellen mit Drehung und Leerseite', async () => {
    const sources = new Map<string, AssembleSource>([
      ['a', { kind: 'pdf', bytes: await labelledPdf('A', 3, [0, 0, 90]) }],
      ['b', { kind: 'pdf', bytes: await labelledPdf('B', 2) }],
    ]);
    const [out] = await assemblePdfs(
      [
        {
          name: 'x.pdf',
          pages: [
            src('b', 1),
            src('a', 0, 90),
            { kind: 'blank', width: 200, height: 100, rotate: 270 },
            src('a', 2, 90),
            src('b', 1),
          ],
        },
      ],
      sources,
    );
    if (!out) throw new Error('kein Ergebnis');
    expect(out.unchanged).toBe(false);
    expect(await pageTexts(out.bytes)).toEqual(['B2', 'A1', '', 'A3', 'B2']);
    expect(await pageInfo(out.bytes)).toEqual([
      { width: 310, height: 400, rotate: 0 },
      { width: 300, height: 400, rotate: 90 },
      { width: 200, height: 100, rotate: 270 },
      // Eigene Drehung 90 plus zusätzliche 90
      { width: 320, height: 400, rotate: 180 },
      { width: 310, height: 400, rotate: 0 },
    ]);
  });

  it('setzt mehrere Dokumente und übernimmt gemeinsame Schriften nur einmal', async () => {
    const sources = new Map<string, AssembleSource>([
      ['a', { kind: 'pdf', bytes: await labelledPdf('A', 3) }],
    ]);
    const results = await assemblePdfs(
      [
        { name: 'eins.pdf', pages: [src('a', 2), src('a', 1), src('a', 0)] },
        { name: 'zwei.pdf', pages: [src('a', 1)] },
      ],
      sources,
    );
    expect(results.map((r) => r.name)).toEqual(['eins.pdf', 'zwei.pdf']);
    expect(await pageTexts(results[0]?.bytes ?? new Uint8Array())).toEqual(['A3', 'A2', 'A1']);
    expect(await pageTexts(results[1]?.bytes ?? new Uint8Array())).toEqual(['A2']);
    const doc = await PDFDocument.load(results[0]?.bytes ?? new Uint8Array());
    const fonts = doc.context
      .enumerateIndirectObjects()
      .filter(
        ([, obj]) => obj instanceof PDFDict && obj.get(PDFName.of('Type')) === PDFName.of('Font'),
      );
    expect(fonts).toHaveLength(1);
  });

  it('setzt Bilder als DIN-A4-Seite mit 1 cm Rand, auch gedreht', async () => {
    const sources = new Map<string, AssembleSource>([
      ['i', { kind: 'image', image: { bytes: PNG_1X1, type: 'image/png', width: 1, height: 1 } }],
    ]);
    const [out] = await assemblePdfs(
      [{ name: 'bild.pdf', pages: [src('i', 0), src('i', 0, 90)] }],
      sources,
    );
    const info = await pageInfo(out?.bytes ?? new Uint8Array());
    expect(info).toEqual([
      { width: Math.round(A4.width), height: Math.round(A4.height), rotate: 0 },
      { width: Math.round(A4.width), height: Math.round(A4.height), rotate: 90 },
    ]);
    const doc = await PDFDocument.load(out?.bytes ?? new Uint8Array());
    // Das PNG hat Transparenz: ein Bild plus seine SMask (ebenfalls /Subtype /Image).
    const images = doc.context
      .enumerateIndirectObjects()
      .flatMap(([, obj]) => ('dict' in obj ? [(obj as { dict: PDFDict }).dict] : []))
      .filter((dict) => dict.get(PDFName.of('Subtype')) === PDFName.of('Image'));
    expect(images.filter((dict) => dict.has(PDFName.of('SMask')))).toHaveLength(1);
    expect(images).toHaveLength(2);
  });

  it('gibt ein unverändertes Dokument als Originaldatei aus (W12)', async () => {
    const bytes = await labelledPdf('A', 2);
    const [out] = await assemblePdfs(
      [{ name: 'a.pdf', pages: [src('a', 0), src('a', 1)], original: 'a' }],
      new Map([['a', { kind: 'pdf', bytes }]]),
    );
    expect(out?.unchanged).toBe(true);
    expect(out?.bytes).toBe(bytes);
  });

  it('schreibt keine Metadaten, auch nicht die der Quellen', async () => {
    const [out] = await assemblePdfs(
      [{ name: 'a.pdf', pages: [src('a', 0)] }],
      new Map([['a', { kind: 'pdf', bytes: await labelledPdf('A', 1) }]]),
    );
    const doc = await PDFDocument.load(out?.bytes ?? new Uint8Array(), { updateMetadata: false });
    expect(doc.getTitle()).toBeUndefined();
    expect(doc.getProducer()).toBeUndefined();
    expect(doc.catalog.has(PDFName.of('Metadata'))).toBe(false);
  });

  it('meldet den Fortschritt je Dokument in Seiten', async () => {
    const sources = new Map<string, AssembleSource>([
      ['a', { kind: 'pdf', bytes: await labelledPdf('A', 3) }],
    ]);
    const calls: [number, number][] = [];
    await assemblePdfs(
      [
        { name: '1', pages: [src('a', 0), src('a', 1)] },
        { name: '2', pages: [src('a', 2)] },
      ],
      sources,
      (done, total) => calls.push([done, total]),
    );
    expect(calls).toEqual([
      [2, 3],
      [3, 3],
    ]);
  });

  it('lehnt leere Dokumente, falsche Verweise und kaputte oder verschlüsselte Quellen ab', async () => {
    const pdf = new Map<string, AssembleSource>([
      ['a', { kind: 'pdf', bytes: await labelledPdf('A', 1) }],
      ['i', { kind: 'image', image: { bytes: PNG_1X1, type: 'image/png', width: 1, height: 1 } }],
      ['enc', { kind: 'pdf', bytes: fixture('passwort-zum-oeffnen.pdf') }],
      ['leer', { kind: 'pdf', bytes: new Uint8Array() }],
      ['kaputt', { kind: 'pdf', bytes: new TextEncoder().encode('%PDF-1.7 kaputt') }],
    ]);
    const one = (...pages: AssemblePage[]) => assemblePdfs([{ name: 'x', pages }], pdf);
    await expect(one()).rejects.toMatchObject({ code: 'no-pages' });
    await expect(one(src('a', 1))).rejects.toThrow(RangeError);
    await expect(one(src('a', -1))).rejects.toThrow(RangeError);
    await expect(one(src('a', 0.5))).rejects.toThrow(RangeError);
    await expect(one(src('i', 1))).rejects.toThrow(RangeError);
    await expect(one(src('fehlt', 0))).rejects.toThrow(RangeError);
    await expect(one(src('enc', 0))).rejects.toMatchObject({ code: 'encrypted' });
    await expect(one(src('leer', 0))).rejects.toMatchObject({ code: 'empty' });
    await expect(one(src('kaputt', 0))).rejects.toMatchObject({ code: 'damaged' });
    await expect(
      assemblePdfs([{ name: 'x', pages: [src('i', 0)], original: 'i' }], pdf),
    ).rejects.toThrow(RangeError);
  });
});
