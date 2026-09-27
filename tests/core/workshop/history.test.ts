import { describe, expect, it } from 'vitest';
import {
  addSources,
  deletePages,
  movePages,
  rotatePages,
  type Command,
} from '../../../src/core/workshop/commands.ts';
import {
  canRedo,
  canUndo,
  createHistory,
  execute,
  HISTORY_LIMIT,
  liveSources,
  redo,
  redoLabel,
  releasedSources,
  undo,
  undoLabel,
  type History,
} from '../../../src/core/workshop/history.ts';
import { counterIds } from '../../../src/core/workshop/model.ts';
import { keysOf, pdfSource, seeded } from './helpers.ts';

function run(history: History, ids: ReturnType<typeof counterIds>, ...commands: Command[]) {
  let h = history;
  for (const c of commands) h = execute(h, c, ids).history;
  return h;
}

describe('Verlauf', () => {
  it('Rückgängig ergibt den alten Zustand, Wiederholen den neuen (dieselben Objekte)', () => {
    const ids = counterIds();
    const h0 = run(createHistory(), ids, addSources([pdfSource('a', 3)]));
    const doc = h0.present.state.docs[0]?.id ?? '';
    const h1 = run(h0, ids, movePages(keysOf(h0.present.state, 0, 2), doc, 0));
    expect(undoLabel(h1)).toBe('Verschieben');
    const back = undo(h1);
    expect(back.present.state).toBe(h0.present.state);
    expect(redoLabel(back)).toBe('Verschieben');
    expect(redo(back).present.state).toBe(h1.present.state);
  });

  it('legt für Befehle ohne Wirkung keinen Schritt an und behält Wiederholen', () => {
    const ids = counterIds();
    const h = undo(run(createHistory(), ids, addSources([pdfSource('a', 1)]), newRotate()));
    expect(canRedo(h)).toBe(true);
    const same = execute(h, deletePages(['unbekannt']), ids).history;
    expect(same).toBe(h);
    expect(canRedo(same)).toBe(true);

    function newRotate(): Command {
      return {
        label: 'Drehen',
        apply: (state, i) => rotatePages(keysOf(state, 0, 0), 90).apply(state, i),
      };
    }
  });

  it('ein neuer Befehl verwirft Wiederholen', () => {
    const ids = counterIds();
    const h = undo(run(createHistory(), ids, addSources([pdfSource('a', 2)]), addSources([])));
    const after = run(h, ids, addSources([pdfSource('b', 1)]));
    expect(canRedo(after)).toBe(false);
  });

  it('ohne Schritte tun Rückgängig und Wiederholen nichts', () => {
    const h = createHistory();
    expect(canUndo(h)).toBe(false);
    expect(undoLabel(h)).toBeNull();
    expect(redoLabel(h)).toBeNull();
    expect(undo(h)).toBe(h);
    expect(redo(h)).toBe(h);
  });

  it('hält höchstens 100 Schritte und merkt, dass ältere wegfallen', () => {
    const ids = counterIds();
    let h = run(createHistory(), ids, addSources([pdfSource('a', 1)]));
    const key = keysOf(h.present.state, 0, 0)[0] ?? '';
    for (let i = 0; i < HISTORY_LIMIT; i++) h = run(h, ids, rotatePages([key], 90));
    expect(h.past.length).toBe(HISTORY_LIMIT);
    expect(h.truncated).toBe(true);
    for (let i = 0; i < HISTORY_LIMIT; i++) h = undo(h);
    expect(canUndo(h)).toBe(false);
    // Der Stand nach dem Hinzufügen ist noch da, der leere Anfang nicht mehr.
    expect(h.present.state.docs).toHaveLength(1);
  });

  it('Eigenschaft: n-mal Rückgängig und n-mal Wiederholen führt durch dieselben Zustände', () => {
    const ids = counterIds();
    const random = seeded(7);
    let h = run(createHistory(), ids, addSources([pdfSource('a', 8), pdfSource('b', 5)]));
    const states = [h.present.state];
    for (let i = 0; i < 60; i++) {
      const state = h.present.state;
      const keys = [...state.docs.flatMap((d) => d.pages.map((p) => p.key))].filter(
        () => random() < 0.3,
      );
      const doc = state.docs[Math.floor(random() * state.docs.length)]?.id ?? '';
      const next = execute(h, movePages(keys, doc, Math.floor(random() * 10)), ids).history;
      if (next !== h) states.push(next.present.state);
      h = next;
    }
    for (let i = states.length - 1; i > 0; i--) {
      expect(h.present.state).toBe(states[i]);
      h = undo(h);
    }
    expect(h.present.state).toBe(states[0]);
    for (let i = 1; i < states.length; i++) {
      h = redo(h);
      expect(h.present.state).toBe(states[i]);
    }
  });
});

describe('Quellen freigeben', () => {
  it('gibt eine Quelle erst frei, wenn kein Zustand im Verlauf mehr auf sie verweist', () => {
    const ids = counterIds();
    let h = run(
      createHistory(undefined, 3),
      ids,
      addSources([pdfSource('a', 1), pdfSource('b', 1)]),
    );
    const bKey = keysOf(h.present.state, 1, 0);
    const before = h;
    h = run(h, ids, deletePages(bKey));
    // Rückgängig kann b zurückholen: noch nicht frei
    expect(releasedSources(before, h)).toEqual([]);
    expect(liveSources(h).has('b')).toBe(true);
    const aKey = keysOf(h.present.state, 0, 0)[0] ?? '';
    for (let i = 0; i < 2; i++) {
      const prev = h;
      h = run(h, ids, rotatePages([aKey], 90));
      expect(releasedSources(prev, h)).toEqual([]);
    }
    // Der dritte Schritt schiebt den letzten Zustand mit b aus dem Verlauf.
    const prev = h;
    h = run(h, ids, rotatePages([aKey], 90));
    expect(releasedSources(prev, h)).toEqual(['b']);
  });

  it('hält Quellen der internen Ablage fest', () => {
    const ids = counterIds();
    const h0 = run(createHistory(undefined, 1), ids, addSources([pdfSource('a', 1)]));
    const h1 = run(h0, ids, deletePages(keysOf(h0.present.state, 0, 0)));
    const h2 = run(h1, ids, addSources([pdfSource('c', 1)]));
    expect(releasedSources(h1, h2, ['a'])).toEqual([]);
    expect(releasedSources(h1, h2)).toEqual(['a']);
  });
});
