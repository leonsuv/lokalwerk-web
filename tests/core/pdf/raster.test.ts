import { describe, expect, it } from 'vitest';
import { MAX_CANVAS_PIXELS, pageImageName, rasterSize } from '../../../src/core/pdf/raster.ts';

describe('rasterSize', () => {
  it('rechnet Punkt in Pixel: DIN A4 mit 150 dpi', () => {
    // 595,28 × 841,89 pt = 210 × 297 mm
    expect(rasterSize(595.28, 841.89, 150)).toEqual({
      width: 1240,
      height: 1754,
      dpi: 150,
      reduced: false,
    });
  });

  it('DIN A4 mit 300 dpi passt noch', () => {
    const r = rasterSize(595.28, 841.89, 300);
    expect(r).toMatchObject({ width: 2480, height: 3508, reduced: false });
    expect(r.width * r.height).toBeLessThanOrEqual(MAX_CANVAS_PIXELS);
  });

  it('setzt die Auflösung bei großen Seiten herab (DIN A2 mit 300 dpi)', () => {
    const r = rasterSize(1190.55, 1683.78, 300);
    expect(r.reduced).toBe(true);
    expect(r.width * r.height).toBeLessThanOrEqual(MAX_CANVAS_PIXELS);
    expect(r.dpi).toBeGreaterThan(200);
    expect(r.dpi).toBeLessThan(300);
  });

  it('beachtet auch die längste Seite (sehr schmale, lange Seite)', () => {
    const r = rasterSize(50, 14400, 300);
    expect(r.height).toBeLessThanOrEqual(16384);
    expect(r.reduced).toBe(true);
  });
});

describe('pageImageName', () => {
  it('füllt mit Nullen auf, passend zur Seitenzahl', () => {
    expect(pageImageName('bericht', 7, 9, 'jpg')).toBe('bericht-seite-7.jpg');
    expect(pageImageName('bericht', 7, 12, 'png')).toBe('bericht-seite-07.png');
    expect(pageImageName('bericht', 12, 120, 'jpg')).toBe('bericht-seite-012.jpg');
  });
});
