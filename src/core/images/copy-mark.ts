/**
 * Aufdruck für Ausweiskopien (plan-phase2.md Vorschlag A): Text und Lage der Zeilen, reine Rechnung.
 * § 20 Abs. 2 PAuswG und § 18 Abs. 3 PassG verlangen, dass die Ablichtung „eindeutig und dauerhaft
 * als Kopie erkennbar ist“ (Wortlaut in docs/ausweiskopie-recht.md). Deshalb beginnt der Aufdruck
 * immer mit „KOPIE“; Zweck und Datum sind freiwillig.
 */

export interface CopyMarkInput {
  purpose: string;
  /** Datum als Text, leer heißt: ohne Datum */
  date: string;
}

export function copyMarkText({ purpose, date }: CopyMarkInput): string {
  const parts = ['KOPIE'];
  const p = purpose.replace(/\s+/g, ' ').trim();
  if (p) parts.push(`nur für ${p}`);
  const d = date.trim();
  if (d) parts.push(d);
  return parts.join(' – ');
}

/** Heutiges Datum als TT.MM.JJJJ, aus den lokalen Feldern (keine Zeitzonen-Umrechnung) */
export function todayGerman(now: Date): string {
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${now.getFullYear()}`;
}

export interface MarkLine {
  /** Mittelpunkt der Zeile vor der Drehung, relativ zur Bildmitte */
  offset: number;
}

/**
 * Parallele Zeilen quer über das Bild, sodass jede Stelle des gedrehten Bildes abgedeckt ist:
 * Abstand `spacing`, genug Zeilen für die Diagonale.
 */
export function markLines(width: number, height: number, spacing: number): MarkLine[] {
  const diagonal = Math.hypot(width, height);
  const count = Math.ceil(diagonal / spacing) + 1;
  return Array.from({ length: count }, (_, i) => ({ offset: (i - (count - 1) / 2) * spacing }));
}
