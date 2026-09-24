/**
 * Beträge aus Texten und Excel-Zahlen in ganze Cent umwandeln (AGENTS.md Abschnitt 5,
 * plan.md B1). Texte werden ohne Gleitkomma-Rechnung zerlegt. Es wird nie gerundet:
 * Mehr als zwei Nachkommastellen sind ein Fehler, mehrdeutige Schreibweisen ebenso.
 *
 * Grenzen laut Anlage 3 26.11, Kap. 2.3.3, S. 254, und SCT-Rulebook AT-T002: 0,01 bis
 * 999.999.999,99 Euro.
 */

export const MIN_CENTS = 1;
export const MAX_CENTS = 99_999_999_999;

export type AmountError =
  'empty' | 'unreadable' | 'ambiguous' | 'too-many-decimals' | 'negative' | 'zero' | 'too-large';

export type AmountResult = { ok: true; cents: number } | { ok: false; code: AmountError };

const fail = (code: AmountError): AmountResult => ({ ok: false, code });

function checkRange(cents: number): AmountResult {
  if (cents === 0) return fail('zero');
  if (cents > MAX_CENTS) return fail('too-large');
  return { ok: true, cents };
}

/** Ganze Euro (nur Ziffern) und Nachkommastellen (0–2 Ziffern) zu Cent. */
function toCents(euros: string, decimals: string): AmountResult {
  if (decimals.length > 2) return fail('too-many-decimals');
  const digits = euros.replace(/^0+(?=\d)/, '');
  if (digits.length > 12) return fail('too-large');
  return checkRange(Number(digits) * 100 + Number(decimals.padEnd(2, '0')));
}

/** Tausender-Gruppen: erste Gruppe 1–3 Ziffern, danach nur Dreiergruppen. */
function groupedEuros(text: string, separator: string): string | null {
  const groups = text.split(separator);
  const [first, ...rest] = groups;
  if (!first || !/^\d{1,3}$/.test(first)) return null;
  if (!rest.every((g) => /^\d{3}$/.test(g))) return null;
  return groups.join('');
}

function parseText(input: string): AmountResult {
  // \s erfasst in JavaScript auch geschützte Leerzeichen. Euro-Zeichen und „EUR“ entfernen.
  let s = input.replace(/\s+/g, ' ').replace(/€|EUR/gi, '').trim();
  if (s === '') return fail('empty');
  if (s.startsWith('-') || s.endsWith('-')) return fail('negative');
  if (!/^[\d.,' ]+$/.test(s)) return fail('unreadable');

  // Leerzeichen sind nur als Tausendertrenner erlaubt: „1 234,56“.
  if (s.includes(' ')) {
    const match = /^([\d ]+)([.,]\d*)?$/.exec(s);
    const euros = match?.[1] ? groupedEuros(match[1], ' ') : null;
    if (!euros) return fail('unreadable');
    s = euros + (match?.[2] ?? '');
  }
  if (s.includes("'")) return fail('unreadable');

  const commas = (s.match(/,/g) ?? []).length;
  const dots = (s.match(/\./g) ?? []).length;

  if (commas === 0 && dots === 0) return /^\d+$/.test(s) ? toCents(s, '') : fail('unreadable');

  if (commas > 0 && dots > 0) {
    // Das zuletzt stehende Zeichen trennt die Nachkommastellen: „1.234,56“ oder „1,234.56“.
    const decimalSep = s.lastIndexOf(',') > s.lastIndexOf('.') ? ',' : '.';
    const thousandsSep = decimalSep === ',' ? '.' : ',';
    const parts = s.split(decimalSep);
    if (parts.length !== 2) return fail('unreadable');
    const [intPart = '', decPart = ''] = parts;
    const euros = groupedEuros(intPart, thousandsSep);
    if (!euros || !/^\d+$/.test(decPart)) return fail('unreadable');
    return toCents(euros, decPart);
  }

  // Nur eine Art Trennzeichen.
  const sep = commas > 0 ? ',' : '.';
  const count = commas + dots;
  if (count > 1) {
    // Mehrfach vorkommend kann es nur ein Tausendertrenner sein: „1.234.567“.
    const euros = groupedEuros(s, sep);
    return euros ? toCents(euros, '') : fail('unreadable');
  }
  const [intPart = '', decPart = ''] = s.split(sep);
  if (!/^\d+$/.test(intPart) || !/^\d+$/.test(decPart)) return fail('unreadable');
  // „1,234“ oder „1.234“: Tausendertrenner oder drei Nachkommastellen? Nicht entscheidbar.
  if (decPart.length === 3 && /^[1-9]\d{0,2}$/.test(intPart)) return fail('ambiguous');
  return toCents(intPart, decPart);
}

function parseNumber(value: number): AmountResult {
  if (!Number.isFinite(value)) return fail('unreadable');
  if (value < 0) return fail('negative');
  const cents = value * 100;
  const rounded = Math.round(cents);
  // Nur Gleitkomma-Rauschen ausgleichen (plan.md B1: Toleranz deutlich unter 0,001 Cent).
  // Die Toleranz wächst mit der Größe der Zahl, bleibt aber bis 999.999.999,99 € unter
  // 0,0001 Cent.
  const tolerance = Math.max(1e-9, Math.abs(cents) * 8 * Number.EPSILON);
  if (Math.abs(cents - rounded) > tolerance) return fail('too-many-decimals');
  return checkRange(rounded);
}

/** Text aus CSV/Eingabe oder Zahl aus einer Excel-Zelle. */
export function parseAmount(value: string | number): AmountResult {
  return typeof value === 'number' ? parseNumber(value) : parseText(value);
}

/** Cent als Dezimalzahl mit Punkt für XML: 123456 → „1234.56“. */
export function centsToXmlDecimal(cents: number): string {
  if (!Number.isSafeInteger(cents) || cents < 0)
    throw new RangeError(`Ungültiger Betrag: ${cents}`);
  const text = String(cents).padStart(3, '0');
  return `${text.slice(0, -2)}.${text.slice(-2)}`;
}
