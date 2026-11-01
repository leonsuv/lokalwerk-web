import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { interleaveOrder, interleavePdfs } from '../../../src/core/pdf/interleave.ts';

async function doc(widths: number[]): Promise<Uint8Array> {
  const d = await PDFDocument.create();
  for (const w of widths) d.addPage([w, 100]);
  return d.save();
}

describe('interleaveOrder', () => {
  it('wechselt Vorder- und Rückseite', () => {
    expect(interleaveOrder(2, 2, false)).toEqual([
      { from: 'front', index: 0 },
      { from: 'back', index: 0 },
      { from: 'front', index: 1 },
      { from: 'back', index: 1 },
    ]);
  });

  it('kehrt die Rückseiten um', () => {
    const back = interleaveOrder(3, 3, true).filter((s) => s.from === 'back');
    expect(back.map((s) => s.index)).toEqual([2, 1, 0]);
  });

  it('hängt Reste der längeren Datei an', () => {
    const steps = interleaveOrder(3, 1, false);
    expect(steps.map((s) => `${s.from[0]}${s.index}`)).toEqual(['f0', 'b0', 'f1', 'f2']);
  });

  it('jede Seite kommt genau einmal vor, auch umgekehrt und ungleich lang', () => {
    for (const [f, b] of [
      [0, 3],
      [4, 4],
      [2, 5],
    ] as const) {
      for (const rev of [false, true]) {
        const steps = interleaveOrder(f, b, rev);
        expect(steps).toHaveLength(f + b);
        expect(new Set(steps.map((s) => `${s.from}${s.index}`)).size).toBe(f + b);
      }
    }
  });
});

describe('interleavePdfs', () => {
  it('mischt die Seiten in der richtigen Reihenfolge', async () => {
    const out = await interleavePdfs(await doc([101, 102]), await doc([201, 202]), true);
    const result = await PDFDocument.load(out);
    expect(result.getPages().map((p) => p.getWidth())).toEqual([101, 202, 102, 201]);
  });
});
