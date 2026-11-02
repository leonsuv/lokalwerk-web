import { PDFDocument, StandardFonts } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import {
  assembleRebuilt,
  latin1,
  readPageTree,
  RepairError,
  repairPdf,
  scanObjects,
  toBytes,
  valueOf,
} from '../../../src/core/pdf/repair.ts';
import { PdfError } from '../../../src/core/pdf/merge.ts';

/** Gültige Testdatei mit `pages` Seiten; Seite n ist n·100 Punkte breit */
async function fixture(pages = 3): Promise<Uint8Array> {
  const doc = await PDFDocument.create({ updateMetadata: false });
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= pages; i++) {
    const page = doc.addPage([i * 100, 400]);
    page.drawText(`Seite ${i}`, { x: 20, y: 200, font, size: 24 });
  }
  return doc.save({ useObjectStreams: false });
}

async function sizes(bytes: Uint8Array): Promise<number[]> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  return doc.getPages().map((p) => Math.round(p.getWidth()));
}

const text = (bytes: Uint8Array): string => latin1(bytes);
const fromText = (s: string): Uint8Array => toBytes(s);

/** Byteposition des Objekts mit dieser Nummer (erster Treffer) */
function objectSpan(bytes: Uint8Array, num: number): { start: number; end: number } {
  const objects = scanObjects(text(bytes));
  const obj = objects.get(num);
  if (!obj) throw new Error(`Objekt ${num} fehlt im Test`);
  return obj;
}

/** Eine Datei ohne das Objekt `num` (der Text bleibt sonst gleich) */
function withoutObject(bytes: Uint8Array, num: number): Uint8Array {
  const s = text(bytes);
  const { start, end } = objectSpan(bytes, num);
  return fromText(s.slice(0, start) + s.slice(end));
}

/** Nummer des n-ten Seitenobjekts (Typ /Page, nicht /Pages), in Dateireihenfolge */
function pageObjectNum(bytes: Uint8Array, n: number): number {
  const pages = [...scanObjects(text(bytes)).values()]
    .filter((o) => /\/Type\s*\/Page(?!s)/.test(text(bytes).slice(o.start, o.end)))
    .sort((a, b) => a.start - b.start);
  const hit = pages[n - 1];
  if (!hit) throw new Error('Seite fehlt im Test');
  return hit.num;
}

describe('scanObjects', () => {
  it('findet vollständige Objekte und merkt sich die letzte Fassung', () => {
    const s =
      '1 0 obj\n<< /A 1 >>\nendobj\n2 0 obj\n<< /A 2 >>\nendobj\n2 0 obj\n<< /A 3 >>\nendobj';
    const objects = scanObjects(s);
    expect([...objects.keys()].sort()).toEqual([1, 2]);
    expect(s.slice(objects.get(2)?.start, objects.get(2)?.end)).toContain('/A 3');
  });

  it('überspringt ein abgeschnittenes Objekt, das kein endobj mehr hat', () => {
    const s = '1 0 obj\n<< /A 1 >>\nendobj\n2 0 obj\n<< /Type /Page /Cont';
    expect([...scanObjects(s).keys()]).toEqual([1]);
  });

  it('überspringt ein Objekt, bei dem vor dem endobj schon das nächste Objekt beginnt', () => {
    const s = '1 0 obj\n<< /A 1 \n2 0 obj\n<< /A 2 >>\nendobj';
    expect([...scanObjects(s).keys()]).toEqual([2]);
  });
});

describe('valueOf', () => {
  it('liest Zahl, Referenz, Feld und Wörterbuch', () => {
    const d = '<< /Count 3 /Parent 4 0 R /MediaBox [0 0 300 400] /Resources << /Font 5 0 R >> >>';
    expect(valueOf(d, 'Count')).toBe('3');
    expect(valueOf(d, 'Parent')).toBe('4 0 R');
    expect(valueOf(d, 'MediaBox')).toBe('[0 0 300 400]');
    expect(valueOf(d, 'Resources')).toBe('<< /Font 5 0 R >>');
    expect(valueOf(d, 'Kids')).toBeNull();
  });
});

describe('readPageTree', () => {
  it('liest Seitenzahl und Seiten in Reihenfolge', async () => {
    const bytes = await fixture(3);
    const s = text(bytes);
    const tree = readPageTree(s, scanObjects(s));
    expect(tree.claimed).toBe(3);
    expect(tree.slots.every((slot) => slot !== null)).toBe(true);
  });
});

describe('repairPdf: Schäden, die pdf-lib selbst verträgt', () => {
  it('gültige Datei bleibt vollständig', async () => {
    const result = await repairPdf(await fixture(3));
    expect(result.readable).toBe(3);
    expect(result.before).toBe(3);
    expect(result.lost).toEqual([]);
    expect(result.rebuilt).toBe(false);
    expect(await sizes(result.bytes)).toEqual([100, 200, 300]);
  });

  it('kaputte Xref-Tabelle und falscher startxref-Wert', async () => {
    const s = text(await fixture(3));
    const bad = fromText(s.replace(/startxref\s+\d+/, 'startxref 99999'));
    const result = await repairPdf(bad);
    expect(result.readable).toBe(3);
    expect(await sizes(result.bytes)).toEqual([100, 200, 300]);
  });

  it('kaputte Xref-Einträge', async () => {
    const s = text(await fixture(3));
    const bad = fromText(s.replace(/\d{10} 00000 n/g, '0000000042 00000 n'));
    const result = await repairPdf(bad);
    expect(result.readable).toBe(3);
  });

  it('fehlender Trailer', async () => {
    const s = text(await fixture(3));
    const bad = fromText(s.replace(/trailer[\s\S]*$/, '%%EOF\n'));
    const result = await repairPdf(bad);
    expect(result.readable).toBe(3);
    expect(await sizes(result.bytes)).toEqual([100, 200, 300]);
  });
});

