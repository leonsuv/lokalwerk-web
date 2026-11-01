import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import {
  bookletSheets,
  GRIDS,
  gridCells,
  imposePages,
  nUpSheets,
  placeInCell,
  sheetSize,
} from '../../../src/core/pdf/impose.ts';

describe('nUpSheets', () => {
  it('füllt Blätter der Reihe nach, der Rest bleibt leer', () => {
    expect(nUpSheets(5, 4)).toEqual([
      [0, 1, 2, 3],
      [4, null, null, null],
    ]);
    expect(nUpSheets(0, 4)).toEqual([]);
    expect(nUpSheets(4, 2)).toEqual([
      [0, 1],
      [2, 3],
    ]);
  });
});

describe('bookletSheets (Sattelheftung)', () => {
  it('8 Seiten: Blatt 1 vorn 8|1, hinten 2|7; Blatt 2 vorn 6|3, hinten 4|5', () => {
    expect(bookletSheets(8)).toEqual([
      [7, 0],
      [1, 6],
      [5, 2],
      [3, 4],
    ]);
  });

  it('füllt auf ein Vielfaches von 4 mit leeren Seiten am Ende auf', () => {
    expect(bookletSheets(5)).toEqual([
      [null, 0],
      [1, null],
      [null, 2],
      [3, 4],
    ]);
    expect(bookletSheets(1)).toEqual([
      [null, 0],
      [null, null],
    ]);
  });

  it('jede Seite kommt genau einmal vor, die Blattzahl ist Vielfaches von 2', () => {
    for (const total of [1, 2, 3, 4, 7, 12, 13, 30]) {
      const sheets = bookletSheets(total);
      const seen = sheets.flat().filter((p): p is number => p !== null);
      expect([...seen].sort((a, b) => a - b)).toEqual(Array.from({ length: total }, (_, i) => i));
      expect(sheets.length % 2).toBe(0);
    }
  });

  it('benachbarte Seiten liegen auf einem Blatt zusammen (Summe je Blatt = Seitenzahl − 1)', () => {
    const total = 16;
    for (const [a, b] of bookletSheets(total)) {
      expect((a as number) + (b as number)).toBe(total - 1);
    }
  });
});

describe('gridCells und sheetSize', () => {
  it('4 pro Blatt: vier gleich große Felder, oben links zuerst', () => {
    const cells = gridCells(GRIDS[4]!, 0, 0);
    const size = sheetSize(GRIDS[4]!);
    expect(cells).toHaveLength(4);
    expect(cells[0]).toMatchObject({ x: 0, width: size.width / 2, height: size.height / 2 });
    expect(cells[0]!.y).toBeCloseTo(size.height / 2);
    expect(cells[3]!.x).toBeCloseTo(size.width / 2);
    expect(cells[3]!.y).toBe(0);
  });

  it('Rand und Abstand verkleinern die Felder', () => {
    const [cell] = gridCells(GRIDS[2]!, 20, 10);
    const size = sheetSize(GRIDS[2]!);
    expect(cell!.width).toBeCloseTo((size.width - 40 - 10) / 2);
    expect(cell!.x).toBe(20);
  });

  it('2, 6 und 8 pro Blatt liegen im Querformat', () => {
    for (const n of [2, 6, 8])
      expect(sheetSize(GRIDS[n]!).width).toBeGreaterThan(sheetSize(GRIDS[n]!).height);
    for (const n of [4, 9])
      expect(sheetSize(GRIDS[n]!).width).toBeLessThan(sheetSize(GRIDS[n]!).height);
  });
});

describe('placeInCell', () => {
  const cell = { x: 100, y: 200, width: 300, height: 400 };
  /** Wo landet die Seitenmitte? Skalieren, drehen (gegen den Uhrzeigersinn), verschieben */
  const center = (p: ReturnType<typeof placeInCell>, w: number, h: number) => {
    const th = (p.rotate * Math.PI) / 180;
    const cx = (p.scale * w) / 2;
    const cy = (p.scale * h) / 2;
    return [
      p.x + cx * Math.cos(th) - cy * Math.sin(th),
      p.y + cx * Math.sin(th) + cy * Math.cos(th),
    ];
  };

  it.each([0, 90, 180, 270])('legt die Seitenmitte bei %i Grad in die Feldmitte', (rot) => {
    const p = placeInCell(cell, 600, 800, rot);
    const [x, y] = center(p, 600, 800);
    expect(x).toBeCloseTo(250);
    expect(y).toBeCloseTo(400);
  });

  it('wählt den Maßstab nach der angezeigten Größe', () => {
    expect(placeInCell(cell, 600, 800, 0).scale).toBeCloseTo(0.5);
    // um 90 Grad gedreht ist die Seite 800 breit und 600 hoch: Breite begrenzt
    expect(placeInCell(cell, 600, 800, 90).scale).toBeCloseTo(300 / 800);
  });
});

describe('imposePages', () => {
  async function doc(pages: number): Promise<Uint8Array> {
    const d = await PDFDocument.create();
    for (let i = 0; i < pages; i++) d.addPage([400, 600]).drawText(`Seite ${i + 1}`);
    return d.save();
  }
  const base = { grid: GRIDS[4]!, margin: 0, gap: 0, border: false };

  it('5 Seiten mit 4 pro Blatt ergeben 2 A4-Blätter', async () => {
    const out = await PDFDocument.load(
      await imposePages(await doc(5), { ...base, sheets: nUpSheets(5, 4) }),
    );
    expect(out.getPageCount()).toBe(2);
    const { width, height } = out.getPage(0).getSize();
    expect(width).toBeCloseTo(595.28, 1);
    expect(height).toBeCloseTo(841.89, 1);
  });

  it('Broschüre aus 5 Seiten: 4 Blätter im Querformat', async () => {
    const out = await PDFDocument.load(
      await imposePages(await doc(5), { ...base, grid: GRIDS[2]!, sheets: bookletSheets(5) }),
    );
    expect(out.getPageCount()).toBe(4);
    expect(out.getPage(0).getWidth()).toBeGreaterThan(out.getPage(0).getHeight());
  });

  it('meldet Fortschritt und lehnt Unbrauchbares ab', async () => {
    const seen: number[] = [];
    await imposePages(await doc(3), { ...base, sheets: nUpSheets(3, 4) }, (d) => seen.push(d));
    expect(seen).toEqual([1]);
    await expect(imposePages(new Uint8Array(0), { ...base, sheets: [] })).rejects.toMatchObject({
      code: 'empty',
    });
  });
});
