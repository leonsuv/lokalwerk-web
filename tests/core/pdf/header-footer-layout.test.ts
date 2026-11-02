import { PDFDocument, StandardFonts } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import {
  anchorFor,
  expandPlaceholders,
  type HeaderFooterOptions,
  isEmptyHeaderFooter,
  isSelectedPage,
  placeTexts,
  selectPages,
  textsForPage,
  unsupportedInOptions,
  WINANSI_CHARSET,
} from '../../../src/core/pdf/header-footer-layout.ts';
import { MM } from '../../../src/core/pdf/stamp-layout.ts';

const EMPTY_ROW = { left: '', center: '', right: '' };

function options(over: Partial<HeaderFooterOptions> = {}): HeaderFooterOptions {
  return {
    texts: { header: { ...EMPTY_ROW }, footer: { ...EMPTY_ROW } },
    number: null,
    fontSize: 10,
    marginMm: 10,
    pages: null,
    ...over,
  };
}

describe('expandPlaceholders', () => {
  it('setzt Seitenzahl und Gesamtzahl ein', () => {
    expect(expandPlaceholders('Seite {n} von {N}', 2, 5)).toBe('Seite 2 von 5');
  });

  it('ersetzt jedes Vorkommen', () => {
    expect(expandPlaceholders('{n}/{n} ({N})', 1, 3)).toBe('1/1 (3)');
  });

  it('lässt unbekannte Platzhalter und Text ohne Platzhalter stehen', () => {
    expect(expandPlaceholders('{x} Entwurf', 1, 1)).toBe('{x} Entwurf');
    expect(expandPlaceholders('Vertrag', 4, 9)).toBe('Vertrag');
  });

  it('unterscheidet Groß- und Kleinschreibung', () => {
    expect(expandPlaceholders('{N} {n}', 2, 7)).toBe('7 2');
  });
});

describe('anchorFor', () => {
  it('Kopfzeile oben, Fußzeile unten, Stelle links, Mitte oder rechts', () => {
    expect(anchorFor('header', 'left')).toBe('top-left');
    expect(anchorFor('header', 'center')).toBe('top-center');
    expect(anchorFor('header', 'right')).toBe('top-right');
    expect(anchorFor('footer', 'left')).toBe('bottom-left');
    expect(anchorFor('footer', 'center')).toBe('bottom-center');
    expect(anchorFor('footer', 'right')).toBe('bottom-right');
  });
});

describe('textsForPage', () => {
  it('lässt leere Felder weg und kürzt Leerzeichen am Rand', () => {
    const o = options({
      texts: { header: { left: '  Firma  ', center: '   ', right: '' }, footer: EMPTY_ROW },
    });
    expect(textsForPage(o, 0, 3)).toEqual([{ row: 'header', slot: 'left', text: 'Firma' }]);
  });

  it('setzt die Seitenzahl mit der Vorlage für jede Seite', () => {
    const o = options({
      number: { row: 'footer', slot: 'center', format: 'Seite {n} von {N}' },
    });
    expect(textsForPage(o, 0, 3)).toEqual([
      { row: 'footer', slot: 'center', text: 'Seite 1 von 3' },
    ]);
    expect(textsForPage(o, 2, 3)).toEqual([
      { row: 'footer', slot: 'center', text: 'Seite 3 von 3' },
    ]);
  });

  it('ohne Seitenzahl oder mit leerer Vorlage kommt keine Zahl', () => {
    expect(textsForPage(options(), 0, 1)).toEqual([]);
    const blank = options({ number: { row: 'header', slot: 'right', format: '  ' } });
    expect(textsForPage(blank, 0, 1)).toEqual([]);
  });

  it('Texte und Seitenzahl kommen in der Reihenfolge Kopf, Fuß, Zahl', () => {
    const o = options({
      texts: {
        header: { left: 'A', center: '', right: 'B' },
        footer: { left: 'C', center: '', right: '' },
      },
      number: { row: 'footer', slot: 'right', format: '{n}' },
    });
    expect(textsForPage(o, 0, 1).map((t) => t.text)).toEqual(['A', 'B', 'C', '1']);
  });
});

