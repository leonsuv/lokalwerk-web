import { describe, expect, it } from 'vitest';
import { inkRatios, inkRatio, isBlank } from '../../../src/core/pdf/blank-page.ts';

const W = 100;
const H = 100;

function page(fill: number, paint?: (set: (x: number, y: number, v: number) => void) => void) {
  const px = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < px.length; i += 4) px.set([fill, fill, fill, 255], i);
  paint?.((x, y, v) => px.set([v, v, v, 255], (y * W + x) * 4));
  return px;
}

describe('inkRatio', () => {
  it('weiße Seite hat keine Spur', () => {
    const px = page(255);
    expect(inkRatios(px, W, H)).toEqual({ strict: 0, normal: 0, loose: 0 });
    expect(isBlank(inkRatios(px, W, H), 'strict')).toBe(true);
  });

  it('streng sieht ein einzelnes graues Pixel, normal nicht', () => {
    const px = page(255, (set) => set(50, 50, 240));
    const r = inkRatios(px, W, H);
    expect(isBlank(r, 'strict')).toBe(false);
    expect(isBlank(r, 'normal')).toBe(true);
  });

  it('Randschatten zählt nur bei streng', () => {
    const px = page(255, (set) => {
      for (let y = 0; y < H; y++) set(0, y, 60);
    });
    const r = inkRatios(px, W, H);
    expect(isBlank(r, 'strict')).toBe(false);
    expect(isBlank(r, 'normal')).toBe(true);
    expect(isBlank(r, 'loose')).toBe(true);
  });

  it('Text im Feld macht die Seite in jeder Stufe nicht leer', () => {
    const px = page(255, (set) => {
      for (let x = 20; x < 80; x++) for (let y = 40; y < 44; y++) set(x, y, 0);
    });
    const r = inkRatios(px, W, H);
    for (const level of ['strict', 'normal', 'loose'] as const) {
      expect(isBlank(r, level)).toBe(false);
    }
  });

  it('lockere Stufe erlaubt ein wenig Staub', () => {
    const px = page(255, (set) => {
      for (let i = 0; i < 4; i++) set(30 + i * 10, 50, 100);
    });
    const r = inkRatios(px, W, H);
    expect(isBlank(r, 'normal')).toBe(false);
    expect(isBlank(r, 'loose')).toBe(true);
  });

  it('durchsichtige Pixel gelten als weiß', () => {
    const px = new Uint8ClampedArray(W * H * 4);
    expect(inkRatio(px, W, H, 'strict')).toBe(0);
  });

  it('leere Fläche ergibt 0', () => {
    expect(inkRatio(new Uint8ClampedArray(0), 0, 0, 'normal')).toBe(0);
  });
});
