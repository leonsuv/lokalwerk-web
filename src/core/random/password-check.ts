/**
 * Ein eingegebenes Passwort einordnen (Werkzeug „Passwort prüfen“). Reine Funktionen.
 *
 * Bewertet wird nach den Beispielen des BSI (`rateAgainstBsi`, Wortlaut in docs/passwort-bsi.md).
 * Dazu kommen Hinweise auf Schwächen, die ein Angreifer als Erstes probiert: ein sehr häufiges
 * Passwort, Reihen wie 1234 oder abcd, Tastaturreihen (deutsches Layout), wiederholte Zeichen
 * und wiederholte Blöcke. Es gibt bewusst keine „Knackzeit“: Dafür fehlt eine belastbare Quelle.
 */

import { COMMON_PASSWORDS } from './common-passwords.ts';
import { rateAgainstBsi, type BsiRating } from './password.ts';

export type Finding =
  | { kind: 'common' }
  | { kind: 'common-start' }
  | { kind: 'repeat-char'; sample: string }
  | { kind: 'sequence'; sample: string }
  | { kind: 'keyboard'; sample: string }
  | { kind: 'repeat-block'; sample: string }
  | { kind: 'umlaut' };

export interface PasswordCheck {
  length: number;
  upper: boolean;
  lower: boolean;
  digits: boolean;
  symbols: boolean;
  /** Anzahl der vorkommenden Zeichenarten (Groß, Klein, Ziffern, Sonderzeichen) */
  kinds: number;
  bsi: BsiRating;
  findings: Finding[];
}

const COMMON = new Set(COMMON_PASSWORDS);
/** Mindestlänge einer Reihe, ab der sie gemeldet wird */
const RUN = 4;

/** Tastaturreihen des deutschen Layouts, jeweils ohne Umschalt */
const KEY_ROWS = ['1234567890', 'qwertzuiop', 'asdfghjkl', 'yxcvbnm'];

function longestRun(text: string, same: (a: string, b: string) => boolean): string {
  let best = '';
  let start = 0;
  for (let i = 1; i <= text.length; i++) {
    if (i < text.length && same(text.charAt(i - 1), text.charAt(i))) continue;
    if (i - start > best.length) best = text.slice(start, i);
    start = i;
  }
  return best;
}

function sequenceRun(lower: string): string {
  const step = (a: string, b: string, d: number) => {
    const x = a.codePointAt(0) ?? 0;
    const y = b.codePointAt(0) ?? 0;
    const alnum = /^[a-z0-9]$/;
    return alnum.test(a) && alnum.test(b) && y - x === d;
  };
  const up = longestRun(lower, (a, b) => step(a, b, 1));
  const down = longestRun(lower, (a, b) => step(a, b, -1));
  return up.length >= down.length ? up : down;
}

function keyboardRun(lower: string): string {
  let best = '';
  for (const row of KEY_ROWS) {
    for (const line of [row, [...row].reverse().join('')]) {
      for (let i = 0; i < line.length; i++) {
        let n = 0;
        while (i + n < line.length && lower.includes(line.slice(i, i + n + 1))) n++;
        if (n > best.length) best = line.slice(i, i + n);
      }
    }
  }
  return best;
}

function repeatedBlock(text: string): string {
  for (let size = 1; size <= Math.floor(text.length / 2); size++) {
    if (text.length % size !== 0) continue;
    const block = text.slice(0, size);
    if (block.repeat(text.length / size) === text) return block;
  }
  return '';
}

export function checkPassword(password: string): PasswordCheck {
  const chars = [...password];
  const upper = chars.some((c) => /\p{Lu}/u.test(c));
  const lower = chars.some((c) => /\p{Ll}/u.test(c));
  const digits = chars.some((c) => /\p{Nd}/u.test(c));
  const symbols = chars.some((c) => !/[\p{L}\p{Nd}]/u.test(c));
  const kinds = [upper, lower, digits, symbols].filter(Boolean).length;
  const findings: Finding[] = [];
  const text = password.toLowerCase();

  if (COMMON.has(text)) findings.push({ kind: 'common' });
  else {
    const stripped = text.replace(/[\d!?.#*+_-]+$/u, '');
    if (stripped !== text && stripped.length >= 4 && COMMON.has(stripped)) {
      findings.push({ kind: 'common-start' });
    }
  }
  const repeat = longestRun(text, (a, b) => a === b);
  if ([...repeat].length >= RUN) findings.push({ kind: 'repeat-char', sample: repeat });
  const seq = sequenceRun(text);
  if (seq.length >= RUN) findings.push({ kind: 'sequence', sample: seq });
  const keys = keyboardRun(text);
  if (keys.length >= RUN) findings.push({ kind: 'keyboard', sample: keys });
  const block = chars.length >= 4 ? repeatedBlock(password) : '';
  if (block !== '' && block.length < password.length && block.length > 1) {
    findings.push({ kind: 'repeat-block', sample: block });
  }
  if (/[äöüßÄÖÜ€¢]/.test(password)) findings.push({ kind: 'umlaut' });

  return {
    length: chars.length,
    upper,
    lower,
    digits,
    symbols,
    kinds,
    bsi: rateAgainstBsi(chars.length, kinds),
    findings,
  };
}
