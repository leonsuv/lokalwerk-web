/**
 * Bereiche unkenntlich machen: grob verpixeln oder vollständig füllen (plan-phase2.md 14).
 * Bewusst kein Weichzeichnen, weil sich weichgezeichnete Bereiche teils zurückrechnen lassen.
 * Arbeitet direkt auf RGBA-Pixeln (ImageData.data), ohne DOM.
 */

export interface PixelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Höchstens so viele Blöcke über die längere Seite des Bereichs (plan-phase2.md 14: „höchstens
 * etwa 8 Blöcke über die Breite“), damit nichts erkennbar bleibt, auch bei flachen Bereichen wie
 * einer Textzeile oder einem Kennzeichen.
 */
export const MAX_BLOCKS = 8;

/** Kantenlänge eines Blocks in Pixeln: längere Seite des Bereichs / MAX_BLOCKS, mindestens 1 */
export function blockSize(rect: PixelRect, maxBlocks = MAX_BLOCKS): number {
  return Math.max(1, Math.ceil(Math.max(rect.width, rect.height) / maxBlocks));
}

function clip(rect: PixelRect, width: number, height: number): PixelRect {
  const x = Math.max(0, Math.floor(rect.x));
  const y = Math.max(0, Math.floor(rect.y));
  return {
    x,
    y,
    width: Math.max(0, Math.min(width, Math.ceil(rect.x + rect.width)) - x),
    height: Math.max(0, Math.min(height, Math.ceil(rect.y + rect.height)) - y),
  };
}

/** Jeder Block bekommt den Mittelwert seiner Pixel. */
export function pixelate(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  area: PixelRect,
  block = blockSize(area),
): void {
  const r = clip(area, width, height);
  for (let by = r.y; by < r.y + r.height; by += block) {
    for (let bx = r.x; bx < r.x + r.width; bx += block) {
      const x1 = Math.min(bx + block, r.x + r.width);
      const y1 = Math.min(by + block, r.y + r.height);
      const sum = [0, 0, 0, 0];
      let n = 0;
      for (let y = by; y < y1; y++) {
        for (let x = bx; x < x1; x++) {
          const i = (y * width + x) * 4;
          for (let c = 0; c < 4; c++) sum[c] = (sum[c] ?? 0) + (rgba[i + c] ?? 0);
          n++;
        }
      }
      const avg = sum.map((s) => Math.round(s / n));
      for (let y = by; y < y1; y++) {
        for (let x = bx; x < x1; x++) {
          const i = (y * width + x) * 4;
          for (let c = 0; c < 4; c++) rgba[i + c] = avg[c] ?? 0;
        }
      }
    }
  }
}

/** Bereich vollständig mit einer Farbe füllen (Standard: Schwarz, deckend) */
export function fill(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  area: PixelRect,
  color: [number, number, number] = [0, 0, 0],
): void {
  const r = clip(area, width, height);
  for (let y = r.y; y < r.y + r.height; y++) {
    for (let x = r.x; x < r.x + r.width; x++) {
      const i = (y * width + x) * 4;
      rgba[i] = color[0];
      rgba[i + 1] = color[1];
      rgba[i + 2] = color[2];
      rgba[i + 3] = 255;
    }
  }
}
