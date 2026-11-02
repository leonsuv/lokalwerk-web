/**
 * Seitenzuordnung und Platzierung für „Briefpapier überlagern“, ohne pdf-lib. Erklärung:
 * ./letterhead.ts. Koordinaten wie in pdf-lib (Ursprung unten links, Punkt).
 */

/** Welche Seite des Briefpapiers unter eine Seite des Briefs gelegt wird */
export type LetterheadPick = 'first' | 'match';

export interface Size {
  width: number;
  height: number;
}

export interface Cell {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Index (0-basiert) der Briefpapierseite für die Brief-Seite `index`. Hat das Briefpapier nur eine
 * Seite, gilt sie für alle. „match“ nimmt die Seite mit gleicher Nummer; gibt es mehr Brief- als
 * Briefpapierseiten, bekommen die übrigen die letzte Briefpapierseite.
 */
export function letterheadPageIndex(
  index: number,
  letterheadPages: number,
  pick: LetterheadPick,
): number {
  if (pick === 'first' || letterheadPages <= 1) return 0;
  return Math.min(index, letterheadPages - 1);
}

/**
 * Feld auf der Briefpapierseite (Größe `letter`), in das die Brief-Seite mit der sichtbaren Größe
 * `visible` gesetzt wird. Oben links bündig, damit der Brief am Briefkopf ausgerichtet bleibt.
 * Ohne `fit` bleibt der Maßstab 1; mit `fit` wird der Brief so groß wie möglich eingepasst (ohne
 * Verzerrung). Null, wenn die Seite keine Fläche hat.
 */
export function contentCell(visible: Size, letter: Size, fit: boolean): Cell | null {
  if (!(visible.width > 0 && visible.height > 0)) return null;
  const scale = fit ? Math.min(letter.width / visible.width, letter.height / visible.height) : 1;
  const width = visible.width * scale;
  const height = visible.height * scale;
  return { x: 0, y: letter.height - height, width, height };
}
