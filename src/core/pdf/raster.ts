/**
 * Pixelgröße einer gerasterten PDF-Seite (PDF zu Bildern, Schwärzen). Reine Rechnung.
 * Ein PDF-Punkt ist 1/72 Zoll (ISO 32000-2, 8.3.2.3), also Pixel = Punkt / 72 × dpi.
 */

/**
 * Obergrenze für die Fläche einer Zeichenfläche. 4096 × 4096 Pixel ist die bekannte Grenze von
 * Safari auf iPhone und iPad; darüber liefert das Canvas dort nur ein leeres Bild. Wir halten
 * sie in allen Browsern ein, damit das Ergebnis überall gleich ist.
 */
export const MAX_CANVAS_PIXELS = 4096 * 4096;
/** Längste Seite, die alle aktuellen Browser als Canvas anlegen */
export const MAX_CANVAS_SIDE = 16384;

export interface RasterSize {
  width: number;
  height: number;
  /** Tatsächlich verwendete Auflösung, ganzzahlig */
  dpi: number;
  /** Auflösung musste herabgesetzt werden */
  reduced: boolean;
}

export function rasterSize(
  widthPt: number,
  heightPt: number,
  dpi: number,
  maxPixels = MAX_CANVAS_PIXELS,
  maxSide = MAX_CANVAS_SIDE,
): RasterSize {
  const at = (d: number) => ({
    width: Math.max(1, Math.round((widthPt / 72) * d)),
    height: Math.max(1, Math.round((heightPt / 72) * d)),
  });
  let used = dpi;
  let size = at(used);
  const fits = (s: { width: number; height: number }) =>
    s.width * s.height <= maxPixels && s.width <= maxSide && s.height <= maxSide;
  if (!fits(size)) {
    const byArea = Math.sqrt(maxPixels / (size.width * size.height));
    const bySide = maxSide / Math.max(size.width, size.height);
    used = Math.max(1, Math.floor(dpi * Math.min(byArea, bySide)));
    size = at(used);
    while (!fits(size) && used > 1) size = at(--used);
  }
  return { ...size, dpi: used, reduced: used < dpi };
}
