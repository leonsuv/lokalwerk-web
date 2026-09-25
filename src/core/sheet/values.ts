/**
 * Zellwerte zwischen Tabellen und CSV (Werkzeug „Excel und CSV umwandeln“, plan-phase2.md 22).
 *
 * Datum und Uhrzeit sind in Tabellendateien ohne Zeitzone gespeichert („Wanduhrzeit“). SheetJS
 * liefert sie als Date, dessen UTC-Felder diese Wanduhrzeit enthalten (geprüft für .xlsx, .ods
 * und .xls in mehreren Zeitzonen). Deshalb wird hier nur mit UTC-Feldern gerechnet, nie mit der
 * Ortszeit des Browsers.
 */

export interface WallClock {
  year: number;
  /** 1–12 */
  month: number;
  day: number;
  hours: number;
  minutes: number;
  seconds: number;
}

/** Leere Zelle: null */
export type SheetValue = string | number | boolean | WallClock | null;

export type DecimalMark = ',' | '.';

export function isWallClock(value: unknown): value is WallClock {
  return typeof value === 'object' && value !== null && 'year' in value && 'day' in value;
}

/** Aus einem Date von SheetJS, auf ganze Sekunden gerundet (Excel speichert Bruchteile eines Tages). */
export function wallClockFromDate(date: Date): WallClock {
  const d = new Date(Math.round(date.getTime() / 1000) * 1000);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hours: d.getUTCHours(),
    minutes: d.getUTCMinutes(),
    seconds: d.getUTCSeconds(),
  };
}

const pad = (n: number, length = 2) => String(n).padStart(length, '0');

/**
 * „25.09.2026“, „25.09.2026 14:30“, „25.09.2026 14:30:15“. Reine Uhrzeiten (Excel speichert sie
 * als Tag 0, SheetJS liefert dafür ein Datum vor 1900) werden als „14:30“ ausgegeben.
 */
export function formatWallClock(w: WallClock): string {
  const hasTime = w.hours !== 0 || w.minutes !== 0 || w.seconds !== 0;
  const time = `${pad(w.hours)}:${pad(w.minutes)}${w.seconds !== 0 ? `:${pad(w.seconds)}` : ''}`;
  if (w.year < 1900) return time;
  const date = `${pad(w.day)}.${pad(w.month)}.${pad(w.year, 4)}`;
  return hasTime ? `${date} ${time}` : date;
}

/**
 * Zahl ohne Tausendertrennzeichen, mit höchstens 15 gültigen Stellen wie in Excel
 * (0,1 + 0,2 wird 0,3 statt 0,30000000000000004).
 */
export function formatNumber(value: number, decimal: DecimalMark): string {
  if (!Number.isFinite(value)) return '';
  const text = String(Number(value.toPrecision(15))).replace('e', 'E');
  return decimal === ',' ? text.replace('.', ',') : text;
}

