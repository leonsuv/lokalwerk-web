/**
 * Zielgröße und Skalierung für „Seitengröße ändern“, ohne pdf-lib. Erklärung: ./resize.ts.
 *
 * Die festen Seitengrößen kommen aus image-layout.ts (dieselben wie beim Scanner). Eine Seite
 * wird im Format der Vorlage gesetzt: Querformat bleibt Querformat („auto“, wie beim Scanner).
 */

import { A4, A5, LETTER, MM } from './image-layout.ts';

/** Zielgröße: feste DIN- oder Letter-Größe, oder die Größe der Seite selbst („Wie das Blatt“) */
export type TargetChoice = 'a4' | 'a5' | 'letter' | 'keep';

/**
 * einpassen: Seite wird verkleinert oder vergrößert, bis sie mit Rand auf die Zielseite passt.
 * behalten: Maßstab 1, die Seite wird mittig gesetzt (größerer Inhalt wird abgeschnitten).
 */
export type FitMode = 'scale' | 'center';

export interface Size {
  width: number;
  height: number;
}

/** Rand um den Inhalt beim Einpassen, in Millimetern */
export const MARGIN_MM = 10;
/** Rand in Punkt */
export const MARGIN = MARGIN_MM * MM;

const FIXED: Record<Exclude<TargetChoice, 'keep'>, Size> = { a4: A4, a5: A5, letter: LETTER };

/**
 * Zielgröße für eine Seite mit der sichtbaren Größe `visible`. Feste Formate werden quer gesetzt,
 * wenn die Seite breiter als hoch ist; „keep“ übernimmt die Seite unverändert.
 */
export function targetSize(choice: TargetChoice, visible: Size): Size {
  if (choice === 'keep') return { width: visible.width, height: visible.height };
  const size = FIXED[choice];
  return visible.width > visible.height
    ? { width: size.height, height: size.width }
    : { width: size.width, height: size.height };
}

/**
 * Maßstab für die Seite. Bei „einpassen“ so groß wie möglich innerhalb des Rands, ohne Verzerrung.
 * Null, wenn der Rand die Zielseite ausfüllt und nichts übrig bleibt.
 */
export function scaleFor(visible: Size, target: Size, mode: FitMode): number | null {
  if (mode === 'center') return 1;
  const w = target.width - 2 * MARGIN;
  const h = target.height - 2 * MARGIN;
  if (w <= 0 || h <= 0 || visible.width <= 0 || visible.height <= 0) return null;
  return Math.min(w / visible.width, h / visible.height);
}

/** Feld mittig auf der Zielseite, das die skalierte Seite aufnimmt (Ursprung unten links) */
export function centeredCell(
  visible: Size,
  scale: number,
  target: Size,
): { x: number; y: number; width: number; height: number } {
  const width = visible.width * scale;
  const height = visible.height * scale;
  return {
    x: (target.width - width) / 2,
    y: (target.height - height) / 2,
    width,
    height,
  };
}
