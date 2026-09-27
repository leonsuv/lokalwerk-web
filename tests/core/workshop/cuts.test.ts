import { describe, expect, it } from 'vitest';
import {
  clearCuts,
  deletePages,
  duplicateDoc,
  joinDocs,
  mergeDocs,
  moveDoc,
  replaceCuts,
  movePages,
  setCuts,
  setPageNumbers,
  splitAtCuts,
  splitDoc,
} from '../../../src/core/workshop/commands.ts';
import { cutIndices } from '../../../src/core/workshop/model.ts';
import { bench, describeDocs, keysOf, pdfSource } from './helpers.ts';

const part = (n: number) => `Teil ${n}`;

describe('Trennlinien', () => {
  it('setzt und entfernt Linien, nie vor der ersten Seite', () => {
    const b = bench(pdfSource('a', 5));
    const [first, second, fourth] = keysOf(b.state, 0, 0, 1, 3);
    const before = b.state;
    expect(b.run(setCuts([first ?? ''], true))).toBe(before);
    b.run(setCuts([second ?? '', fourth ?? ''], true));
    const doc = b.state.docs[0];
    expect(doc && cutIndices(doc)).toEqual([1, 3]);
    b.run(setCuts([second ?? ''], false));
    expect(cutIndices(b.state.docs[0] ?? { id: '', name: '', pages: [] })).toEqual([3]);
    // Dieselbe Linie noch einmal: kein neuer Zustand
    const now = b.state;
    expect(b.run(setCuts([fourth ?? ''], true))).toBe(now);
  });

  it('teilt an allen Linien in einem Schritt, Teile direkt dahinter', () => {
    const b = bench(pdfSource('a', 6), pdfSource('b', 1));
    const doc = b.state.docs[0]?.id ?? '';
    b.run(
      setPageNumbers(doc, {
        format: 'n',
        anchor: 'bottom-center',
        fromPage: 1,
        startAt: 1,
        fontSize: 10,
        marginMm: 10,
      }),
    );
    b.run(setCuts(keysOf(b.state, 0, 2, 4), true));
    const result = splitAtCuts(doc, part).apply(b.state, b.ids);
    expect(describeDocs(result.state)).toEqual({
      a: ['a1', 'a2'],
      'Teil 2': ['a3', 'a4'],
      'Teil 3': ['a5', 'a6'],
      b: ['b1'],
    });
    expect(result.state.docs[0]?.id).toBe(doc);
    expect(result.doc).toBe(result.state.docs[1]?.id);
    // Keine Linien mehr, Seitenzahlen gelten für jeden Teil
    expect(result.state.docs.every((d) => d.cuts === undefined)).toBe(true);
    expect(result.state.docs.slice(0, 3).every((d) => d.ops?.length === 1)).toBe(true);
  });

  it('ersetzt alle Linien eines Dokuments in einem Schritt (alle n Seiten)', () => {
    const b = bench(pdfSource('a', 7));
    const doc = b.state.docs[0]?.id ?? '';
    b.run(setCuts(keysOf(b.state, 0, 1), true));
    b.run(replaceCuts(doc, keysOf(b.state, 0, 0, 3, 6)));
    expect(b.state.docs[0] && cutIndices(b.state.docs[0])).toEqual([3, 6]);
    const before = b.state;
    expect(b.run(replaceCuts(doc, keysOf(b.state, 0, 6, 3)))).toBe(before);
  });

  it('ohne Linien ändert „An Trennlinien teilen“ nichts', () => {
    const b = bench(pdfSource('a', 3));
    const before = b.state;
    expect(b.run(splitAtCuts(b.state.docs[0]?.id ?? '', part))).toBe(before);
  });

  it('die Linie wandert mit ihrer Seite und verschwindet vorn oder in einem anderen Dokument', () => {
    const b = bench(pdfSource('a', 4), pdfSource('b', 2));
    const [a2, a3] = keysOf(b.state, 0, 1, 2);
    const [docA, docB] = b.state.docs.map((d) => d.id);
    b.run(setCuts([a3 ?? ''], true));
    // a3 an den Anfang: vor der ersten Seite gibt es keine Linie
    b.run(movePages([a3 ?? ''], docA ?? '', 0));
    expect(b.state.docs[0]?.cuts).toBeUndefined();
    b.run(setCuts([a2 ?? ''], true));
    b.run(movePages([a2 ?? ''], docB ?? '', 1));
    expect(b.state.docs[0]?.cuts).toBeUndefined();
    expect(b.state.docs[1]?.cuts).toBeUndefined();
  });

  it('Löschen der Seite nach der Linie entfernt die Linie', () => {
    const b = bench(pdfSource('a', 3));
    const [a2] = keysOf(b.state, 0, 1);
    b.run(setCuts([a2 ?? ''], true));
    b.run(deletePages([a2 ?? '']));
    expect(b.state.docs[0]?.cuts).toBeUndefined();
  });

  it('Duplizieren, Teilen und Zusammenführen behalten die Linien', () => {
    const b = bench(pdfSource('a', 4), pdfSource('b', 3));
    b.run(setCuts(keysOf(b.state, 0, 1, 3), true));
    b.run(setCuts(keysOf(b.state, 1, 2), true));
    b.run(duplicateDoc(b.state.docs[0]?.id ?? '', 'Kopie'));
    const copy = b.state.docs[1];
    expect(copy && cutIndices(copy)).toEqual([1, 3]);
    b.run(splitDoc(b.state.docs[0]?.id ?? '', 2, 'Rest'));
    expect(b.state.docs.map((d) => cutIndices(d))).toEqual([[1], [1], [1, 3], [2]]);
    b.run(mergeDocs([b.state.docs[0]?.id ?? '', b.state.docs[1]?.id ?? '']));
    expect(cutIndices(b.state.docs[0] ?? { id: '', name: '', pages: [] })).toEqual([1, 3]);
    b.run(clearCuts(b.state.docs.map((d) => d.id)));
    expect(b.state.docs.every((d) => d.cuts === undefined)).toBe(true);
  });
});

