import { describe, expect, it } from 'vitest';
import {
  addSources,
  closeDoc,
  copyPages,
  deletePages,
  duplicateDoc,
  duplicatePages,
  extractToNewDoc,
  insertBlank,
  mergeDocs,
  movePages,
  newDoc,
  pastePages,
  renameDoc,
  rotatePages,
  shiftPages,
  splitDoc,
  toClipboard,
  type Command,
} from '../../../src/core/workshop/commands.ts';
import { allPages, type PageKey, type WorkshopState } from '../../../src/core/workshop/model.ts';
import { bench, describeDocs, imageSource, keysOf, pdfSource, seeded } from './helpers.ts';

function allKeys(state: WorkshopState): PageKey[] {
  return [...allPages(state)].map((l) => l.page.key);
}

describe('addSources', () => {
  it('legt je PDF ein Dokument an, benannt nach der Datei ohne .pdf', () => {
    const b = bench(pdfSource('a', 2, 'Vertrag.PDF'), pdfSource('b', 1, 'Anlage.pdf'));
    expect(describeDocs(b.state)).toEqual({ Vertrag: ['a1', 'a2'], Anlage: ['b1'] });
    expect([...b.state.sources.keys()]).toEqual(['a', 'b']);
  });

  it('fasst Bilder derselben Ablage in einem Dokument zusammen', () => {
    const b = bench(
      imageSource('i', 'Scan 1.jpeg'),
      pdfSource('a', 1, 'Brief.pdf'),
      imageSource('j', 'Scan 2.png'),
    );
    expect(describeDocs(b.state)).toEqual({ 'Scan 1': ['i1', 'j1'], Brief: ['a1'] });
  });

  it('fügt mit Ziel an der Stelle ein und wählt die neuen Seiten aus', () => {
    const b = bench(pdfSource('a', 3));
    const doc = b.state.docs[0]?.id ?? '';
    const result = addSources([pdfSource('b', 2)], { doc, index: 1 }).apply(b.state, b.ids);
    expect(describeDocs(result.state)).toEqual({ a: ['a1', 'b1', 'b2', 'a2', 'a3'] });
    expect(result.select).toEqual(keysOf(result.state, 0, 1, 2));
  });

  it('ändert nichts ohne Dateien oder bei unbekanntem Ziel', () => {
    const b = bench(pdfSource('a', 1));
    expect(addSources([]).apply(b.state, b.ids).state).toBe(b.state);
    expect(
      addSources([pdfSource('b', 1)], { doc: 'gibt-es-nicht', index: 0 }).apply(b.state, b.ids)
        .state,
    ).toBe(b.state);
  });
});

describe('Dokumente', () => {
  it('neu, umbenennen, schließen', () => {
    const b = bench(pdfSource('a', 1));
    b.run(newDoc('Leer'));
    expect(describeDocs(b.state)).toEqual({ a: ['a1'], Leer: [] });
    const leer = b.state.docs[1]?.id ?? '';
    const before = b.run(renameDoc(leer, '  Neu  '));
    expect(b.state.docs[1]?.name).toBe('Neu');
    expect(b.run(renameDoc(leer, '   '))).toBe(before);
    expect(b.run(renameDoc(leer, 'Neu'))).toBe(before);
    b.run(closeDoc(b.state.docs[0]?.id ?? ''));
    expect(describeDocs(b.state)).toEqual({ Neu: [] });
    expect(b.state.sources.size).toBe(0);
  });

  it('dupliziert ein Dokument rechts daneben mit neuen Schlüsseln', () => {
    const b = bench(pdfSource('a', 2), pdfSource('b', 1));
    b.run(duplicateDoc(b.state.docs[0]?.id ?? '', 'a (Kopie)'));
    expect(describeDocs(b.state)).toEqual({
      a: ['a1', 'a2'],
      'a (Kopie)': ['a1', 'a2'],
      b: ['b1'],
    });
    expect(new Set(allKeys(b.state)).size).toBe(5);
  });

  it('teilt ab einer Seite in ein neues Dokument rechts daneben', () => {
    const b = bench(pdfSource('a', 4), pdfSource('b', 1));
    const id = b.state.docs[0]?.id ?? '';
    const before = b.state;
    expect(b.run(splitDoc(id, 0, 'x'))).toBe(before);
    expect(b.run(splitDoc(id, 4, 'x'))).toBe(before);
    b.run(splitDoc(id, 3, 'a (Teil 2)'));
    expect(describeDocs(b.state)).toEqual({
      a: ['a1', 'a2', 'a3'],
      'a (Teil 2)': ['a4'],
      b: ['b1'],
    });
  });

  it('führt Dokumente in der Reihenfolge der Spalten ins erste zusammen', () => {
    const b = bench(pdfSource('a', 1), pdfSource('b', 2), pdfSource('c', 1));
    const [a, , c] = b.state.docs.map((d) => d.id);
    b.run(mergeDocs([c ?? '', a ?? '']));
    expect(describeDocs(b.state)).toEqual({ a: ['a1', 'c1'], b: ['b1', 'b2'] });
    const before = b.state;
    expect(b.run(mergeDocs([a ?? '']))).toBe(before);
  });
});

