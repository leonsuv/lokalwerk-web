/**
 * Texte für SEPA-Dateien bereinigen: erlaubter Zeichensatz, Umschreibung, Kürzen.
 *
 * Erlaubte Zeichen: Anlage 3 26.11, Kap. 2.1, S. 84–86. Grundzeichensatz plus Umlaute, ß,
 * & * $ %, deren Annahme die Kreditinstitute zugesagt haben.
 *
 * Umschreibung: eigenständig erstellt (plan.md O1/O8, O2, O3; docs/sepa-entscheidungen.md).
 * Die EPC-Tabelle EPC217-08 wurde nur zum Nachlesen genutzt, keine Werte daraus übernommen.
 * Reihenfolge: erlaubt → eigene Liste → unsichtbare Formatzeichen entfernen → Leerzeichen →
 * NFD ohne Akzente → Punkt.
 *
 * Zeichen stehen hier als Code-Punkte (Zahlen), damit unsichtbare oder ähnlich aussehende
 * Zeichen im Quelltext nicht verwechselt werden.
 */

/** Längen laut Anlage 3 26.11: Namen S. 86, 97, 103, 111; Verwendungszweck S. 114; Ids S. 253. */
export const NAME_MAX_LENGTH = 70;
export const PURPOSE_MAX_LENGTH = 140;
export const REFERENCE_MAX_LENGTH = 35;

const cp = (text: string): number => text.codePointAt(0) ?? 0;

/** Anlage 3 26.11, S. 85: Ziffern, Buchstaben und ' : ? , - Leerzeichen ( + . ) / */
const BASIC_PUNCTUATION = new Set([
  0x27, 0x3a, 0x3f, 0x2c, 0x2d, 0x20, 0x28, 0x2b, 0x2e, 0x29, 0x2f,
]);

/** Anlage 3 26.11, S. 85–86: Ä Ö Ü ä ö ü ß & * $ % */
const EXTENDED = new Set([0xc4, 0xd6, 0xdc, 0xe4, 0xf6, 0xfc, 0xdf, 0x26, 0x2a, 0x24, 0x25]);

export function isAllowedChar(char: string): boolean {
  const code = cp(char);
  return (
    (code >= 0x30 && code <= 0x39) || // 0–9
    (code >= 0x41 && code <= 0x5a) || // A–Z
    (code >= 0x61 && code <= 0x7a) || // a–z
    BASIC_PUNCTUATION.has(code) ||
    EXTENDED.has(code)
  );
}

/** Eigene Umschreibungen (plan.md O1/O8, O2, O3). */
const OWN_MAPPINGS = new Map<number, string>([
  // O1/O8: Buchstaben ohne Zerlegung in NFD
  [0xc6, 'AE'], // Æ
  [0xe6, 'ae'], // æ
  [0x152, 'OE'], // Œ
  [0x153, 'oe'], // œ
  [0xd8, 'O'], // Ø
  [0xf8, 'o'], // ø
  [0x141, 'L'], // Ł
  [0x142, 'l'], // ł
  [0x110, 'D'], // Đ
  [0x111, 'd'], // đ
  [0xde, 'TH'], // Þ
  [0xfe, 'th'], // þ
  [0x1e9e, 'SS'], // ẞ (großes scharfes s)
  // O2: Typografie
  [0x2013, '-'], // Halbgeviertstrich
  [0x2014, '-'], // Geviertstrich
  [0x201e, "'"], // „
  [0x201c, "'"], // “
  [0x201d, "'"], // ”
  [0x2018, "'"], // ‘
  [0x2019, "'"], // ’
  [0x2026, '...'], // …
  // O3: XML-Sonderzeichen außerhalb des erlaubten Zeichensatzes
  [0x22, "'"], // "
  [0x3c, '.'], // <
  [0x3e, '.'], // >
]);

const FALLBACK = '.';

export interface Replacement {
  from: string;
  /** Leerer Text heißt: Zeichen wurde entfernt. */
  to: string;
}

export interface SanitizedText {
  /** Bereinigter, getrimmter und ggf. gekürzter Text */
  text: string;
  /** Jede Ersetzung einmal, in der Reihenfolge des ersten Auftretens (für die Warnung) */
  replacements: Replacement[];
  /** Wurde auf maxLength gekürzt? */
  truncated: boolean;
  /** Länge vor dem Kürzen */
  lengthBeforeTruncation: number;
  /** Leer oder nur Leerzeichen: darf laut Anlage 3 26.11, S. 84, nicht übertragen werden */
  blank: boolean;
}

function replaceChar(char: string): string {
  if (isAllowedChar(char)) return char;
  const own = OWN_MAPPINGS.get(cp(char));
  if (own !== undefined) return own;
  // Unsichtbare Formatzeichen (Unicode-Kategorie Cf, z. B. weiches Trennzeichen, Zero-Width-
  // Joiner, Richtungsmarkierungen, BOM) werden entfernt statt zu einem Punkt (Entscheidung
  // vom 24.09.2026, docs/sepa-entscheidungen.md). Vor der Leerzeichen-Regel, weil JavaScript
  // U+FEFF zu \s zählt.
  if (/\p{Cf}/u.test(char)) return '';
  // O2: geschützte und andere Leerzeichen, Tabulatoren, Zeilenumbrüche
  if (/\s/u.test(char)) return ' ';
  const withoutAccents = char.normalize('NFD').replace(/\p{M}/gu, '');
  if (withoutAccents !== '' && [...withoutAccents].every(isAllowedChar)) return withoutAccents;
  return FALLBACK;
}

export function sanitizeSepaText(input: string, maxLength: number): SanitizedText {
  const replacements: Replacement[] = [];
  const seen = new Set<string>();
  let text = '';
  for (const char of input) {
    const replacement = replaceChar(char);
    // Jedes Zeichen wird immer gleich ersetzt; für die Warnung reicht das erste Auftreten.
    if (replacement !== char && !seen.has(char)) {
      seen.add(char);
      replacements.push({ from: char, to: replacement });
    }
    text += replacement;
  }

  text = text.trim();
  const lengthBeforeTruncation = text.length;
  const truncated = text.length > maxLength;
  if (truncated) text = text.slice(0, maxLength).trimEnd();

  return { text, replacements, truncated, lengthBeforeTruncation, blank: text === '' };
}
