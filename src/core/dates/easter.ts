/**
 * Ostersonntag im gregorianischen Kalender nach der Rechenvorschrift der Physikalisch-Technischen
 * Bundesanstalt („Wann ist Ostern?“, Gaußsche Osterformel in der Form von H. Lichtenberg;
 * Wortlaut in docs/feiertage-recht.md). Namen der Zwischenwerte wie dort.
 */

import { dayNumber } from './civil.ts';

const int = (a: number, b: number) => Math.floor(a / b);
/** nicht-negativer Rest */
const mod = (a: number, b: number) => ((a % b) + b) % b;

/** Tagesnummer (core/dates/civil.ts) des Ostersonntags im Jahr `x` */
export function easterSunday(x: number): number {
  const k = int(x, 100);
  const m = 15 + int(3 * k + 3, 4) - int(8 * k + 13, 25);
  const s = 2 - int(3 * k + 3, 4);
  const a = mod(x, 19);
  const d = mod(19 * a + m, 30);
  const r = int(d, 29) + (int(d, 28) - int(d, 29)) * int(a, 11);
  const og = 21 + d - r;
  const sz = 7 - mod(x + int(x, 4) + s, 7);
  const oe = 7 - mod(og - sz, 7);
  // OS = OG + OE als Märzdatum (32. März = 1. April); Date.UTC rechnet den Überlauf um
  return dayNumber(x, 3, og + oe);
}