describe('Dokumente umordnen und in Reihenfolge zusammenführen', () => {
  it('verschiebt ein Dokument an eine Stelle der Liste', () => {
    const b = bench(pdfSource('a', 1), pdfSource('b', 1), pdfSource('c', 1));
    const [a, , c] = b.state.docs.map((d) => d.id);
    b.run(moveDoc(a ?? '', 3));
    expect(b.state.docs.map((d) => d.name)).toEqual(['b', 'c', 'a']);
    b.run(moveDoc(c ?? '', 0));
    expect(b.state.docs.map((d) => d.name)).toEqual(['c', 'b', 'a']);
    const before = b.state;
    // Vor sich selbst oder direkt dahinter: keine Änderung
    expect(b.run(moveDoc(c ?? '', 0))).toBe(before);
    expect(b.run(moveDoc(c ?? '', 1))).toBe(before);
  });

  it('führt in der angegebenen Reihenfolge zusammen, Ziel bleibt an seinem Platz', () => {
    const b = bench(pdfSource('a', 1), pdfSource('b', 2), pdfSource('c', 1));
    const [a, bDoc, c] = b.state.docs.map((d) => d.id);
    const result = joinDocs([bDoc ?? '', c ?? '', a ?? '']).apply(b.state, b.ids);
    expect(describeDocs(result.state)).toEqual({ b: ['b1', 'b2', 'c1', 'a1'] });
    expect(result.doc).toBe(bDoc);
    const two = bench(pdfSource('a', 1), pdfSource('b', 1), pdfSource('c', 1));
    const ids = two.state.docs.map((d) => d.id);
    two.run(joinDocs([ids[2] ?? '', ids[0] ?? '']));
    expect(describeDocs(two.state)).toEqual({ b: ['b1'], c: ['c1', 'a1'] });
    expect(two.state.docs.map((d) => d.name)).toEqual(['b', 'c']);
  });

  it('weniger als zwei Dokumente: keine Änderung', () => {
    const b = bench(pdfSource('a', 1));
    const before = b.state;
    expect(b.run(joinDocs([b.state.docs[0]?.id ?? '', 'unbekannt']))).toBe(before);
  });
});
