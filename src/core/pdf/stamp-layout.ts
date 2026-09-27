/**
 * Lage, Größe und Farbe eines Stempels auf der sichtbaren Seite. Reine Rechnung ohne pdf-lib:
 * genutzt beim Setzen in die PDF (stamp.ts, im Worker) und für die Vorschau der Werkstatt
 * (Hauptthread), damit beide dieselben Werte haben.
 */

import { centeredInView, edgeInView } from './stamp-geometry.ts';

export type StampPlacement = 'diagonal' | 'top' | 'bottom';
export type StampColor = 'gray' | 'red' | 'blue';

export interface StampLookOptions {
  text: string;
  placement: StampPlacement;
  color: StampColor;
  /** 0 bis 1 */
  opacity: number;
}

/** RGB 0–1 */
export const STAMP_COLORS: Record<StampColor, readonly [number, number, number]> = {
  gray: [0.45, 0.45, 0.45],
  red: [0.8, 0.1, 0.1],
  blue: [0.15, 0.3, 0.8],
};

export const MM = 72 / 25.4;

/**
 * Versalhöhe von Helvetica und Helvetica-Bold: 718/1000 der Schriftgröße (CapHeight in den Adobe
 * Core 14 AFM, wie sie @pdf-lib/standard-fonts mitbringt; geprüft am 25.09.2026).
 */
export const CAP_HEIGHT = 0.718;

/** Schriftgröße am oberen und unteren Rand */
const EDGE_SIZE = 28;
/** Abstand vom oberen bzw. unteren Rand */
const EDGE_MARGIN = 12 * MM;

/** Schriftgröße für den diagonalen Stempel: Zeile etwa 70 % der Diagonale, 12 bis 150 Punkt */
export function diagonalFontSize(diagonal: number, widthAtOnePoint: number): number {
  if (widthAtOnePoint <= 0) return 12;
  return Math.max(12, Math.min(150, (0.7 * diagonal) / widthAtOnePoint));
}

export interface StampInView {
  /** Anfang der Grundlinie, Ursprung unten links der sichtbaren Seite, in Punkt */
  vx: number;
  vy: number;
  /** Drehung gegen den Uhrzeigersinn, wie gelesen */
  angle: number;
  size: number;
  rgb: readonly [number, number, number];
  opacity: number;
}

/**
 * Stempel auf der sichtbaren Seite (`width` × `height` Punkt). `textWidth(size)` misst den
 * Text in Helvetica fett bei dieser Schriftgröße.
 */
export function stampInView(
  width: number,
  height: number,
  look: StampLookOptions,
  textWidth: (size: number) => number,
): StampInView {
  const common = {
    rgb: STAMP_COLORS[look.color],
    opacity: Math.min(1, Math.max(0.05, look.opacity)),
  };
  if (look.placement === 'diagonal') {
    const size = diagonalFontSize(Math.hypot(width, height), textWidth(1));
    const angle = (Math.atan2(height, width) * 180) / Math.PI;
    const at = centeredInView(width, height, angle, textWidth(size), size * CAP_HEIGHT);
    return { ...at, angle, size, ...common };
  }
  const at = edgeInView(
    width,
    height,
    look.placement === 'top' ? 'top-center' : 'bottom-center',
    textWidth(EDGE_SIZE),
    EDGE_SIZE * CAP_HEIGHT,
    EDGE_MARGIN,
  );
  return { ...at, angle: 0, size: EDGE_SIZE, ...common };
}
