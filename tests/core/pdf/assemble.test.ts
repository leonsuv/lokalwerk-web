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

  it('setzt Seitenzahlen auf die Endreihenfolge und ersetzt dafür auch ein unverändertes Original', async () => {
    const bytes = await labelledPdf('A', 3);
    const numbers = {
      format: 'seite-n-von-m',
      anchor: 'bottom-center',
      fromPage: 2,
      startAt: 1,
      fontSize: 10,
      marginMm: 10,
    } as const;
    const sources = new Map<string, AssembleSource>([['a', { kind: 'pdf', bytes }]]);
    const [sorted, original] = await assemblePdfs(
      [
        { name: 'um.pdf', pages: [src('a', 2), src('a', 0), src('a', 1)], numbers },
        { name: 'a.pdf', pages: [src('a', 0), src('a', 1), src('a', 2)], original: 'a', numbers },
      ],
      sources,
    );
    // Deckblatt ohne Zahl, dann „Seite 1 von 2“ und „Seite 2 von 2“ in der neuen Reihenfolge
    expect(await pageTexts(sorted?.bytes ?? new Uint8Array())).toEqual([
      'A3',
      'A1Seite 1 von 2',
      'A2Seite 2 von 2',
    ]);
    expect(original?.unchanged).toBe(false);
    expect(await pageTexts(original?.bytes ?? new Uint8Array())).toEqual([
      'A1',
      'A2Seite 1 von 2',
      'A3Seite 2 von 2',
    ]);
  });

  it('setzt Seitenzahlen auf gedrehten Seiten so, wie man die Seite liest', async () => {
    const sources = new Map<string, AssembleSource>([
      ['a', { kind: 'pdf', bytes: await labelledPdf('A', 2, [90]) }],
    ]);
    const numbers = {
      format: 'n',
      anchor: 'bottom-center',
      fromPage: 1,
      startAt: 1,
      fontSize: 10,
      marginMm: 10,
    } as const;
    // Seite 1: eigene Drehung 90; Seite 2: zusätzlich in der Werkstatt um 270 gedreht
    const [out] = await assemblePdfs(
      [{ name: 'x.pdf', pages: [src('a', 0), src('a', 1, 270)], numbers }],
      sources,
    );
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const doc = await pdfjs.getDocument({ data: out?.bytes.slice(), verbosity: 0 }).promise;
    for (const [n, label] of [
      [1, '1'],
      [2, '2'],
    ] as const) {
      const page = await doc.getPage(n);
      const viewport = page.getViewport({ scale: 1 });
      const item = (await page.getTextContent()).items.find((i) => 'str' in i && i.str === label);
      if (!item || !('transform' in item)) throw new Error(`Seitenzahl ${label} fehlt`);
      const transform = item.transform as number[];
      const [x = 0, y = 0] = viewport.convertToViewportPoint(
        transform[4] ?? 0,
        transform[5] ?? 0,
      ) as number[];
      // Unten in der Mitte der sichtbaren Seite, 10 mm über dem Rand
      expect(Math.abs(x - viewport.width / 2)).toBeLessThan(10);
      expect(viewport.height - y).toBeCloseTo((10 * 72) / 25.4, 0);
    }
    await doc.loadingTask.destroy();
  });

  it('setzt Stempel so, wie die Seite am Ende zu sehen ist, auch nach zusätzlicher Drehung', async () => {
    const sources = new Map<string, AssembleSource>([
      ['a', { kind: 'pdf', bytes: await labelledPdf('A', 2, [90]) }],
    ]);
    const stamp = { text: 'KOPIE', placement: 'top', color: 'red', opacity: 1 } as const;
    // Seite 1: eigene Drehung 90 plus 90 in der Werkstatt; Seite 2: nur 270 in der Werkstatt
    const [out] = await assemblePdfs(
      [
        {
          name: 'x.pdf',
          pages: [
            { ...src('a', 0, 90), stamp },
            { ...src('a', 1, 270), stamp },
          ],
        },
      ],
      sources,
    );
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const doc = await pdfjs.getDocument({ data: out?.bytes.slice(), verbosity: 0 }).promise;
    for (const n of [1, 2]) {
      const page = await doc.getPage(n);
      const viewport = page.getViewport({ scale: 1 });
      const item = (await page.getTextContent()).items.find((i) => 'str' in i && i.str === 'KOPIE');
      if (!item || !('transform' in item)) throw new Error(`Stempel auf Seite ${n} fehlt`);
      const transform = item.transform as number[];
      const [x = 0, y = 0] = viewport.convertToViewportPoint(
        transform[4] ?? 0,
        transform[5] ?? 0,
      ) as number[];
      // Oben, 12 mm unter dem sichtbaren Rand (Grundlinie plus Versalhöhe), mittig
      expect(y, `Seite ${n}`).toBeLessThan(80);
      expect(Math.abs(x + (item as { width: number }).width / 2 - viewport.width / 2)).toBeLessThan(
        15,
      );
    }
    await doc.loadingTask.destroy();
  });

  it('setzt Unterschriften aufrecht in der Ansicht, in der sie gesetzt wurden; gleiches Bild nur einmal', async () => {
    const sources = new Map<string, AssembleSource>([
      ['a', { kind: 'pdf', bytes: await labelledPdf('A', 2) }],
    ]);
    const rect = { x: 0.1, y: 0.1, w: 0.2, h: 0.05 };
    const signature = { id: 'g1', png: PNG_1X1, rect, turn: 0 };
    const [out] = await assemblePdfs(
      [
        {
          name: 'x.pdf',
          pages: [
            // Gesetzt, als die Seite um 90 Grad gedreht angezeigt wurde; so ist sie auch jetzt
            { ...src('a', 0, 90), signatures: [{ ...signature, turn: 90 }] },
            // Ohne Drehung gesetzt, danach um 90 Grad gedreht: dreht sich mit dem Inhalt
            {
              ...src('a', 1, 90),
              signatures: [signature, { ...signature, rect: { x: 0.5, y: 0.5, w: 0.1, h: 0.1 } }],
            },
          ],
        },
      ],
      sources,
    );
    const bytes = out?.bytes ?? new Uint8Array();
    expect((await pageInfo(bytes)).map((p) => p.rotate)).toEqual([90, 90]);
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const doc = await pdfjs.getDocument({ data: bytes.slice(), verbosity: 0 }).promise;
    /** Lage des Bilds in der Ansicht (Einheitsquadrat durch die Matrix), in Anteilen der Seite */
    const shown = async (n: number) => {
      const page = await doc.getPage(n);
      const viewport = page.getViewport({ scale: 1 });
      const ops = await page.getOperatorList();
      const stack: number[][] = [];
      let m = [1, 0, 0, 1, 0, 0];
      const mul = (a: number[], b: number[]) => [
        a[0]! * b[0]! + a[2]! * b[1]!,
        a[1]! * b[0]! + a[3]! * b[1]!,
        a[0]! * b[2]! + a[2]! * b[3]!,
        a[1]! * b[2]! + a[3]! * b[3]!,
        a[0]! * b[4]! + a[2]! * b[5]! + a[4]!,
        a[1]! * b[4]! + a[3]! * b[5]! + a[5]!,
      ];
      const boxes: { x: number; y: number; w: number; h: number; upright: boolean }[] = [];
      for (const [i, fn] of ops.fnArray.entries()) {
        const args = ops.argsArray[i] as unknown[];
        if (fn === pdfjs.OPS.save) stack.push(m);
        else if (fn === pdfjs.OPS.restore) m = stack.pop() ?? m;
        else if (fn === pdfjs.OPS.transform) m = mul(m, args as number[]);
        else if (fn === pdfjs.OPS.paintImageXObject) {
          const v = mul(viewport.transform, m);
          const pts = [
            [0, 0],
            [1, 0],
            [0, 1],
            [1, 1],
          ].map(([x, y]) => [v[0]! * x! + v[2]! * y! + v[4]!, v[1]! * x! + v[3]! * y! + v[5]!]);
          const xs = pts.map((p) => p[0]!);
          const ys = pts.map((p) => p[1]!);
          boxes.push({
            x: Math.min(...xs) / viewport.width,
            y: Math.min(...ys) / viewport.height,
            w: (Math.max(...xs) - Math.min(...xs)) / viewport.width,
            h: (Math.max(...ys) - Math.min(...ys)) / viewport.height,
            // Aufrecht: Bild-x läuft nach rechts, Bild-y nach oben (Canvas: y nach unten)
            upright: v[0]! > 0 && v[3]! < 0,
          });
        }
      }
      return boxes;
    };
    const [first] = await shown(1);
    expect(first?.upright).toBe(true);
    for (const k of ['x', 'y', 'w', 'h'] as const) expect(first?.[k], k).toBeCloseTo(rect[k], 5);
    const second = await shown(2);
    expect(second).toHaveLength(2);
    // Mit dem Inhalt gedreht: nicht mehr aufrecht, Lage wie das gedrehte Rechteck
    expect(second[0]?.upright).toBe(false);
    const turned = { x: 1 - rect.y - rect.h, y: rect.x, w: rect.h, h: rect.w };
    for (const k of ['x', 'y', 'w', 'h'] as const)
      expect(second[0]?.[k], k).toBeCloseTo(turned[k], 5);
    await doc.loadingTask.destroy();
    const pdf = await PDFDocument.load(bytes);
    const images = pdf.context
      .enumerateIndirectObjects()
      .flatMap(([, obj]) => ('dict' in obj ? [(obj as { dict: PDFDict }).dict] : []))
      .filter((dict) => dict.get(PDFName.of('Subtype')) === PDFName.of('Image'));
    // PNG mit Transparenz: Bild plus SMask, trotz drei Unterschriften nur einmal
    expect(images).toHaveLength(2);
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

describe('assemblePdfs: versteckte Angaben entfernen (Werkstatt, Schritt 2.4)', () => {
  it('ohne Metadaten der Seiten, geprüft wie im Werkzeug „PDF-Metadaten entfernen“', async () => {
    const { inspectPdf } = await import('../../../src/core/pdf/metadata.ts');
    const doc = await PDFDocument.create({ updateMetadata: false });
    doc.setAuthor('Autorin Geheim');
    const page = doc.addPage([200, 200]);
    page.node.set(PDFName.of('PieceInfo'), doc.context.obj({ App: { Private: 'x' } }));
    page.node.set(PDFName.of('LastModified'), doc.context.obj('D:20260101'));
    const bytes = await doc.save();
    const sources = new Map([['a', { kind: 'pdf' as const, bytes }]]);
    const page0 = { kind: 'source' as const, source: 'a', index: 0, rotate: 0 as const };
    const [kept] = await assemblePdfs([{ name: 'k.pdf', pages: [page0] }], sources);
    const [clean] = await assemblePdfs([{ name: 'c.pdf', pages: [page0], strip: true }], sources);
    const before = await inspectPdf(kept?.bytes ?? new Uint8Array());
    expect(before.pagesWithMetadata).toBe(1);
    // Angaben des Dokuments fallen beim Neuzusammensetzen ohnehin weg
    expect(before.info).toEqual([]);
    const after = await inspectPdf(clean?.bytes ?? new Uint8Array());
    expect(after).toMatchObject({
      info: [],
      xmpBytes: null,
      attachments: 0,
      pagesWithMetadata: 0,
      earlierVersions: 0,
    });
  });
});
