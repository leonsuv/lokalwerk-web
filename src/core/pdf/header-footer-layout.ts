/**
 * Kopf- und Fußzeile (Werkzeug „Kopf- und Fußzeile“). Reine Rechnung ohne pdf-lib: Platzhalter
 * {n} und {N}, Seitenauswahl, Zeichenprüfung und Lage der Texte auf der sichtbaren Seite.
 * Gezeichnet wird in header-footer.ts; die Werkzeugseite nutzt dieselben Funktionen für ihre
 * Meldungen.
 */

import { parsePageRanges, pageIndices, type PageRangeError } from './page-ranges.ts';
import { edgeInView, type Anchor } from './stamp-geometry.ts';
import { CAP_HEIGHT, MM } from './stamp-layout.ts';
import { unsupportedChars } from './winansi.ts';

export type Row = 'header' | 'footer';
export type Slot = 'left' | 'center' | 'right';

export const ROWS: readonly Row[] = ['header', 'footer'];
export const SLOTS: readonly Slot[] = ['left', 'center', 'right'];

export type RowTexts = Record<Slot, string>;

export interface PageNumberField {
  row: Row;
  slot: Slot;
  /** Vorlage wie „Seite {n} von {N}“ */
  format: string;
}

export interface HeaderFooterOptions {
  texts: Record<Row, RowTexts>;
  /** Seitenzahl; null heißt keine */
  number: PageNumberField | null;
  /** Schriftgröße in Punkt */
  fontSize: number;
  /** Abstand vom Seitenrand in Millimetern */
  marginMm: number;
  /** Seiten ab 0; null heißt alle */
  pages: readonly number[] | null;
}

/** Ein Text, wie er auf einer bestimmten Seite steht */
export interface PlacedText {
  row: Row;
  slot: Slot;
  text: string;
}

/** Ersetzt {n} durch die Seitenzahl und {N} durch die Seitenzahl insgesamt */
export function expandPlaceholders(template: string, n: number, total: number): string {
  return template.replaceAll('{n}', String(n)).replaceAll('{N}', String(total));
}

/** Ecke oder Mitte, an der ein Feld steht: Kopfzeile oben, Fußzeile unten */
export function anchorFor(row: Row, slot: Slot): Anchor {
  return `${row === 'header' ? 'top' : 'bottom'}-${slot}` as Anchor;
}

/** Ist auf der Seite `index` (ab 0) etwas zu setzen? */
export function isSelectedPage(pages: readonly number[] | null, index: number): boolean {
  return pages === null || pages.includes(index);
}

/**
 * Alle Texte für die Seite `index` (ab 0) eines Dokuments mit `count` Seiten. Leere Felder fehlen.
 * Platzhalter werden hier ersetzt, nicht erst beim Zeichnen.
 */
export function textsForPage(
  options: HeaderFooterOptions,
  index: number,
  count: number,
): PlacedText[] {
  const placed: PlacedText[] = [];
  for (const row of ROWS) {
    for (const slot of SLOTS) {
      const text = options.texts[row][slot].trim();
      if (text !== '') placed.push({ row, slot, text: expandPlaceholders(text, index + 1, count) });
    }
  }
  const number = options.number;
  if (number && number.format.trim() !== '') {
    placed.push({
      row: number.row,
      slot: number.slot,
      text: expandPlaceholders(number.format.trim(), index + 1, count),
    });
  }
  return placed;
}

/** Ist gar nichts einzutragen? (keine Texte und keine Seitenzahl) */
export function isEmptyHeaderFooter(options: HeaderFooterOptions): boolean {
  const hasText = ROWS.some((row) => SLOTS.some((slot) => options.texts[row][slot].trim() !== ''));
  const hasNumber = options.number !== null && options.number.format.trim() !== '';
  return !hasText && !hasNumber;
}

/**
 * Seitenangabe „1-3, 5“ für das Werkzeug: leer heißt alle Seiten (null). Die Seiten zählen ab 1
 * wie im PDF-Programm; zurück kommen Seiten ab 0.
 */
export function selectPages(
  input: string,
  total: number,
): { ok: true; pages: number[] | null } | { ok: false; error: PageRangeError } {
  if (input.trim() === '') return { ok: true, pages: null };
  const parsed = parsePageRanges(input, total);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  return { ok: true, pages: parsed.ranges.flatMap(pageIndices) };
}

/** Lage der Texte auf der sichtbaren Seite (Ursprung unten links) */
export interface TextInView {
  text: string;
  /** Anfang der Grundlinie */
  vx: number;
  vy: number;
}

/**
 * Setzt die Texte an ihre Felder auf der sichtbaren Seite (`width` × `height` Punkt).
 * `textWidth` misst den Text in Helvetica bei der gewählten Schriftgröße.
 */
export function placeTexts(
  width: number,
  height: number,
  items: readonly PlacedText[],
  fontSize: number,
  marginMm: number,
  textWidth: (text: string) => number,
): TextInView[] {
  return items.map((item) => {
    const at = edgeInView(
      width,
      height,
      anchorFor(item.row, item.slot),
      textWidth(item.text),
      fontSize * CAP_HEIGHT,
      marginMm * MM,
    );
    return { text: item.text, vx: at.vx, vy: at.vy };
  });
}

/**
 * Zeichen aus WinAnsi (Windows-1252 mit den Zusatzzeichen der PDF-Standardschrift), die
 * Helvetica darstellen kann. Stimmt mit dem Zeichenvorrat von pdf-lib überein; die Tests
 * vergleichen beides.
 */
const WINANSI_RANGES: readonly (readonly [number, number])[] = [
  [0x20, 0x7e],
  [0xa0, 0xff],
  [0x152, 0x153],
  [0x160, 0x161],
  [0x178, 0x178],
  [0x17d, 0x17e],
  [0x192, 0x192],
  [0x2c6, 0x2c6],
  [0x2dc, 0x2dc],
  [0x2013, 0x2014],
  [0x2018, 0x201a],
  [0x201c, 0x201e],
  [0x2020, 0x2022],
  [0x2026, 0x2026],
  [0x2030, 0x2030],
  [0x2039, 0x203a],
  [0x20ac, 0x20ac],
  [0x2122, 0x2122],
];

export const WINANSI_CHARSET: ReadonlySet<number> = new Set(
  WINANSI_RANGES.flatMap(([from, to]) => Array.from({ length: to - from + 1 }, (_, i) => from + i)),
);

/**
 * Zeichen aus allen Eingabefeldern, die die Standardschrift nicht darstellen kann, jedes einmal.
 * Die Zeichen werden nicht entfernt: Das Werkzeug zeigt sie an und speichert erst, wenn sie
 * ersetzt sind, damit nichts stillschweigend fehlt.
 */
export function unsupportedInOptions(options: HeaderFooterOptions): string[] {
  const inputs = ROWS.flatMap((row) => SLOTS.map((slot) => options.texts[row][slot]));
  if (options.number) inputs.push(options.number.format);
  const missing = new Set<string>();
  for (const input of inputs) {
    for (const char of unsupportedChars(input, WINANSI_CHARSET)) missing.add(char);
  }
  return [...missing];
}
