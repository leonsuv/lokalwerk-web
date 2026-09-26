import { PDFDocument, StandardFonts } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { fitFontSize, MIN_FONT_SIZE, MM_TO_PT } from '../../../src/core/labels/fit.ts';
import {
  checkSheet,
  labelRect,
  pageCount,
  PAGE,
  presetSheet,
  PRESETS,
  type SheetSpec,
} from '../../../src/core/labels/layout.ts';
import { emptyPlan, guessPlan, labelLines } from '../../../src/core/labels/lines.ts';
import { prepareLabels } from '../../../src/core/labels/prepare.ts';
import { buildLabelsPdf } from '../../../src/core/pdf/labels.ts';

const sheet38 = presetSheet(
  PRESETS[0] ?? { id: '', columns: 3, rows: 8, labelWidth: 70, labelHeight: 37 },
);

async function helvetica() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  return {
    width: (t: string) => font.widthOfTextAtSize(t, 1),
    charset: new Set(font.getCharacterSet()),
  };
}

describe('Bogen (layout)', () => {
  it('jede Voreinstellung passt auf A4 und liegt mittig', () => {
    for (const p of PRESETS) {
      const s = presetSheet(p);
      expect(checkSheet(s), p.id).toBeNull();
      const last = labelRect(s, p.columns * p.rows - 1);
      expect(last.x + last.width + s.marginLeft).toBeCloseTo(PAGE.width, 1);
      expect(last.y + last.height + s.marginTop).toBeCloseTo(PAGE.height, 1);
    }
  });

  it('3 × 8 mit 70 × 37 mm: 0,5 mm Rand oben, Etikett 5 in der Mitte der zweiten Reihe', () => {
    expect(sheet38.marginTop).toBe(0.5);
    expect(sheet38.marginLeft).toBe(0);
    expect(labelRect(sheet38, 4)).toEqual({ x: 70, y: 37.5, width: 70, height: 37 });
    // Zweites Blatt beginnt wieder oben links
    expect(labelRect(sheet38, 24)).toEqual(labelRect(sheet38, 0));
  });

  it('Abstände zwischen den Etiketten', () => {
    const s: SheetSpec = {
      ...sheet38,
      columns: 3,
      rows: 7,
      labelWidth: 63.5,
      labelHeight: 38.1,
      marginLeft: 7.2,
      marginTop: 15.1,
      gapX: 2.5,
      gapY: 0,
    };
    expect(checkSheet(s)).toBeNull();
    expect(labelRect(s, 2).x).toBeCloseTo(7.2 + 2 * (63.5 + 2.5), 6);
  });

  it('meldet Bögen, die nicht auf das Blatt passen, und unsinnige Werte', () => {
    expect(checkSheet({ ...sheet38, marginLeft: 1 })).toBe('too-wide');
    expect(checkSheet({ ...sheet38, marginTop: 2 })).toBe('too-tall');
    expect(checkSheet({ ...sheet38, columns: 0 })).toBe('invalid');
    expect(checkSheet({ ...sheet38, labelWidth: Number.NaN })).toBe('invalid');
    expect(checkSheet({ ...sheet38, gapX: -1 })).toBe('invalid');
  });

  it('Blätter mit Startplatz', () => {
    expect(pageCount(sheet38, 0, 1)).toBe(0);
    expect(pageCount(sheet38, 24, 1)).toBe(1);
    expect(pageCount(sheet38, 24, 2)).toBe(2);
    expect(pageCount(sheet38, 1, 24)).toBe(1);
  });
});

describe('Zeilen aus Spalten (lines)', () => {
  it('rät eine übliche Adressliste', () => {
    const headers = ['Nr', 'Vorname', 'Nachname', 'Straße', 'Hausnummer', 'PLZ', 'Ort', 'E-Mail'];
    const plan = guessPlan(headers);
    expect(plan.slice(0, 3)).toEqual([
      [1, 2, -1],
      [3, 4, -1],
      [5, 6, -1],
    ]);
    const row = ['7', 'Erika', 'Mustermann', 'Heidestraße', '17', '51147', 'Köln', 'x@example.org'];
    expect(labelLines(row, plan)).toEqual(['Erika Mustermann', 'Heidestraße 17', '51147 Köln']);
  });

  it('E-Mail-Adresse ist keine Anschrift', () => {
    const plan = guessPlan(['Name', 'E-Mail-Adresse', 'Adresse', 'PLZ', 'Ort']);
    expect(plan[1]).toEqual([2, -1, -1]);
  });

  it('Firma zuerst, leere Angaben fallen weg, Leerraum wird zusammengefasst', () => {
    const plan = guessPlan(['Firma', 'Name', 'Anschrift', 'PLZ', 'Ort', 'Land']);
    expect(labelLines(['', ' Max   Muster ', 'Weg 1', '12345', 'Berlin', ''], plan)).toEqual([
      'Max Muster',
      'Weg 1',
      '12345 Berlin',
    ]);
  });

  it('ohne erkennbare Überschriften die ersten Spalten untereinander', () => {
    const plan = guessPlan(['A', 'B']);
    expect(plan[0]?.[0]).toBe(0);
    expect(plan[1]?.[0]).toBe(1);
    expect(labelLines(['x', 'y'], emptyPlan())).toEqual([]);
  });
});

