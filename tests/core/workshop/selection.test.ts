import { describe, expect, it } from 'vitest';
import { deletePages } from '../../../src/core/workshop/commands.ts';
import {
  EMPTY_SELECTION,
  moveFocus,
  pruneSelection,
  selectDoc,
  selectionSummary,
  selectKeys,
  selectOnly,
  selectRange,
  toggle,
} from '../../../src/core/workshop/selection.ts';
import { bench, keysOf, pdfSource } from './helpers.ts';

describe('Auswahl', () => {
  const b = bench(pdfSource('a', 3), pdfSource('b', 2));
  const [a1, a2, a3] = keysOf(b.state, 0, 0, 1, 2);
  const [b1, b2] = keysOf(b.state, 1, 0, 1);
  const k = (x: string | undefined) => x ?? '';

  it('Klick wählt nur eine Seite, Strg/Cmd schaltet um', () => {
    let s = selectOnly(k(a1));
    expect([...s.keys]).toEqual([a1]);
    s = toggle(s, k(b1));
    expect([...s.keys]).toEqual([a1, b1]);
    s = toggle(s, k(a1));
    expect([...s.keys]).toEqual([b1]);
    expect(s.anchor).toBe(a1);
  });

  it('Umschalt wählt einen Bereich über Dokumentgrenzen, in beide Richtungen', () => {
    const s = selectRange(b.state, selectOnly(k(a2)), k(b1));
    expect([...s.keys]).toEqual([a2, a3, b1]);
    expect(s.anchor).toBe(a2);
    expect(s.focus).toBe(b1);
    const back = selectRange(b.state, s, k(a1));
    expect([...back.keys]).toEqual([a1, a2]);
    expect([...selectRange(b.state, s, k(a2)).keys]).toEqual([a2]);
  });

  it('Strg/Cmd+Umschalt ergänzt den Bereich zur bisherigen Auswahl', () => {
    const s = selectRange(b.state, toggle(selectOnly(k(a1)), k(b1)), k(b2), true);
    expect(new Set(s.keys)).toEqual(new Set([a1, b1, b2]));
  });

  it('ohne Anker beginnt der Bereich bei der Seite selbst', () => {
    expect([...selectRange(b.state, EMPTY_SELECTION, k(a3)).keys]).toEqual([a3]);
    expect(selectRange(b.state, EMPTY_SELECTION, 'unbekannt')).toBe(EMPTY_SELECTION);
  });

  it('Strg/Cmd+A wählt das ganze Dokument, Fokus bleibt', () => {
    const s = selectDoc(b.state, b.state.docs[1]?.id ?? '', k(b2));
    expect([...s.keys]).toEqual([b1, b2]);
    expect(s.focus).toBe(b2);
    expect(moveFocus(s, k(a1)).keys).toBe(s.keys);
  });

  it('entfernt Seiten, die es nicht mehr gibt, und zählt Seiten und Dokumente', () => {
    const s = selectKeys([k(a1), k(a3), k(b2)]);
    expect(selectionSummary(b.state, s)).toEqual({ pages: 3, docs: 2 });
    const after = deletePages([k(a1), k(b2)]).apply(b.state, b.ids).state;
    const pruned = pruneSelection(after, s);
    expect([...pruned.keys]).toEqual([a3]);
    expect(pruned.anchor).toBeNull();
    expect(pruneSelection(b.state, s)).toBe(s);
    expect(selectionSummary(after, pruned)).toEqual({ pages: 1, docs: 1 });
  });
});
