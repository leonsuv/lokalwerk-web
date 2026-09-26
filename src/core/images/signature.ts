/**
 * Bild einer Unterschrift aufbereiten (Werkzeug „Unterschrift einfügen“). Reine Rechnung auf
 * RGBA-Pixeln, ohne Canvas: weißen Hintergrund durchsichtig machen und auf die Schrift zuschneiden.
 */

/**
 * Macht hellen Hintergrund durchsichtig, zum Beispiel beim Foto einer Unterschrift auf Papier.
 * Ab `light` (Helligkeit 0–255) ganz durchsichtig, unter `dark` ganz deckend, dazwischen weich.
 */
export function whiteToTransparent(rgba: Uint8ClampedArray, light = 215, dark = 140): void {
  for (let i = 0; i < rgba.length; i += 4) {
    const lum = 0.299 * (rgba[i] ?? 0) + 0.587 * (rgba[i + 1] ?? 0) + 0.114 * (rgba[i + 2] ?? 0);
    const cover = lum >= light ? 0 : lum <= dark ? 1 : (light - lum) / (light - dark);
    rgba[i + 3] = Math.round((rgba[i + 3] ?? 255) * cover);
  }
}

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Rechteck um alle sichtbaren Pixel (Deckkraft über `minAlpha`), mit Rand; null, wenn leer. */
export function inkBounds(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  padding = 4,
  minAlpha = 16,
): Bounds | null {
  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if ((rgba[(y * width + x) * 4 + 3] ?? 0) <= minAlpha) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return null;
  const x = Math.max(0, x0 - padding);
  const y = Math.max(0, y0 - padding);
  return {
    x,
    y,
    width: Math.min(width, x1 + 1 + padding) - x,
    height: Math.min(height, y1 + 1 + padding) - y,
  };
}