describe('Schriftgröße einpassen (fit)', () => {
  const width = (t: string) => t.length * 0.5;
  it('behält die Wunschgröße, wenn alles passt', () => {
    expect(fitFontSize(['abc'], width, { width: 100, height: 100 }, 10)).toBe(10);
  });

  it('verkleinert in halben Punkt nach Breite und Höhe', () => {
    // 20 Zeichen × 0,5 = 10 pt bei Größe 1; 85 pt Breite → 8,5
    expect(fitFontSize(['x'.repeat(20)], width, { width: 85, height: 100 }, 10)).toBe(8.5);
    // 5 Zeilen: Höhe 4 × 1,2 + 1 = 5,8 bei Größe 1; 40 pt → 6,89 → 6,5
    expect(fitFontSize(['a', 'b', 'c', 'd', 'e'], width, { width: 100, height: 40 }, 10)).toBe(6.5);
  });

  it('null, wenn selbst die kleinste Größe nicht reicht', () => {
    expect(
      fitFontSize(['x'.repeat(100)], width, { width: MIN_FONT_SIZE * 49, height: 100 }, 10),
    ).toBeNull();
  });
});

describe('prepareLabels', () => {
  it('markiert Zeichen außerhalb von WinAnsi und zu lange Zeilen, zählt leere', async () => {
    const { width, charset } = await helvetica();
    const plan = guessPlan(['Name', 'Straße', 'PLZ', 'Ort']);
    const rows = [
      ['Erika Mustermann', 'Heidestraße 17', '51147', 'Köln'],
      ['Łukasz Nowak', 'ul. Długa 5', '00-001', 'Warszawa'],
      ['', '', '', ''],
      ['X'.repeat(200), 'Weg 1', '12345', 'Ort'],
    ];
    const result = prepareLabels(
      rows,
      { plan, sheet: sheet38, padding: 4, fontSize: 10 },
      width,
      charset,
    );
    expect(result.labels).toHaveLength(1);
    expect(result.labels[0]).toEqual({
      lines: ['Erika Mustermann', 'Heidestraße 17', '51147 Köln'],
      size: 10,
    });
    expect(result.empty).toBe(1);
    expect(result.problems).toEqual([
      { line: 3, reason: 'charset', chars: ['Ł', 'ł'] },
      { line: 5, reason: 'too-long' },
    ]);
  });
});

describe('buildLabelsPdf', () => {
  /** Texte mit Lage in mm (Ursprung oben links), wie pdf.js sie liest */
  async function textPositions(bytes: Uint8Array) {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const doc = await pdfjs.getDocument({ data: bytes.slice(), verbosity: 0 }).promise;
    const pages = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const height = page.view[3] ?? 0;
      const items = (await page.getTextContent()).items.flatMap((item) =>
        'str' in item
          ? [
              {
                str: item.str,
                x: item.transform[4] / MM_TO_PT,
                y: (height - item.transform[5]) / MM_TO_PT,
              },
            ]
          : [],
      );
      pages.push(items);
    }
    await doc.loadingTask.destroy();
    return pages;
  }

  const labels = Array.from({ length: 26 }, (_, i) => ({
    lines: [`Name ${i + 1}`, 'Weg 1', '12345 Ort'],
    size: 10,
  }));

  it('setzt jedes Etikett in sein Feld, ab dem gewählten Startplatz, ohne Metadaten', async () => {
    const bytes = await buildLabelsPdf({
      sheet: sheet38,
      labels,
      start: 3,
      padding: 4,
      test: false,
    });
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    expect(doc.getPageCount()).toBe(2);
    expect(doc.getPage(0).getSize().width / MM_TO_PT).toBeCloseTo(210, 1);
    expect(doc.getProducer()).toBeUndefined();
    const [first, second] = await textPositions(bytes);
    // Name 1 auf Platz 3 (oben rechts): Feld x 140–210, y 0,5–37,5
    const name1 = first?.find((t) => t.str === 'Name 1');
    expect(name1?.x).toBeCloseTo(144, 1);
    expect(name1?.y).toBeGreaterThan(0.5 + 4);
    expect(name1?.y).toBeLessThan(37.5 - 4);
    expect(first?.filter((t) => t.str.startsWith('Name'))).toHaveLength(22);
    // Name 23 beginnt das zweite Blatt oben links
    expect(second?.find((t) => t.str === 'Name 23')?.x).toBeCloseTo(4, 1);
  });

  it('Probedruck: erstes Blatt mit Rahmen, dazu die Messlinie', async () => {
    const bytes = await buildLabelsPdf({
      sheet: sheet38,
      labels,
      start: 1,
      padding: 4,
      test: true,
    });
    const pages = await textPositions(bytes);
    expect(pages).toHaveLength(2);
    expect(pages[0]?.filter((t) => t.str.startsWith('Name'))).toHaveLength(24);
    expect(pages[1]?.map((t) => t.str).join(' ')).toContain('genau 100 mm');
  });
});