describe('movePages', () => {
  it('verschiebt innerhalb eines Dokuments vor die Seite an der Einfügestelle', () => {
    const b = bench(pdfSource('a', 5));
    const doc = b.state.docs[0]?.id ?? '';
    // a2 und a4 vor a1
    b.run(movePages(keysOf(b.state, 0, 1, 3), doc, 0));
    expect(describeDocs(b.state).a).toEqual(['a2', 'a4', 'a1', 'a3', 'a5']);
    // a2 hinter a3: Einfügestelle 4 = vor a5 im alten Stand
    b.run(movePages(keysOf(b.state, 0, 0), doc, 4));
    expect(describeDocs(b.state).a).toEqual(['a4', 'a1', 'a3', 'a2', 'a5']);
    // ans Ende
    b.run(movePages(keysOf(b.state, 0, 0), doc, 99));
    expect(describeDocs(b.state).a).toEqual(['a1', 'a3', 'a2', 'a5', 'a4']);
  });

  it('verschiebt über Dokumentgrenzen und behält die Schlüssel', () => {
    const b = bench(pdfSource('a', 3), pdfSource('b', 2));
    const moving = [...keysOf(b.state, 1, 1), ...keysOf(b.state, 0, 0)];
    const result = movePages(moving, b.state.docs[1]?.id ?? '', 1).apply(b.state, b.ids);
    expect(describeDocs(result.state)).toEqual({ a: ['a2', 'a3'], b: ['b1', 'a1', 'b2'] });
    // Reihenfolge der Spalten, nicht der Übergabe
    expect(result.select).toEqual([moving[1], moving[0]]);
    expect(keysOf(result.state, 1, 1, 2)).toEqual([moving[1], moving[0]]);
  });

  it('kann ein Dokument leeren und in ein leeres Dokument verschieben', () => {
    const b = bench(pdfSource('a', 2));
    b.run(newDoc('Ziel'));
    b.run(movePages(keysOf(b.state, 0, 0, 1), b.state.docs[1]?.id ?? '', 0));
    expect(describeDocs(b.state)).toEqual({ a: [], Ziel: ['a1', 'a2'] });
  });

  it('gibt bei Verschieben an dieselbe Stelle denselben Zustand zurück', () => {
    const b = bench(pdfSource('a', 4));
    const doc = b.state.docs[0]?.id ?? '';
    const before = b.state;
    // a2 und a3 vor a2 bzw. vor a4: bleibt, wie es ist
    expect(b.run(movePages(keysOf(before, 0, 1, 2), doc, 1))).toBe(before);
    expect(b.run(movePages(keysOf(before, 0, 1, 2), doc, 3))).toBe(before);
    expect(b.run(movePages([], doc, 0))).toBe(before);
    expect(b.run(movePages(['unbekannt'], doc, 0))).toBe(before);
    expect(b.run(movePages(keysOf(before, 0, 0), 'unbekannt', 0))).toBe(before);
  });
});

