/**
 * Farbkontrast nach WCAG 2.2 (W3C Recommendation, 12. Dezember 2024), Werkzeug
 * „Kontrast prüfen“ (plan-phase2.md 30).
 *
 * - relative Leuchtdichte: L = 0.2126·R + 0.7152·G + 0.0722·B, mit
 *   R = RsRGB/12.92 für RsRGB ≤ 0.04045, sonst ((RsRGB+0.055)/1.055)^2.4 (Definition
 *   „relative luminance“)
 * - Kontrastverhältnis: (L1 + 0.05) / (L2 + 0.05), L1 die hellere Farbe (Definition
 *   „contrast ratio“)
 * - Schwellen: 1.4.3 (AA) 4,5:1, großer Text 3:1; 1.4.6 (AAA) 7:1, großer Text 4,5:1;
 *   1.4.11 (AA) Bedienelemente und Grafiken 3:1. Großer Text: ab 18 Punkt, fett ab 14 Punkt.
 */

export interface Rgba {
  /** 0–255 */
  r: number;
  g: number;
  b: number;
  /** 0–1 */
  a: number;
}

function channel(value8bit: number): number {
  const c = value8bit / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance({ r, g, b }: Rgba): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: Rgba, b: Rgba): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Halbtransparente Farbe über einem deckenden Hintergrund, wie der Browser sie mischt. */
export function composite(front: Rgba, back: Rgba): Rgba {
  const mix = (f: number, b: number) => f * front.a + b * (1 - front.a);
  return { r: mix(front.r, back.r), g: mix(front.g, back.g), b: mix(front.b, back.b), a: 1 };
}

export interface Assessment {
  ratio: number;
  /** 1.4.3, normaler Text (AA) */
  aa: boolean;
  /** 1.4.3, großer Text (AA) */
  aaLarge: boolean;
  /** 1.4.6, normaler Text (AAA) */
  aaa: boolean;
  /** 1.4.6, großer Text (AAA) */
  aaaLarge: boolean;
  /** 1.4.11, Bedienelemente und Grafiken (AA) */
  nonText: boolean;
}

/** Nicht runden: 4,499:1 erfüllt 4,5:1 nicht. */
export function assess(text: Rgba, background: Rgba): Assessment {
  const ratio = contrastRatio(text.a < 1 ? composite(text, background) : text, background);
  return {
    ratio,
    aa: ratio >= 4.5,
    aaLarge: ratio >= 3,
    aaa: ratio >= 7,
    aaaLarge: ratio >= 4.5,
    nonText: ratio >= 3,
  };
}

/** „4,53:1“ – auf zwei Stellen abgerundet, damit die Anzeige nie mehr verspricht als erreicht ist */
export function formatRatio(ratio: number): string {
  const floored = Math.floor(ratio * 100) / 100;
  return `${floored.toFixed(2).replace('.', ',')}:1`;
}
