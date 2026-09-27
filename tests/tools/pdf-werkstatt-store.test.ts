import { describe, expect, it } from 'vitest';
import {
  addSources,
  deletePages,
  duplicatePages,
  rotatePages,
  toClipboard,
} from '../../src/core/workshop/commands.ts';
import { selectKeys } from '../../src/core/workshop/selection.ts';
import { WorkshopStore, type Change } from '../../src/tools/pdf-werkstatt/store.ts';
import { keysOf, pdfSource } from '../core/workshop/helpers.ts';

function setup() {
  const released: string[][] = [];
  const changes: Change['kind'][] = [];
  const store = new WorkshopStore((ids) => released.push(ids));
  store.subscribe((c) => changes.push(c.kind));
  return { store, released, changes };
}

describe('WorkshopStore', () => {
  it('führt Befehle aus, wählt neue Seiten aus und meldet Änderungen', () => {
    const { store, changes } = setup();
    store.run(addSources([pdfSource('a', 2)]));
    store.run(duplicatePages(keysOf(store.state, 0, 0)));
    expect([...store.selection.keys]).toEqual(keysOf(store.state, 0, 1));
    // Befehl ohne Wirkung: keine Meldung
    store.run(deletePages(['unbekannt']));
    expect(changes).toEqual(['command', 'command']);
    expect(store.undoLabel).toBe('Duplizieren');
  });

  it('bereinigt die Auswahl nach Rückgängig und Löschen', () => {
    const { store } = setup();
    store.run(addSources([pdfSource('a', 3)]));
    const [first, second] = keysOf(store.state, 0, 0, 1);
    store.select(selectKeys([first ?? '', second ?? '']));
    store.run(deletePages([first ?? '']));
    expect([...store.selection.keys]).toEqual([second]);
    store.undo();
    expect([...store.selection.keys]).toEqual([second]);
  });

  it('gibt Quellen frei, sobald weder Verlauf noch Ablage sie brauchen', () => {
    const { store, released } = setup();
    store.run(addSources([pdfSource('a', 1), pdfSource('b', 1)]));
    const bKey = keysOf(store.state, 1, 0);
    store.setClipboard(toClipboard(store.state, bKey));
    store.run(deletePages(bKey));
    // b steht noch im Verlauf: Rückgängig kann es zurückholen
    expect(released).toEqual([]);
    const aKey = keysOf(store.state, 0, 0);
    for (let i = 0; i < 101; i++) store.run(rotatePages(aKey, 90));
    // Verlauf enthält b nicht mehr, die Ablage aber schon
    expect(released).toEqual([]);
    store.setClipboard(null);
    expect(released).toEqual([['b']]);
  });

  it('merkt Änderungen seit dem letzten Speichern', () => {
    const { store } = setup();
    expect(store.dirty).toBe(false);
    store.run(addSources([pdfSource('a', 1)]));
    expect(store.dirty).toBe(true);
    store.markSaved();
    expect(store.dirty).toBe(false);
    store.run(rotatePages(keysOf(store.state, 0, 0), 90));
    expect(store.dirty).toBe(true);
    store.undo();
    expect(store.dirty).toBe(false);
  });
});
