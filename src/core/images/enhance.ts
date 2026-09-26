/**
 * Gescannte Seiten verbessern (plan-phase2.md Vorschlag C): Graustufen mit Tonwertspreizung oder
 * Schwarzweiß mit örtlicher Schwelle. Reine Rechnung auf RGBA-Pixeln, in place.
 */

const luma = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;

/** Graustufen; die hellsten und dunkelsten 1 % werden auf Weiß und Schwarz gespreizt */
export function grayscale(rgba: Uint8ClampedArray): void {
  const hist = new Array<number>(256).fill(0);
  const n = rgba.length / 4;
  for (let i = 0; i < rgba.length; i += 4) {
    const l = Math.round(luma(rgba[i] ?? 0, rgba[i + 1] ?? 0, rgba[i + 2] ?? 0));
    rgba[i] = l;
    hist[l] = (hist[l] ?? 0) + 1;
  }
  const cut = n * 0.01;
  let lo = 0;
  for (let acc = 0; lo < 255 && (acc += hist[lo] ?? 0) <= cut; lo++);
  let hi = 255;
  for (let acc = 0; hi > 0 && (acc += hist[hi] ?? 0) <= cut; hi--);
  const span = Math.max(1, hi - lo);
  for (let i = 0; i < rgba.length; i += 4) {
    const v = Math.min(255, Math.max(0, (((rgba[i] ?? 0) - lo) * 255) / span));
    rgba[i] = v;
    rgba[i + 1] = v;
    rgba[i + 2] = v;
  }
}

/** Fenster für die örtliche Schwelle: ein Sechzehntel der längeren Bildseite */
const WINDOW_SHARE = 1 / 16;
/** Ein Punkt wird schwarz, wenn er mindestens 15 % dunkler ist als seine Umgebung */
const DARKER_BY = 0.15;

/**
 * Schwarzweiß mit örtlicher Schwelle (Bradley und Roth, „Adaptive Thresholding Using the Integral
 * Image“, 2007): Jeder Punkt wird mit dem Mittel seiner Umgebung verglichen, nicht mit einer
 * Schwelle für das ganze Bild. So bleibt Text auch in Schattenbereichen eines Handyfotos lesbar.
 */
export function blackAndWhite(rgba: Uint8ClampedArray, width: number, height: number): void {
  // Summenbild der Helligkeit, eine Zeile und Spalte größer (Float64 wegen der Größe der Summen)
  const stride = width + 1;
  const integral = new Float64Array(stride * (height + 1));
  for (let y = 0; y < height; y++) {
    let row = 0;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const l = luma(rgba[i] ?? 0, rgba[i + 1] ?? 0, rgba[i + 2] ?? 0);
      rgba[i] = l;
      row += l;
      integral[(y + 1) * stride + x + 1] = (integral[y * stride + x + 1] ?? 0) + row;
    }
  }
  const half = Math.max(1, Math.round((Math.max(width, height) * WINDOW_SHARE) / 2));
  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - half);
    const y1 = Math.min(height, y + half + 1);
    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - half);
      const x1 = Math.min(width, x + half + 1);
      const sum =
        (integral[y1 * stride + x1] ?? 0) -
        (integral[y0 * stride + x1] ?? 0) -
        (integral[y1 * stride + x0] ?? 0) +
        (integral[y0 * stride + x0] ?? 0);
      const mean = sum / ((x1 - x0) * (y1 - y0));
      const i = (y * width + x) * 4;
      const v = (rgba[i] ?? 0) < mean * (1 - DARKER_BY) ? 0 : 255;
      rgba[i] = v;
      rgba[i + 1] = v;
      rgba[i + 2] = v;
    }
  }
}
