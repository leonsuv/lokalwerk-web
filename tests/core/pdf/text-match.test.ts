import { describe, expect, it } from 'vitest';
import {
  EMAIL_PATTERN,
  findRects,
  IBAN_PATTERN,
  itemBox,
  multiply,
  termPattern,
  type PageText,
  type PageTextItem,
} from '../../../src/core/pdf/text-match.ts';

/** Waagerechtes Textstück mit Grundlinie bei (x, y), Schrifthöhe 10, im Seitenbild y nach unten */
const item = (str: string, x: number, y: number, width = str.length * 5): PageTextItem => ({
  str,
  tx: [10, 0, 0, -10, x, y],
  width,
});
const page = (items: PageTextItem[]): PageText => ({ width: 200, height: 100, items });

describe('multiply', () => {
  it('Einheitsmatrix lässt alles unverändert', () => {
    expect(multiply([1, 0, 0, 1, 0, 0], [2, 0, 0, 3, 4, 5])).toEqual([2, 0, 0, 3, 4, 5]);
  });
  it('verschiebt nach der Skalierung', () => {
    expect(multiply([2, 0, 0, 2, 10, 20], [1, 0, 0, 1, 3, 4])).toEqual([2, 0, 0, 2, 16, 28]);
  });
});

describe('itemBox', () => {
  it('liegt bei waagerechtem Text über der Grundlinie und reicht etwas darunter', () => {
    const box = itemBox(item('Hallo', 20, 50), 0, 1);
    expect(box.x0).toBeLessThan(20);
    expect(box.x1).toBeGreaterThan(45);
    expect(box.y0).toBeLessThan(40);
    expect(box.y1).toBeGreaterThan(50);
    expect(box.y1).toBeLessThan(56);
  });

  it('teilt nach Anteil der Breite', () => {
    const half = itemBox(item('abcdefghij', 0, 50, 100), 0.5, 1);
    expect(half.x0).toBeGreaterThan(48);
    expect(half.x1).toBeGreaterThan(99);
  });

  it('funktioniert bei um 90 Grad gedrehtem Text (Schrift läuft nach unten)', () => {
    // Textrichtung (a,b) = (0, 10) nach unten, Aufwärtsrichtung (c,d) = (10, 0) nach rechts
    const turned: PageTextItem = { str: 'Hallo', tx: [0, 10, 10, 0, 30, 10], width: 25 };
    const box = itemBox(turned, 0, 1);
    expect(box.y1 - box.y0).toBeGreaterThan(24);
    expect(box.x1 - box.x0).toBeGreaterThan(12);
    expect(box.x0).toBeLessThan(30);
    expect(box.x1).toBeGreaterThan(39);
  });
});

describe('findRects', () => {
  it('findet ein Wort und liefert Anteile der Seite', () => {
    const rects = findRects(page([item('Hallo Welt', 20, 50)]), [termPattern('welt') as RegExp]);
    expect(rects).toHaveLength(1);
    const r = rects[0]!;
    expect(r.x).toBeGreaterThan(0.2);
    expect(r.x + r.w).toBeLessThan(0.6);
    expect(r.y).toBeGreaterThan(0.3);
    expect(r.y + r.h).toBeLessThan(0.7);
  });

  it('findet einen Treffer, der über zwei Textstücke geht', () => {
    const rects = findRects(page([item('Max', 20, 50), item('Mustermann', 50, 50)]), [
      termPattern('Max Mustermann') as RegExp,
    ]);
    expect(rects).toHaveLength(2);
  });

  it('findet IBAN mit Leerzeichen und ohne', () => {
    const items = [
      item('Konto: DE89 3704 0044 0532 0130 00', 10, 20),
      item('DE89370400440532013000', 10, 40),
    ];
    expect(findRects(page(items), [IBAN_PATTERN])).toHaveLength(2);
  });

  it('findet E-Mail-Adressen, aber nicht Text ohne @', () => {
    const items = [
      item('Schreib an max.muster@example.de bitte', 10, 20),
      item('kein Treffer', 10, 40),
    ];
    expect(findRects(page(items), [EMAIL_PATTERN])).toHaveLength(1);
  });

  it('meldet nichts bei Seiten ohne Text oder ohne Größe', () => {
    expect(findRects(page([]), [IBAN_PATTERN])).toEqual([]);
    expect(findRects({ width: 0, height: 0, items: [item('a', 0, 0)] }, [IBAN_PATTERN])).toEqual(
      [],
    );
  });

  it('beachtet den Rand der Seite: Rechtecke liegen immer innerhalb von 0 bis 1', () => {
    const rects = findRects(page([item('Ganz oben', 0, 2, 200)]), [termPattern('oben') as RegExp]);
    for (const r of rects) {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.x + r.w).toBeLessThanOrEqual(1.0000001);
      expect(r.y + r.h).toBeLessThanOrEqual(1.0000001);
    }
  });
});

describe('termPattern', () => {
  it('maskiert Sonderzeichen und ignoriert leere Eingaben', () => {
    expect(termPattern('   ')).toBeNull();
    const p = termPattern('a.b (c)') as RegExp;
    expect('xa.b  (c)y'.match(p)?.[0]).toBe('a.b  (c)');
    expect('aXb (c)'.match(p)).toBeNull();
  });
});

describe('Teiltreffer in einem Textstück (echte Helvetica-Breiten)', () => {
  it('deckt den gesuchten Teil immer ganz ab und ragt nur wenig darüber hinaus', async () => {
    const { PDFDocument, StandardFonts } = await import('pdf-lib');
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const size = 14;
    const cases: [string, string][] = [
      ['Rechnung für Max Mustermann', 'Max Mustermann'],
      ['Konto: DE89 3704 0044 0532 0130 00', 'DE89 3704 0044 0532 0130 00'],
      ['Mail: max.muster@example.de', 'max.muster@example.de'],
      ['Illi willi Wim 1111 mmmm', 'Wim 1111'],
      ['Ganz am Anfang steht Hallo', 'Hallo'],
    ];
    for (const [text, needle] of cases) {
      const width = font.widthOfTextAtSize(text, size);
      const at = text.indexOf(needle);
      const trueFrom = font.widthOfTextAtSize(text.slice(0, at), size);
      const trueTo = font.widthOfTextAtSize(text.slice(0, at + needle.length), size);
      const rects = findRects(
        {
          width: 1000,
          height: 100,
          items: [{ str: text, tx: [size, 0, 0, -size, 100, 50], width }],
        },
        [termPattern(needle) as RegExp],
      );
      expect(rects).toHaveLength(1);
      const r = rects[0]!;
      const left = r.x * 1000 - 100;
      const right = (r.x + r.w) * 1000 - 100;
      expect(left, `links bei „${needle}“`).toBeLessThanOrEqual(trueFrom + 0.1);
      expect(right, `rechts bei „${needle}“`).toBeGreaterThanOrEqual(trueTo - 0.1);
      // höchstens etwa ein Zeichen (ca. 10 pt) zu viel je Seite
      expect(trueFrom - left, `Überstand links bei „${needle}“`).toBeLessThan(14);
      expect(right - trueTo, `Überstand rechts bei „${needle}“`).toBeLessThan(14);
    }
  });
});
