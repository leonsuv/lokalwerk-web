/**
 * Leere Seiten erkennen (Werkzeug „Leere Seiten entfernen“). Die Seite wird klein gezeichnet;
 * hier wird gezählt, wie viel davon nicht weiß ist. Reine Rechnung auf RGBA-Pixeln.
 *
 * Die Stufen unterscheiden sich in drei Dingen: wie dunkel ein Pixel sein muss, um als Spur zu
 * gelten (`light`), wie breit der Rand ist, der nicht zählt (Lochung, Scannerschatten), und wie
 * viel Spur erlaubt ist (`ratio`, Anteil der gezählten Fläche). Die Zahlen sind Erfahrungswerte
 * für Scans bei etwa 400 Pixeln Seitenlänge, keine Norm; die Seite zeigt deshalb jede Seite zur
 * Kontrolle und lässt sie von Hand umstellen.
 */

export type BlankLevel = 'strict' | 'normal' | 'loose';

export interface LevelRule {
  /** Pixel mit einer Helligkeit unter diesem Wert (0 bis 255) zählen als Spur */
  light: number;
  /** Rand in Anteilen der Seitenbreite und -höhe, der nicht gezählt wird */
  margin: number;
  /** Anteil Spur, bis zu dem die Seite noch als leer gilt */
  ratio: number;
}

export const LEVELS: Readonly<Record<BlankLevel, LevelRule>> = {
  strict: { light: 250, margin: 0, ratio: 0 },
  normal: { light: 215, margin: 0.04, ratio: 0.0001 },
  loose: { light: 190, margin: 0.07, ratio: 0.001 },
};

export const LEVEL_ORDER: readonly BlankLevel[] = ['strict', 'normal', 'loose'];

/** Anteil der Spur-Pixel im gezählten Bereich für eine Stufe */
export function inkRatio(
  rgba: ArrayLike<number>,
  width: number,
  height: number,
  level: BlankLevel,
): number {
  const { light, margin } = LEVELS[level];
  const x0 = Math.floor(width * margin);
  const y0 = Math.floor(height * margin);
  const x1 = width - x0;
  const y1 = height - y0;
  let counted = 0;
  let ink = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * width + x) * 4;
      const alpha = (rgba[i + 3] ?? 255) / 255;
      // Durchsichtige Pixel gelten als weiß: auf Papier ist dort nichts.
      const mix = (c: number): number => (rgba[i + c] ?? 255) * alpha + 255 * (1 - alpha);
      const luminance = 0.2126 * mix(0) + 0.7152 * mix(1) + 0.0722 * mix(2);
      counted += 1;
      if (luminance < light) ink += 1;
    }
  }
  return counted === 0 ? 0 : ink / counted;
}

/** Spur-Anteil für alle Stufen in einem Durchgang über die Seite */
export function inkRatios(
  rgba: ArrayLike<number>,
  width: number,
  height: number,
): Record<BlankLevel, number> {
  return {
    strict: inkRatio(rgba, width, height, 'strict'),
    normal: inkRatio(rgba, width, height, 'normal'),
    loose: inkRatio(rgba, width, height, 'loose'),
  };
}

export function isBlank(ratios: Record<BlankLevel, number>, level: BlankLevel): boolean {
  return ratios[level] <= LEVELS[level].ratio;
}
