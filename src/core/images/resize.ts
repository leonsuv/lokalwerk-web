/** Reine Rechenregeln für „Fotos verkleinern“: Zielgröße, Dateiname, Ersparnis. */

export type OutputType = 'image/jpeg' | 'image/webp';

const EXTENSIONS: Record<OutputType, string> = { 'image/jpeg': 'jpg', 'image/webp': 'webp' };

export interface Size {
  width: number;
  height: number;
}

/**
 * Begrenzt die Breite wie im Prototyp: Hochformate werden also entsprechend höher.
 * `maxWidth` 0 heißt Originalgröße. Nie vergrößern, nie unter 1 px.
 */
export function targetSize(width: number, height: number, maxWidth: number): Size {
  if (!(width > 0 && height > 0)) throw new RangeError(`Ungültige Bildgröße ${width}×${height}`);
  if (maxWidth <= 0 || width <= maxWidth) return { width, height };
  return { width: maxWidth, height: Math.max(1, Math.round((height * maxWidth) / width)) };
}

/** „Urlaub 2026.HEIC“ → „Urlaub 2026-klein.jpg“ */
export function outputName(name: string, type: OutputType): string {
  const base = name.replace(/\.[^./\\]+$/, '').trim() || 'foto';
  return `${base}-klein.${EXTENSIONS[type]}`;
}

/** Ersparnis in ganzen Prozent; 0 oder negativ heißt „nicht kleiner“. */
export function savedPercent(inputBytes: number, outputBytes: number): number {
  if (inputBytes <= 0) return 0;
  return Math.round((1 - outputBytes / inputBytes) * 100);
}
