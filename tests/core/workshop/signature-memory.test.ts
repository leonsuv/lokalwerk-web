/**
 * Das Bild einer Unterschrift liegt direkt in der Seiten-Operation (plan-phase3.md 17,
 * Abweichung). Dieser Test belegt, dass es trotzdem nur einmal im Speicher liegt: Duplizieren,
 * Kopieren, Teilen, Zusammenführen, die interne Ablage und 100 Verlaufsschritte teilen dieselben
 * Bytes, statt sie zu kopieren.
 */

import { describe, expect, it } from 'vitest';
import {
  addSources,
  copyPages,
  duplicateDoc,
  duplicatePages,
  extractToNewDoc,
  mergeDocs,
  movePages,
  pastePages,
  rotatePages,
  setSignatures,
  splitDoc,
  toClipboard,
  type Clipboard,
  type Command,
} from '../../../src/core/workshop/commands.ts';
import {
  createHistory,
  execute,
  HISTORY_LIMIT,
  redo,
  undo,
  type History,
} from '../../../src/core/workshop/history.ts';
import {
  allPages,
  counterIds,
  signaturesOf,
  type SignatureImage,
  type WorkshopState,
} from '../../../src/core/workshop/model.ts';
import { pdfSource, seeded } from './helpers.ts';

/** Alle Byte-Puffer, die von `roots` aus erreichbar sind (Objekte, Arrays, Maps, Sets) */
function reachableBuffers(...roots: unknown[]): Set<ArrayBufferLike> {
  const buffers = new Set<ArrayBufferLike>();
  const seen = new Set<object>();
  const stack = [...roots];
  while (stack.length > 0) {
    const value = stack.pop();
    if (typeof value !== 'object' || value === null || seen.has(value)) continue;
    seen.add(value);
    if (ArrayBuffer.isView(value)) {
      buffers.add(value.buffer);
      continue;
    }
    if (value instanceof ArrayBuffer) {
      buffers.add(value);
      continue;
    }
    if (value instanceof Map) {
      for (const [k, v] of value) stack.push(k, v);
      continue;
    }
    if (value instanceof Set) {
      for (const v of value) stack.push(v);
      continue;
    }
    for (const v of Object.values(value)) stack.push(v);
  }
  return buffers;
}

function statesOf(h: History): WorkshopState[] {
  return [...h.past, h.present, ...h.future].map((e) => e.state);
}

function signedPages(states: readonly WorkshopState[]): number {
  let n = 0;
  for (const state of states)
    for (const { page } of allPages(state)) if (signaturesOf(page).length) n++;
  return n;
}

describe('Unterschriftsbild im Speicher (Stufe 2.2)', () => {
  it('liegt nur einmal vor, auch auf vielen Seiten, in 100 Verlaufsschritten und in der Ablage', () => {
    const ids = counterIds();
    const png = new Uint8Array(200_000).fill(7);
    const image: SignatureImage = { id: 'g1', png, width: 400, height: 120 };
    let h = createHistory();
    const run = (command: Command) => {
      h = execute(h, command, ids).history;
    };
    const state = () => h.present.state;
    const docId = (i: number) => state().docs[i]?.id ?? '';
    const keys = (doc: number) => state().docs[doc]?.pages.map((p) => p.key) ?? [];

    run(addSources([pdfSource('a', 4), pdfSource('b', 2)]));
    const first = keys(0)[0] ?? '';
    run(setSignatures(first, image, [{ x: 0.5, y: 0.8, w: 0.3, h: 0.08 }]));
    // Dieselbe Unterschrift nur verschoben (so übergibt die Werkstatt ein vorhandenes Bild)
    run(setSignatures(first, image, [{ x: 0.1, y: 0.8, w: 0.3, h: 0.08 }]));

    let clipboard: Clipboard | null = null;
    const random = seeded(22);
    // Deutlich mehr Schritte als die Verlaufsgrenze, mit allen Wegen, auf denen Seiten kopiert werden
    for (let step = 0; step < HISTORY_LIMIT * 2; step++) {
      const signed = [...allPages(state())]
        .filter(({ page }) => signaturesOf(page).length > 0)
        .map(({ page }) => page.key);
      const pick = signed[Math.floor(random() * signed.length)] ?? first;
      const target = docId(Math.floor(random() * state().docs.length));
      switch (step % 9) {
        case 0:
          run(duplicatePages([pick]));
          break;
        case 1:
          run(copyPages([pick], target, 0));
          break;
        case 2:
          clipboard = toClipboard(state(), [pick]);
          break;
        case 3:
          if (clipboard) run(pastePages(clipboard, target, 1));
          break;
        case 4:
          run(rotatePages([pick], 90));
          break;
        case 5:
          if (state().docs.length < 8) run(duplicateDoc(docId(0), 'Kopie'));
          else run(mergeDocs([docId(0), docId(1)]));
          break;
        case 6:
          if ((state().docs[0]?.pages.length ?? 0) > 1) run(splitDoc(docId(0), 1, 'Teil'));
          break;
        case 7:
          run(extractToNewDoc([pick], 'Auszug', 'copy'));
          break;
        default:
          run(movePages([pick], target, 0));
      }
    }
    for (let i = 0; i < 40; i++) h = undo(h);
    for (let i = 0; i < 15; i++) h = redo(h);

    const states = statesOf(h);
    // Volle Verlaufsgrenze: 100 Schritte zurück und vorwärts zusammen, ältere fielen weg
    expect(h.past.length + h.future.length).toBe(HISTORY_LIMIT);
    expect(h.truncated).toBe(true);
    // Die Unterschrift steht auf vielen Seiten in vielen Zuständen …
    expect(signedPages(states)).toBeGreaterThan(1000);
    // … und alle verweisen auf dasselbe Bildobjekt und dieselben Bytes.
    const images = new Set<SignatureImage>();
    for (const s of states)
      for (const { page } of allPages(s)) for (const op of signaturesOf(page)) images.add(op.image);
    expect(images).toEqual(new Set([image]));
    expect(reachableBuffers(h, clipboard)).toEqual(new Set([png.buffer]));
  });
});
