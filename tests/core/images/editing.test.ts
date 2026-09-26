import { describe, expect, it } from 'vitest';
import {
  centeredRect,
  cropPixels,
  cropPixelsExact,
  drawMatrix,
  rotatedSize,
  turn,
} from '../../../src/core/images/crop.ts';
import { blackAndWhite, grayscale, otsuThreshold } from '../../../src/core/images/enhance.ts';
import { blockSize, fill, pixelate } from '../../../src/core/images/obscure.ts';
import { apply, homography, outputSize, warp } from '../../../src/core/images/perspective.ts';

/** Bild mit eindeutigem Wert je Pixel: R = x, G = y */
function gradient(width: number, height: number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) data.set([x, y, 0, 255], (y * width + x) * 4);
  return data;
}

const px = (data: Uint8ClampedArray, width: number, x: number, y: number) => [
  ...data.slice((y * width + x) * 4, (y * width + x) * 4 + 4),
];

describe('crop', () => {
  it('dreht in Vierteln und tauscht Breite und Höhe', () => {
    expect(turn(0, -90)).toBe(270);
    expect(turn(270, 90)).toBe(0);
    expect(rotatedSize(4000, 3000, 90)).toEqual({ width: 3000, height: 4000 });
  });

  it('bildet die Ecken richtig ab (Drehen und Spiegeln)', () => {
    const at = (m: number[], x: number, y: number) => [
      (m[0] ?? 0) * x + (m[2] ?? 0) * y + (m[4] ?? 0),
      (m[1] ?? 0) * x + (m[3] ?? 0) * y + (m[5] ?? 0),
    ];
    // 4 × 2 Pixel, Punkt oben links des Originals
    expect(at(drawMatrix(4, 2, { rotate: 90, flip: false }), 0, 0)).toEqual([2, 0]);
    expect(at(drawMatrix(4, 2, { rotate: 180, flip: false }), 0, 0)).toEqual([4, 2]);
    expect(at(drawMatrix(4, 2, { rotate: 270, flip: false }), 0, 0)).toEqual([0, 4]);
    expect(at(drawMatrix(4, 2, { rotate: 0, flip: true }), 0, 0)).toEqual([4, 0]);
    expect(at(drawMatrix(4, 2, { rotate: 90, flip: true }), 0, 0)).toEqual([0, 0]);
  });

  it('rechnet Zuschnitte in Pixel um und findet mittige Rechtecke mit Seitenverhältnis', () => {
    expect(cropPixels({ x: 0.1, y: 0.2, w: 0.5, h: 0.5 }, 1000, 800)).toEqual({
      x: 100,
      y: 160,
      width: 500,
      height: 400,
    });
    const r = centeredRect(1, 4000, 3000);
    expect(r.w * 4000).toBeCloseTo(r.h * 3000);
    expect(r).toMatchObject({ y: 0, h: 1 });
    expect(centeredRect(null, 10, 10)).toEqual({ x: 0, y: 0, w: 1, h: 1 });
    // Quadrat bleibt Quadrat trotz Rundung (vorher 471 × 472)
    const sq = cropPixelsExact({ x: 0, y: 0.145, w: 0.98, h: 0.735 }, 480, 640, 1);
    expect(sq.width).toBe(sq.height);
    expect(cropPixelsExact({ x: 0, y: 0, w: 0.5, h: 0.5 }, 1600, 900, 16 / 9)).toMatchObject({
      width: 800,
      height: 450,
    });
  });
});

describe('obscure', () => {
  it('Blöcke richten sich nach dem Bereich: höchstens 8 über die kürzere Seite', () => {
    expect(blockSize({ x: 0, y: 0, width: 400, height: 160 })).toBe(20);
    expect(blockSize({ x: 0, y: 0, width: 3, height: 3 })).toBe(1);
  });

  it('verpixelt nur im Bereich, jeder Block einfarbig', () => {
    const data = gradient(16, 16);
    pixelate(data, 16, 16, { x: 0, y: 0, width: 8, height: 8 }, 4);
    expect(px(data, 16, 0, 0)).toEqual(px(data, 16, 3, 3));
    expect(px(data, 16, 0, 0)).toEqual([2, 2, 0, 255]); // Mittel aus 0..3 = 1,5 → 2
    expect(px(data, 16, 4, 0)).not.toEqual(px(data, 16, 0, 0));
    expect(px(data, 16, 12, 12)).toEqual([12, 12, 0, 255]);
  });

  it('füllt deckend', () => {
    const data = gradient(4, 4);
    fill(data, 4, 4, { x: 1, y: 1, width: 2, height: 2 });
    expect(px(data, 4, 1, 1)).toEqual([0, 0, 0, 255]);
    expect(px(data, 4, 3, 3)).toEqual([3, 3, 0, 255]);
  });
});

describe('perspective', () => {
  it('Homographie bildet die vier Punkte genau ab', () => {
    const from = [
      { x: 10, y: 20 },
      { x: 300, y: 5 },
      { x: 320, y: 410 },
      { x: 0, y: 400 },
    ];
    const to = [
      { x: 0, y: 0 },
      { x: 210, y: 0 },
      { x: 210, y: 297 },
      { x: 0, y: 297 },
    ];
    const h = homography(from, to);
    expect(h).not.toBeNull();
    for (let i = 0; i < 4; i++) {
      const p = apply(h ?? [1, 0, 0, 0, 1, 0, 0, 0, 1], from[i] ?? { x: 0, y: 0 });
      expect(p.x).toBeCloseTo(to[i]?.x ?? 0, 6);
      expect(p.y).toBeCloseTo(to[i]?.y ?? 0, 6);
    }
  });

  it('entzerrt ein achsenparalleles Rechteck zu einem Ausschnitt', () => {
    const data = gradient(20, 20);
    const corners = [
      { x: 5, y: 5 },
      { x: 15, y: 5 },
      { x: 15, y: 15 },
      { x: 5, y: 15 },
    ];
    expect(outputSize(corners)).toEqual({ width: 10, height: 10 });
    const out = warp(data, 20, 20, corners, { width: 10, height: 10 });
    expect(px(out, 10, 0, 0)).toEqual([5, 5, 0, 255]);
    expect(px(out, 10, 9, 9)).toEqual([14, 14, 0, 255]);
  });

  it('lehnt Ecken ab, die kein Viereck bilden', () => {
    const p = { x: 1, y: 1 };
    expect(homography([p, p, p, p], [p, { x: 2, y: 2 }, p, p])).toBeNull();
  });
});

describe('enhance', () => {
  it('Otsu trennt zwei Helligkeitsgruppen', () => {
    const hist = new Array<number>(256).fill(0);
    hist[40] = 100;
    hist[200] = 300;
    const t = otsuThreshold(hist);
    expect(t).toBeGreaterThanOrEqual(40);
    expect(t).toBeLessThan(200);
  });

  it('Schwarzweiß und Graustufen', () => {
    const data = new Uint8ClampedArray([30, 30, 30, 255, 220, 220, 220, 255, 60, 70, 50, 255]);
    const bw = data.slice();
    blackAndWhite(bw);
    expect([bw[0], bw[4], bw[8]]).toEqual([0, 255, 0]);
    grayscale(data);
    expect(data[0]).toBe(data[1]);
    expect(data[0]).toBe(0);
    expect(data[4]).toBe(255);
  });
});
