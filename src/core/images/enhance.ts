/**
 * Gescannte Seiten verbessern (plan-phase2.md Vorschlag C): Graustufen mit Tonwertspreizung oder
 * Schwarzweiß mit Schwelle nach Otsu. Reine Rechnung auf RGBA-Pixeln, in place.
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

/** Schwelle nach Otsu aus einem Histogramm mit 256 Stufen */
export function otsuThreshold(hist: readonly number[]): number {
  const total = hist.reduce((a, b) => a + b, 0);
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * (hist[t] ?? 0);
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let threshold = 127;
  for (let t = 0; t < 256; t++) {
    wB += hist[t] ?? 0;
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * (hist[t] ?? 0);
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) ** 2;
    if (between > best) {
      best = between;
      threshold = t;
    }
  }
  return threshold;
}

/** Schwarzweiß: alles über der Otsu-Schwelle wird weiß */
export function blackAndWhite(rgba: Uint8ClampedArray): void {
  const hist = new Array<number>(256).fill(0);
  for (let i = 0; i < rgba.length; i += 4) {
    const l = Math.round(luma(rgba[i] ?? 0, rgba[i + 1] ?? 0, rgba[i + 2] ?? 0));
    rgba[i] = l;
    hist[l] = (hist[l] ?? 0) + 1;
  }
  const t = otsuThreshold(hist);
  for (let i = 0; i < rgba.length; i += 4) {
    const v = (rgba[i] ?? 0) > t ? 255 : 0;
    rgba[i] = v;
    rgba[i + 1] = v;
    rgba[i + 2] = v;
  }
}