describe('repairPdf: Rettung aus den Objekten', () => {
  it('fehlender Dateikopf: pdf-lib öffnet nicht, die Seiten werden gerettet', async () => {
    const s = text(await fixture(3)).replace(/^%PDF-[\d.]+/, 'XXXX');
    const result = await repairPdf(fromText(s));
    expect(result.before).toBeNull();
    expect(result.rebuilt).toBe(true);
    expect(result.readable).toBe(3);
    expect(await sizes(result.bytes)).toEqual([100, 200, 300]);
  });

  it('defekter Katalog: Seitenbaum wird über den Wurzelknoten gefunden', async () => {
    const s = text(await fixture(3)).replace(/\/Type\s*\/Catalog/, '/Type /Catlog');
    const result = await repairPdf(fromText(s));
    expect(result.rebuilt).toBe(true);
    expect(result.readable).toBe(3);
  });

  it('Seite fehlt im Seitenbaum: die übrigen bleiben, die Lücke wird gemeldet', async () => {
    const bytes = await fixture(3);
    const cut = withoutObject(bytes, pageObjectNum(bytes, 2));
    const result = await repairPdf(cut);
    expect(result.readable).toBe(2);
    expect(result.lost).toEqual([2]);
    expect(result.claimed).toBe(3);
    expect(await sizes(result.bytes)).toEqual([100, 300]);
  });

  it('fehlender Seiteninhalt: die Seite fehlt im Ergebnis und wird nicht leer ersetzt', async () => {
    const bytes = await fixture(3);
    const contents = [...text(bytes).matchAll(/\/Contents\s*\[\s*(\d+)/g)].map((m) => Number(m[1]));
    const result = await repairPdf(withoutObject(bytes, contents[1] ?? -1));
    expect(result.readable).toBe(2);
    expect(result.lost).toEqual([2]);
    expect(await sizes(result.bytes)).toEqual([100, 300]);
  });

  it('übernimmt geerbte MediaBox aus dem Seitenbaum', async () => {
    const s = text(await fixture(2));
    // MediaBox aus den Seiten nehmen und dem Seitenbaum geben, dann Kopf kaputt machen
    const inherited = s
      .replace(/\/MediaBox\s*\[[^\]]*\]\s*/g, '')
      .replace(/\/Type\s*\/Pages\b/, '/Type /Pages /MediaBox [0 0 250 250]')
      .replace(/^%PDF-[\d.]+/, 'XXXX');
    const result = await repairPdf(fromText(inherited));
    expect(result.readable).toBe(2);
    expect(await sizes(result.bytes)).toEqual([250, 250]);
  });

  it('verschlüsselte Datei wird abgelehnt, auch wenn der Kopf fehlt', async () => {
    const s = text(await fixture(2)).replace(/^%PDF-[\d.]+/, 'XXXX');
    const enc = s.replace('trailer\n<<', 'trailer\n<< /Encrypt 99 0 R');
    await expect(repairPdf(fromText(enc))).rejects.toMatchObject({ code: 'encrypted' });
  });
});

describe('repairPdf: nicht zu retten', () => {
  it('abgeschnittene Datei am Anfang: keine Seite lesbar', async () => {
    const bytes = await fixture(3);
    await expect(repairPdf(bytes.slice(0, 120))).rejects.toBeInstanceOf(RepairError);
  });

  it('keine PDF, nur Text', async () => {
    await expect(repairPdf(toBytes('Das ist keine PDF.'))).rejects.toMatchObject({
      code: 'nothing-readable',
    });
  });

  it('leere Datei', async () => {
    await expect(repairPdf(new Uint8Array(0))).rejects.toBeInstanceOf(PdfError);
  });

  it('Seitenbaum ohne Wurzel, alle Seitenknoten kaputt', async () => {
    const s = text(await fixture(2)).replace(/\/Type\s*\/Pages\b/g, '/Type /Pagez');
    await expect(repairPdf(fromText(s))).rejects.toBeInstanceOf(RepairError);
  });
});

describe('assembleRebuilt', () => {
  it('ergibt eine Datei, die pdf-lib mit der angegebenen Seitenzahl öffnet', async () => {
    const s = text(await fixture(2));
    const objects = scanObjects(s);
    const tree = readPageTree(s, objects);
    const leaves = tree.slots.filter((x) => x !== null);
    const out = assembleRebuilt(s, objects, leaves);
    const doc = await PDFDocument.load(toBytes(out), { updateMetadata: false });
    expect(doc.getPageCount()).toBe(2);
    expect(out.startsWith('%PDF-1.7')).toBe(true);
    expect(out.endsWith('%%EOF\n')).toBe(true);
  });
});