describe('isEmptyHeaderFooter', () => {
  it('leer ist, wenn kein Text und keine Seitenzahl da ist', () => {
    expect(isEmptyHeaderFooter(options())).toBe(true);
    expect(
      isEmptyHeaderFooter(
        options({ texts: { header: { left: ' ', center: '', right: '' }, footer: EMPTY_ROW } }),
      ),
    ).toBe(true);
  });

  it('ein Text oder eine Seitenzahl reicht', () => {
    expect(
      isEmptyHeaderFooter(
        options({ texts: { header: { ...EMPTY_ROW, left: 'x' }, footer: EMPTY_ROW } }),
      ),
    ).toBe(false);
    expect(
      isEmptyHeaderFooter(options({ number: { row: 'footer', slot: 'left', format: '{n}' } })),
    ).toBe(false);
  });
});

describe('selectPages', () => {
  it('leere Eingabe heißt alle Seiten', () => {
    expect(selectPages('', 5)).toEqual({ ok: true, pages: null });
    expect(selectPages('   ', 5)).toEqual({ ok: true, pages: null });
  });

  it('Seiten zählen ab 1 und kommen als Index ab 0', () => {
    expect(selectPages('2-3, 5', 5)).toEqual({ ok: true, pages: [1, 2, 4] });
    expect(selectPages('4', 5)).toEqual({ ok: true, pages: [3] });
  });

  it('meldet Seiten außerhalb des Dokuments, Tippfehler und falsche Reihenfolge', () => {
    expect(selectPages('6', 5)).toEqual({
      ok: false,
      error: { code: 'out-of-range', part: '6', pages: 5 },
    });
    expect(selectPages('a', 5)).toEqual({ ok: false, error: { code: 'syntax', part: 'a' } });
    expect(selectPages('3-1', 5)).toEqual({ ok: false, error: { code: 'reversed', part: '3-1' } });
  });
});

describe('isSelectedPage', () => {
  it('null heißt alle Seiten', () => {
    expect(isSelectedPage(null, 7)).toBe(true);
  });

  it('sonst nur die genannten Seiten', () => {
    expect(isSelectedPage([1, 2], 2)).toBe(true);
    expect(isSelectedPage([1, 2], 0)).toBe(false);
  });
});

describe('placeTexts', () => {
  const width = 595;
  const height = 842;
  const size = 10;
  const margin = 10 * MM;
  const capHeight = 0.718 * size;
  const measure = () => 50;

  it('Kopfzeile links, Mitte und rechts auf gleicher Höhe unter dem oberen Rand', () => {
    const items = (['left', 'center', 'right'] as const).map((slot) => ({
      row: 'header' as const,
      slot,
      text: 'x',
    }));
    const [left, center, right] = placeTexts(width, height, items, size, 10, measure);
    expect(left?.vx).toBeCloseTo(margin);
    expect(center?.vx).toBeCloseTo((width - 50) / 2);
    expect(right?.vx).toBeCloseTo(width - margin - 50);
    for (const at of [left, center, right]) {
      expect(at?.vy).toBeCloseTo(height - margin - capHeight);
    }
  });

  it('Fußzeile steht mit der Grundlinie auf dem unteren Rand', () => {
    const [at] = placeTexts(
      width,
      height,
      [{ row: 'footer', slot: 'center', text: 'x' }],
      size,
      10,
      measure,
    );
    expect(at?.vy).toBeCloseTo(margin);
  });

  it('die Breite des Texts bestimmt die Lage rechts', () => {
    const [at] = placeTexts(
      width,
      height,
      [{ row: 'footer', slot: 'right', text: 'abcdef' }],
      size,
      10,
      (t) => t.length * 4,
    );
    expect(at?.vx).toBeCloseTo(width - margin - 24);
  });
});

describe('WinAnsi-Zeichen', () => {
  it('stimmen mit dem Zeichenvorrat von Helvetica in pdf-lib überein', async () => {
    const doc = await PDFDocument.create({ updateMetadata: false });
    const font = await doc.embedFont(StandardFonts.Helvetica);
    expect(new Set(font.getCharacterSet())).toEqual(WINANSI_CHARSET);
  });

  it('meldet jedes nicht darstellbare Zeichen einmal und lässt andere Felder in Ruhe', () => {
    const o = options({
      texts: {
        header: { left: 'Müller → Co', center: '→', right: 'Ä€' },
        footer: { left: '', center: '', right: '' },
      },
      number: { row: 'footer', slot: 'right', format: 'Seite {n} ✓' },
    });
    expect(unsupportedInOptions(o)).toEqual(['→', '✓']);
  });

  it('Umlaute, Euro und typografische Striche sind erlaubt', () => {
    const o = options({
      texts: { header: { left: 'Größe – „Ärger“ € …', center: '', right: '' }, footer: EMPTY_ROW },
    });
    expect(unsupportedInOptions(o)).toEqual([]);
  });
});
