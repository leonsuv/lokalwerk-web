import { describe, expect, it } from 'vitest';
import {
  addEntry,
  BookmarkError,
  type BookmarkEntry,
  canIndent,
  canOutdent,
  cleanTitle,
  deleteEntry,
  descendantCount,
  indentEntry,
  isValidOutline,
  MAX_TITLE_LENGTH,
  outdentEntry,
  renameEntry,
  subtreeEnd,
} from '../../../src/core/pdf/bookmark-model.ts';

/** Kurzschreibweise: [Titel, Ebene] mit Seite = Position, Ursprung = Position. */
function list(...rows: [string, number][]): BookmarkEntry[] {
  return rows.map(([title, level], i) => ({ title, level, page: i, origin: i }));
}

const titles = (entries: BookmarkEntry[]) => entries.map((e) => `${e.level}:${e.title}`);

/** Beispiel: A (0) mit B, C (1) und C1 (2); D (0). */
const sample = () => list(['A', 0], ['B', 1], ['C', 1], ['C1', 2], ['D', 0]);

describe('Gültigkeit der Liste', () => {
  it('verlangt Ebene 0 am Anfang und höchstens eine Ebene Sprung', () => {
    expect(isValidOutline([])).toBe(true);
    expect(isValidOutline(sample())).toBe(true);
    expect(isValidOutline(list(['A', 1]))).toBe(false);
    expect(isValidOutline(list(['A', 0], ['B', 2]))).toBe(false);
    expect(isValidOutline(list(['A', 0], ['B', -1]))).toBe(false);
  });

  it('findet das Ende eines Teilbaums und die Zahl der Unterpunkte', () => {
    const items = sample();
    expect(subtreeEnd(items, 0)).toBe(4);
    expect(descendantCount(items, 0)).toBe(3);
    expect(subtreeEnd(items, 1)).toBe(2);
    expect(descendantCount(items, 4)).toBe(0);
  });
});

describe('Ebenen', () => {
  it('rückt einen Eintrag mit seinen Unterpunkten ein', () => {
    const out = indentEntry(sample(), 2);
    expect(titles(out)).toEqual(['0:A', '1:B', '2:C', '3:C1', '0:D']);
    expect(isValidOutline(out)).toBe(true);
  });

  it('erlaubt kein Einrücken am Anfang und über den Vorgänger hinaus', () => {
    const items = sample();
    expect(canIndent(items, 0)).toBe(false);
    expect(canIndent(items, 1)).toBe(false);
    expect(canIndent(items, 2)).toBe(true);
    expect(canIndent(items, 3)).toBe(false);
    expect(indentEntry(items, 0)).toBe(items);
    expect(indentEntry(items, 3)).toBe(items);
  });

  it('rückt Unterpunkte mit nach oben', () => {
    const out = outdentEntry(sample(), 2);
    expect(titles(out)).toEqual(['0:A', '1:B', '0:C', '1:C1', '0:D']);
    expect(isValidOutline(out)).toBe(true);
    expect(canOutdent(sample(), 0)).toBe(false);
    expect(outdentEntry(sample(), 0)).toEqual(sample());
  });

  it('lässt beim Ausrücken keinen Eintrag in eine ungültige Ebene fallen', () => {
    const items = list(['A', 0], ['B', 1], ['C', 2], ['D', 1]);
    const out = outdentEntry(items, 1);
    expect(titles(out)).toEqual(['0:A', '0:B', '1:C', '1:D']);
    expect(isValidOutline(out)).toBe(true);
  });
});

