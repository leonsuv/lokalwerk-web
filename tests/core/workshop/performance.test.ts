/**
 * Laufzeit der Befehle mit 5.000 Seiten (plan-phase3.md Schritt 1.1 und Abschnitt 8). Die
 * Grenzen sind großzügig, damit langsame CI-Rechner nicht zufällig scheitern; gemessen wird,
 * dass nichts quadratisch wird (5.000 Seiten quadratisch wären Sekunden, nicht Millisekunden).
 */

import { describe, expect, it } from 'vitest';
import {
  addSources,
  copyPages,
  deletePages,
  duplicatePages,
  movePages,
  rotatePages,
  shiftPages,
  type Command,
} from '../../../src/core/workshop/commands.ts';
import {
  createHistory,
  execute,
  HISTORY_LIMIT,
  releasedSources,
} from '../../../src/core/workshop/history.ts';
import { counterIds, EMPTY_STATE, type PageKey } from '../../../src/core/workshop/model.ts';
import { selectRange, selectOnly } from '../../../src/core/workshop/selection.ts';
import { pdfSource } from './helpers.ts';

const LIMIT_MS = 250;

function timed<T>(fn: () => T): { value: T; ms: number } {
  const start = performance.now();
  const value = fn();
  return { value, ms: performance.now() - start };
}

describe('5.000 Seiten', () => {
  const ids = counterIds();
  const sources = Array.from({ length: 10 }, (_, i) => pdfSource(`q${i}`, 500));
  const state = addSources(sources).apply(EMPTY_STATE, ids).state;
  const every = (n: number): PageKey[] =>
    state.docs.flatMap((d) => d.pages.filter((_, i) => i % n === 0).map((p) => p.key));
  const target = state.docs[5]?.id ?? '';
  const hundred = every(50);

  it('hat 5.000 Seiten in 10 Dokumenten', () => {
    expect(state.docs.reduce((n, d) => n + d.pages.length, 0)).toBe(5000);
    expect(hundred).toHaveLength(100);
  });

  const cases: [string, Command][] = [
    ['100 Seiten verschieben', movePages(hundred, target, 250)],
    ['100 Seiten kopieren', copyPages(hundred, target, 250)],
    ['100 Seiten drehen', rotatePages(hundred, 90)],
    ['100 Seiten löschen', deletePages(hundred)],
    ['100 Seiten duplizieren', duplicatePages(hundred)],
    ['100 Seiten nach vorne', shiftPages(hundred, -1)],
    ['alle Seiten verschieben', movePages(every(1), target, 0)],
  ];
  for (const [name, command] of cases) {
    it(`${name} unter ${LIMIT_MS} ms`, () => {
      const { ms } = timed(() => command.apply(state, ids));
      expect(ms).toBeLessThan(LIMIT_MS);
    });
  }

  it('Bereichsauswahl über alle Seiten unter der Grenze', () => {
    const first = state.docs[0]?.pages[0]?.key ?? '';
    const last = state.docs[9]?.pages[499]?.key ?? '';
    const { value, ms } = timed(() => selectRange(state, selectOnly(first), last));
    expect(value.keys.size).toBe(5000);
    expect(ms).toBeLessThan(LIMIT_MS);
  });

  it('100 Verlaufsschritte teilen unveränderte Dokumente', () => {
    let h = createHistory(state);
    const [key] = hundred;
    const { ms } = timed(() => {
      for (let i = 0; i < HISTORY_LIMIT; i++) {
        h = execute(h, rotatePages([key ?? ''], 90), ids).history;
      }
    });
    expect(ms).toBeLessThan(LIMIT_MS * 4);
    // Nur das gedrehte Dokument ist neu; die anderen neun sind dieselben Objekte.
    const [first] = h.past;
    const shared = h.present.state.docs.filter((d, i) => d === first?.state.docs[i]).length;
    expect(shared).toBe(9);
    expect(releasedSources(createHistory(state), h)).toEqual([]);
  });
});
