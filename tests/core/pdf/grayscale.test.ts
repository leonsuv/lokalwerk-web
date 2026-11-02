import { describe, expect, it } from 'vitest';
import { grayscaleRgba, luminance } from '../../../src/core/pdf/grayscale.ts';

describe('luminance (ITU-R BT.601, 0,299 / 0,587 / 0,114)', () => {
  it('Schwarz und Weiß bleiben so', () => {
    expect(luminance(0, 0, 0)).toBe(0);
    expect(luminance(255, 255, 255)).toBe(255);
  });

  it('Grundfarben haben die Gewichte der Norm', () => {
    // 0,299 × 255 = 76,245
    expect(luminance(255, 0, 0)).toBe(76);
    // 0,587 × 255 = 149,685
    expect(luminance(0, 255, 0)).toBe(150);
    // 0,114 × 255 = 29,07
    expect(luminance(0, 0, 255)).toBe(29);
  });

  it('Graustufen bleiben unverändert', () => {
    expect(luminance(128, 128, 128)).toBe(128);
    expect(luminance(1, 1, 1)).toBe(1);
  });

  it('rundet kaufmännisch', () => {
    // 2,99 + 11,74 + 3,42 = 18,15 → 18
    expect(luminance(10, 20, 30)).toBe(18);
    // 29,9 + 117,4 + 5,7 = 153,0 → 153
    expect(luminance(100, 200, 50)).toBe(153);
  });
});

describe('grayscaleRgba', () => {
  it('setzt Rot, Grün und Blau auf die Helligkeit, lässt den Alphawert stehen', () => {
    const data = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 128]);
    grayscaleRgba(data);
    expect(Array.from(data)).toEqual([76, 76, 76, 255, 150, 150, 150, 128]);
  });

  it('lässt Weiß weiß', () => {
    const data = new Uint8Array(8).fill(255);
    grayscaleRgba(data);
    expect(Array.from(data)).toEqual(new Array(8).fill(255));
  });
});