export function formatValue(value: SheetValue, decimal: DecimalMark): string {
  if (value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return formatNumber(value, decimal);
  if (typeof value === 'boolean') return value ? 'WAHR' : 'FALSCH';
  return formatWallClock(value);
}

const DAY_MS = 86_400_000;
const EXCEL_EPOCH = Date.UTC(1899, 11, 30);
const FIRST_SAFE_DAY = Date.UTC(1900, 2, 1);

/**
 * Seriennummer für Excel (Tage seit dem 30.12.1899, Uhrzeit als Bruchteil). Vor dem 1.3.1900
 * weicht Excel wegen des übernommenen Schaltjahrfehlers von 1900 ab; dafür null.
 */
export function excelSerial(w: WallClock): number | null {
  const ms = Date.UTC(w.year, w.month - 1, w.day, w.hours, w.minutes, w.seconds);
  if (ms < FIRST_SAFE_DAY) return null;
  return (ms - EXCEL_EPOCH) / DAY_MS;
}

function validDate(year: number, month: number, day: number): boolean {
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

const MAX_DIGITS = 15;
const NUMBER_PATTERNS: Record<DecimalMark, { plain: RegExp; grouped: RegExp; group: string }> = {
  ',': { plain: /^-?\d+(,\d+)?$/, grouped: /^-?\d{1,3}(\.\d{3})+(,\d+)?$/, group: '.' },
  '.': { plain: /^-?\d+(\.\d+)?$/, grouped: /^-?\d{1,3}(,\d{3})+(\.\d+)?$/, group: ',' },
};
const DATE_DE = /^(\d{1,2})\.(\d{1,2})\.(\d{4})(?: (\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;
const DATE_ISO = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/;

function parseNumber(text: string, decimal: DecimalMark): number | null {
  const { plain, grouped, group } = NUMBER_PATTERNS[decimal];
  if (!plain.test(text) && !grouped.test(text)) return null;
  const digits = text.replace(/\D/g, '');
  // Führende Null („01067“, „007“) heißt fast immer Kennung, nicht Zahl: bleibt Text.
  const integer = text.replace(/^-/, '').split(decimal)[0]?.split(group).join('') ?? '';
  if (integer.length > 1 && integer.startsWith('0')) return null;
  if (digits.length > MAX_DIGITS) return null;
  const normalized = text.split(group).join('').replace(decimal, '.');
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function parseDate(text: string): WallClock | null {
  let parts: (string | undefined)[] | null = null;
  const de = DATE_DE.exec(text);
  if (de) parts = [de[3], de[2], de[1], de[4], de[5], de[6]];
  const iso = DATE_ISO.exec(text);
  if (iso) parts = [iso[1], iso[2], iso[3], iso[4], iso[5], iso[6]];
  if (!parts) return null;
  const [year, month, day, hours, minutes, seconds] = parts.map((p) => Number(p ?? 0));
  if (year === undefined || month === undefined || day === undefined) return null;
  if (!validDate(year, month, day)) return null;
  const w: WallClock = {
    year,
    month,
    day,
    hours: hours ?? 0,
    minutes: minutes ?? 0,
    seconds: seconds ?? 0,
  };
  if (w.hours > 23 || w.minutes > 59 || w.seconds > 59) return null;
  return excelSerial(w) === null ? null : w;
}

/**
 * Text aus einer CSV-Zelle für eine Excel-Datei deuten. Nur eindeutige Formen werden Zahl oder
 * Datum; alles andere bleibt unverändert Text (führende Nullen, lange Nummern, Prozent,
 * Währungszeichen). Leerzeichen am Anfang und Ende zählen nicht.
 */
export function parseCellText(text: string, decimal: DecimalMark): string | number | WallClock {
  const trimmed = text.trim();
  if (trimmed === '') return text;
  return parseNumber(trimmed, decimal) ?? parseDate(trimmed) ?? text;
}

export interface ConvertedTable {
  rows: (string | number | WallClock)[][];
  numbers: number;
  dates: number;
}

/**
 * CSV-Zeilen für eine Excel-Datei deuten, Spalte für Spalte: Eine Spalte wird nur zu Zahlen
 * (oder Datumswerten), wenn alle belegten Zellen ab der zweiten Zeile eindeutig Zahlen (oder
 * Datumswerte) sind. Sonst bleibt die ganze Spalte Text, damit z. B. eine Postleitzahlen-Spalte
 * nicht halb aus Zahlen und halb aus Text besteht. Die erste Zeile (meist Überschriften) wird
 * nur umgewandelt, wenn sie zur Spalte passt.
 */
export function convertColumns(
  rows: readonly (readonly string[])[],
  decimal: DecimalMark,
): ConvertedTable {
  const width = Math.max(0, ...rows.map((r) => r.length));
  const kinds = Array.from({ length: width }, (_, c) => {
    let kind: 'number' | 'date' | 'text' | 'empty' = 'empty';
    for (const row of rows.slice(1)) {
      const text = row[c] ?? '';
      if (text.trim() === '') continue;
      const value = parseCellText(text, decimal);
      const cellKind =
        typeof value === 'string' ? 'text' : typeof value === 'number' ? 'number' : 'date';
      if (kind === 'empty') kind = cellKind;
      else if (kind !== cellKind) kind = 'text';
      if (kind === 'text') break;
    }
    return kind;
  });

  let numbers = 0;
  let dates = 0;
  const converted = rows.map((row) =>
    row.map((text, c) => {
      const kind = kinds[c];
      if (kind !== 'number' && kind !== 'date') return text;
      const value = parseCellText(text, decimal);
      if (kind === 'number' && typeof value === 'number') {
        numbers++;
        return value;
      }
      if (kind === 'date' && isWallClock(value)) {
        dates++;
        return value;
      }
      return text;
    }),
  );
  return { rows: converted, numbers, dates };
}
