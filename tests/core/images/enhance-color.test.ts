import { describe, expect, it } from 'vitest';
import { stretchColor } from '../../../src/core/images/enhance.ts';

/** n Bildpunkte, Werte nacheinander aus der Liste (r, g, b), Alpha 255 */
function image(
  values: readonly (readonly [number, number, number])[],
  repeat = 1,
): Uint8ClampedArray {
  const out: number[] = [];
  for (let k = 0; k < repeat; k++) for (const [r, g, b] of values) out.push(r, g, b, 255);
  return new Uint8ClampedArray(out);
}

describe('stretchColor', () => {
  it('spreizt ein blasses Bild auf den vollen Bereich', () => {
    // Grautöne zwischen 100 und 180, nichts Dunkles und nichts Helles
    const px = image(
      [
        [100, 100, 100],
        [140, 140, 140],
        [180, 180, 180],
      ],
      40,
    );
    stretchColor(px);
    const lumas = Array.from({ length: px.length / 4 }, (_, i) => px[i * 4] ?? 0);
    expect(Math.min(...lumas)).toBe(0);
    expect(Math.max(...lumas)).toBe(255);
  });

  it('verschiebt Farbtöne nicht: ein getönter Punkt zwischen Dunkel und Hell behält seine Abstände', () => {
    // Je 50 neutrale Punkte als Grenzen (mehr als 1 %), dazu ein getönter Punkt in der Mitte
    const px = image(
      [
        [80, 80, 80],
        [200, 200, 200],
      ],
      50,
    );
    const tinted = new Uint8ClampedArray([...px, 130, 140, 150, 255]);
    stretchColor(tinted);
    const i = tinted.length - 4;
    const dRG = (tinted[i + 1] ?? 0) - (tinted[i] ?? 0);
    const dGB = (tinted[i + 2] ?? 0) - (tinted[i + 1] ?? 0);
    expect(Math.abs(dRG - dGB)).toBeLessThanOrEqual(1);
    expect(dRG).toBeGreaterThan(18);
  });

  it('lässt Bilder mit vollem Kontrast und fast einfarbige Flächen unverändert', () => {
    const full = image(
      [
        [0, 0, 0],
        [255, 255, 255],
        [128, 128, 128],
      ],
      50,
    );
    const copy = new Uint8ClampedArray(full);
    stretchColor(full);
    expect(full).toEqual(copy);
    const flat = image([[120, 121, 122]], 100);
    const flatCopy = new Uint8ClampedArray(flat);
    stretchColor(flat);
    expect(flat).toEqual(flatCopy);
  });

  it('lässt den Alphakanal in Ruhe', () => {
    const px = image(
      [
        [100, 100, 100],
        [180, 180, 180],
      ],
      50,
    );
    stretchColor(px);
    expect(px[3]).toBe(255);
  });
});