describe('Seitenbefehle', () => {
  it('kopiert mit neuen Schlüsseln und wählt die Kopien aus', () => {
    const b = bench(pdfSource('a', 2), pdfSource('b', 1));
    const result = copyPages(keysOf(b.state, 0, 0, 1), b.state.docs[1]?.id ?? '', 0).apply(
      b.state,
      b.ids,
    );
    expect(describeDocs(result.state)).toEqual({ a: ['a1', 'a2'], b: ['a1', 'a2', 'b1'] });
    expect(result.select).toEqual(keysOf(result.state, 1, 0, 1));
    expect(new Set(allKeys(result.state)).size).toBe(5);
  });

  it('dreht in 90-Grad-Schritten und rechnet modulo 360', () => {
    const b = bench(pdfSource('a', 2));
    const [first] = keysOf(b.state, 0, 0);
    b.run(rotatePages([first ?? ''], 90));
    b.run(rotatePages([first ?? ''], 90));
    b.run(rotatePages(keysOf(b.state, 0, 0, 1), -90));
    expect(describeDocs(b.state).a).toEqual(['a1r90', 'a2r270']);
    b.run(rotatePages(keysOf(b.state, 0, 0), -90));
    expect(describeDocs(b.state).a).toEqual(['a1', 'a2r270']);
  });

  it('löscht Seiten und gibt Quellen ohne Verweis frei', () => {
    const b = bench(pdfSource('a', 2), pdfSource('b', 1));
    b.run(deletePages(keysOf(b.state, 1, 0)));
    expect(describeDocs(b.state)).toEqual({ a: ['a1', 'a2'], b: [] });
    expect([...b.state.sources.keys()]).toEqual(['a']);
  });

  it('dupliziert jede Seite direkt dahinter', () => {
    const b = bench(pdfSource('a', 3));
    const result = duplicatePages(keysOf(b.state, 0, 0, 2)).apply(b.state, b.ids);
    expect(describeDocs(result.state).a).toEqual(['a1', 'a1', 'a2', 'a3', 'a3']);
    expect(result.select).toEqual(keysOf(result.state, 0, 1, 4));
  });

  it('verschiebt um eine Stelle, zusammenhängende Seiten gemeinsam, Ränder bleiben', () => {
    const b = bench(pdfSource('a', 5));
    b.run(shiftPages(keysOf(b.state, 0, 2, 3), -1));
    expect(describeDocs(b.state).a).toEqual(['a1', 'a3', 'a4', 'a2', 'a5']);
    b.run(shiftPages(keysOf(b.state, 0, 0, 4), 1));
    expect(describeDocs(b.state).a).toEqual(['a3', 'a1', 'a4', 'a2', 'a5']);
    b.run(shiftPages(keysOf(b.state, 0, 0, 1), -1));
    expect(describeDocs(b.state).a).toEqual(['a3', 'a1', 'a4', 'a2', 'a5']);
  });

  it('fügt Leerseiten ein und lehnt Größen ohne Fläche ab', () => {
    const b = bench(pdfSource('a', 2));
    const doc = b.state.docs[0]?.id ?? '';
    b.run(insertBlank(doc, 1, { width: 100, height: 200 }));
    expect(describeDocs(b.state).a).toEqual(['a1', 'leer', 'a2']);
    const before = b.state;
    expect(b.run(insertBlank(doc, 0, { width: 0, height: 200 }))).toBe(before);
    expect(b.run(insertBlank(doc, 0, { width: Number.NaN, height: 200 }))).toBe(before);
  });

  it('zieht Seiten in ein neues Dokument, verschoben oder kopiert', () => {
    const b = bench(pdfSource('a', 3));
    const moved = extractToNewDoc(keysOf(b.state, 0, 2, 0), 'Auszug', 'move').apply(b.state, b.ids);
    expect(describeDocs(moved.state)).toEqual({ a: ['a2'], Auszug: ['a1', 'a3'] });
    expect(moved.doc).toBe(moved.state.docs[1]?.id);
    const copied = extractToNewDoc(keysOf(b.state, 0, 1), 'Kopie', 'copy').apply(b.state, b.ids);
    expect(describeDocs(copied.state)).toEqual({ a: ['a1', 'a2', 'a3'], Kopie: ['a2'] });
  });
});

