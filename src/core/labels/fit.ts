/**
 * Schriftgröße, mit der die Zeilen eines Etiketts in das Feld passen (plan-phase2.md
 * Werkzeug 24). Die Breite misst eine übergebene Funktion (im Worker die Schriftmaße von
 * Helvetica aus pdf-lib), damit die Rechnung ohne Schrift testbar ist.
 */

export const MM_TO_PT = 72 / 25.4;
/** Zeilenabstand als Vielfaches der Schriftgröße */
export const LINE_HEIGHT = 1.2;
/** Kleinste Schriftgröße, darunter gilt das Etikett als zu voll */
export const MIN_FONT_SIZE = 6;

export interface FitBox {
  /** Breite und Höhe der Schreibfläche in Punkt (Etikett abzüglich Innenabstand) */
  width: number;
  height: number;
}

/** Höhe eines Textblocks mit `lines` Zeilen bei Größe `size` */
export const blockHeight = (lines: number, size: number): number =>
  lines === 0 ? 0 : (lines - 1) * size * LINE_HEIGHT + size;

/**
 * Größte Schriftgröße bis `preferred` (in halben Punkt), bei der alle Zeilen in die Fläche
 * passen; null, wenn selbst MIN_FONT_SIZE nicht reicht.
 */
export function fitFontSize(
  lines: readonly string[],
  widthAtOnePoint: (text: string) => number,
  box: FitBox,
  preferred: number,
): number | null {
  if (lines.length === 0) return preferred;
  const widest = Math.max(...lines.map(widthAtOnePoint));
  const byWidth = widest > 0 ? box.width / widest : Infinity;
  const byHeight = box.height / blockHeight(lines.length, 1);
  const size = Math.floor(Math.min(preferred, byWidth, byHeight) * 2) / 2;
  return size >= MIN_FONT_SIZE ? size : null;
}