describe('Umbenennen', () => {
  it('ändert nur den Titel, Ziel und Ebene bleiben', () => {
    const out = renameEntry(sample(), 2, '  Kapitel 2  ');
    expect(out[2]).toEqual({ title: 'Kapitel 2', level: 1, page: 2, origin: 2 });
    expect(out[0]).toEqual(sample()[0]);
  });

  it('weist leere und zu lange Titel ab', () => {
    expect(() => renameEntry(sample(), 0, '   ')).toThrow(BookmarkError);
    expect(() => renameEntry(sample(), 0, 'x'.repeat(MAX_TITLE_LENGTH + 1))).toThrow(BookmarkError);
    expect(cleanTitle('x'.repeat(MAX_TITLE_LENGTH))).toHaveLength(MAX_TITLE_LENGTH);
  });
});

describe('Löschen', () => {
  it('hebt die Unterpunkte um eine Ebene, damit kein Titel verloren geht', () => {
    const out = deleteEntry(sample(), 0);
    expect(titles(out)).toEqual(['0:B', '0:C', '1:C1', '0:D']);
    expect(isValidOutline(out)).toBe(true);
  });

  it('entfernt einen Eintrag ohne Unterpunkte und lässt den Rest', () => {
    const out = deleteEntry(sample(), 4);
    expect(titles(out)).toEqual(['0:A', '1:B', '1:C', '2:C1']);
  });

  it('lässt die Liste bei einem ungültigen Index unverändert', () => {
    const items = sample();
    expect(deleteEntry(items, 9)).toBe(items);
  });
});

describe('Hinzufügen', () => {
  it('legt einen Eintrag nach dem Teilbaum auf derselben Ebene an', () => {
    const out = addEntry(sample(), 2, { title: 'Neu', page: 5 }, 10);
    expect(titles(out)).toEqual(['0:A', '1:B', '1:C', '2:C1', '1:Neu', '0:D']);
    expect(out[4]).toEqual({ title: 'Neu', level: 1, page: 5, origin: null });
    expect(isValidOutline(out)).toBe(true);
  });

  it('hängt ans Ende an, auf die Ebene des letzten Eintrags', () => {
    const out = addEntry(sample(), null, { title: 'Anhang', page: 0 }, 1);
    expect(titles(out).at(-1)).toBe('0:Anhang');
    expect(isValidOutline(out)).toBe(true);
  });

  it('legt in einer leeren Liste die erste Ebene 0 an', () => {
    expect(addEntry([], null, { title: 'Erstes', page: 0 }, 1)).toEqual([
      { title: 'Erstes', level: 0, page: 0, origin: null },
    ]);
  });

  it('prüft Titel und Seite', () => {
    expect(() => addEntry(sample(), null, { title: '', page: 0 }, 3)).toThrow(BookmarkError);
    expect(() => addEntry(sample(), null, { title: 'X', page: 3 }, 3)).toThrow(BookmarkError);
    expect(() => addEntry(sample(), null, { title: 'X', page: -1 }, 3)).toThrow(BookmarkError);
    expect(() => addEntry(sample(), null, { title: 'X', page: 1.5 }, 3)).toThrow(BookmarkError);
  });
});

describe('Folgen von Änderungen', () => {
  it('bleibt bei zufälligen Änderungen immer gültig', () => {
    // Fester Zufall (LCG), damit der Test jedes Mal dasselbe prüft.
    let seed = 20261102;
    const next = (n: number) => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed % n;
    };
    let items: BookmarkEntry[] = [];
    for (let step = 0; step < 400; step++) {
      const op = next(6);
      const i = items.length === 0 ? 0 : next(items.length);
      if (op === 0 || items.length === 0) {
        items = addEntry(items, items.length === 0 ? null : i, { title: `T${step}`, page: 0 }, 5);
      } else if (op === 1) {
        items = indentEntry(items, i);
      } else if (op === 2) {
        items = outdentEntry(items, i);
      } else if (op === 3) {
        items = deleteEntry(items, i);
      } else if (op === 4) {
        items = renameEntry(items, i, `R${step}`);
      } else {
        items = addEntry(items, null, { title: `E${step}`, page: 1 }, 5);
      }
      expect(isValidOutline(items)).toBe(true);
    }
  });
});