describe('interne Ablage', () => {
  it('fügt ausgeschnittene Seiten samt Quelle wieder ein', () => {
    const b = bench(pdfSource('a', 2), pdfSource('b', 1));
    const clip = toClipboard(b.state, keysOf(b.state, 1, 0));
    b.run(deletePages(keysOf(b.state, 1, 0), 'Ausschneiden'));
    expect(b.state.sources.has('b')).toBe(false);
    const result = pastePages(clip, b.state.docs[0]?.id ?? '', 1).apply(b.state, b.ids);
    expect(describeDocs(result.state)).toEqual({ a: ['a1', 'b1', 'a2'], b: [] });
    expect(result.state.sources.get('b')?.name).toBe('b.pdf');
    // Zweimal einfügen ergibt zwei verschiedene Schlüssel
    const again = pastePages(clip, b.state.docs[0]?.id ?? '', 0).apply(result.state, b.ids);
    expect(new Set(allKeys(again.state)).size).toBe(4);
  });
});

describe('Eigenschaften über zufällige Befehlsfolgen', () => {
  function randomCommand(state: WorkshopState, random: () => number): Command {
    const keys = allKeys(state);
    const pick = () => keys.filter(() => random() < 0.2);
    const docs = state.docs.map((d) => d.id);
    const doc = docs[Math.floor(random() * docs.length)] ?? '';
    const index = Math.floor(random() * 8);
    const commands: (() => Command)[] = [
      () => movePages(pick(), doc, index),
      () => copyPages(pick(), doc, index),
      () => rotatePages(pick(), random() < 0.5 ? 90 : -90),
      () => deletePages(pick()),
      () => duplicatePages(pick()),
      () => shiftPages(pick(), random() < 0.5 ? -1 : 1),
      () => insertBlank(doc, index, { width: 100, height: 100 }),
      () => splitDoc(doc, index, 'Teil'),
      () => mergeDocs(docs.filter(() => random() < 0.5)),
      () => extractToNewDoc(pick(), 'Neu', random() < 0.5 ? 'move' : 'copy'),
      () => addSources([pdfSource(`s${Math.floor(random() * 1e6)}`, 2)]),
      () => closeDoc(doc),
      () => newDoc('Leer'),
      () => pastePages(toClipboard(state, pick()), doc, index),
    ];
    // Kopieren und Duplizieren vervielfachen die Seiten; ab 200 Seiten nur noch löschen.
    if (keys.length > 200) return deletePages(pick());
    const make = commands[Math.floor(random() * commands.length)];
    return make ? make() : newDoc('Leer');
  }

  /** Vollständiger Abdruck, um zu prüfen, dass ein Befehl den alten Zustand nicht ändert */
  function snapshot(state: WorkshopState): string {
    return JSON.stringify([state.docs, [...state.sources.entries()]]);
  }

  function multiset(state: WorkshopState): string[] {
    return [...allPages(state)].map((l) => l.page.key).sort();
  }

  it('Schlüssel bleiben eindeutig, Quellen passen zu den Seiten, Verschieben verliert nichts', () => {
    const random = seeded(20260927);
    const b = bench(pdfSource('a', 6), pdfSource('b', 4), imageSource('i'));
    for (let step = 0; step < 1000; step++) {
      const command = randomCommand(b.state, random);
      const before = b.state;
      const print = snapshot(before);
      const after = b.run(command);
      expect(snapshot(before)).toBe(print);
      const keys = allKeys(after);
      expect(new Set(keys).size).toBe(keys.length);
      const used = new Set(
        [...allPages(after)].flatMap((l) => (l.page.kind === 'source' ? [l.page.source] : [])),
      );
      expect(new Set(after.sources.keys())).toEqual(used);
      if (command.label === 'Verschieben' || command.label.startsWith('Nach ')) {
        expect(multiset(after)).toEqual(multiset(before));
      }
    }
  });
});
