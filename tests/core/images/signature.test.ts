import { describe, expect, it } from 'vitest';
import { inkBounds, whiteToTransparent } from '../../../src/core/images/signature.ts';

const pixels = (...rgb: [number, number, number][]) =>
  new Uint8ClampedArray(rgb.flatMap(([r, g, b]) => [r, g, b, 255]));

describe('whiteToTransparent', () => {
  it('macht Weiß durchsichtig, lässt Dunkles deckend und blendet dazwischen', () => {
    const data = pixels([255, 255, 255], [230, 230, 230], [20, 20, 80], [178, 178, 178]);
    whiteToTransparent(data);
    expect([data[3], data[7], data[11]]).toEqual([0, 0, 255]);
    expect(data[15]).toBeGreaterThan(0);
    expect(data[15]).toBeLessThan(255);
    // Farbe bleibt, nur die Deckkraft ändert sich
    expect([data[8], data[9], data[10]]).toEqual([20, 20, 80]);
  });
});

describe('inkBounds', () => {
  it('findet die Schrift und lässt einen Rand', () => {
    const w = 10;
    const h = 6;
    const data = new Uint8ClampedArray(w * h * 4);
    for (const [x, y] of [
      [3, 2],
      [6, 3],
    ]) {
      data[((y ?? 0) * w + (x ?? 0)) * 4 + 3] = 255;
    }
    expect(inkBounds(data, w, h, 1)).toEqual({ x: 2, y: 1, width: 6, height: 4 });
    expect(inkBounds(data, w, h, 10)).toEqual({ x: 0, y: 0, width: 10, height: 6 });
  });

  it('meldet eine leere Fläche', () => {
    expect(inkBounds(new Uint8ClampedArray(16), 2, 2)).toBeNull();
  });
});
