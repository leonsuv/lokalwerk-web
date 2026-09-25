/**
 * Passwörter erzeugen (Werkzeug „Passwort-Generator“, plan-phase2.md Werkzeug 25).
 *
 * Zufall: Die Seite übergibt eine Quelle mit crypto.getRandomValues. Aus 32-Bit-Zufallszahlen
 * wird eine gleichverteilte Zahl von 0 bis n−1 durch Verwerfen gewonnen (kein Modulo-Fehler).
 *
 * Grundlage der Bewertung: BSI, „Sichere Passwörter erstellen“ (Verbraucherseite, abgerufen am
 * 25.09.2026, die Seite nennt kein Datum), Wortlaut in docs/passwort-bsi.md. Keine Umlaute und
 * kein €, wie dort empfohlen.
 */

export type CharGroup = 'upper' | 'lower' | 'digits' | 'symbols';

export const GROUPS: Record<CharGroup, string> = {
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lower: 'abcdefghijklmnopqrstuvwxyz',
  digits: '0123456789',
  // ASCII ohne Leerzeichen, Anführungszeichen, Backslash und Backtick, die beim Einfügen in
  // Formulare, Tabellen oder Befehle oft Ärger machen
  symbols: '!#$%&()*+,-./:;<=>?@[]^_{|}~',
};

/** Leicht zu verwechseln, wenn man ein Passwort abliest oder abtippt */
export const AMBIGUOUS = '0Oo1lI|';

export interface PasswordOptions {
  length: number;
  groups: readonly CharGroup[];
  avoidAmbiguous: boolean;
}

export const MIN_LENGTH = 4;
export const MAX_LENGTH = 128;

/** Liefert Zufallszahlen wie crypto.getRandomValues (gefülltes Uint32Array). */
export type RandomSource = (buffer: Uint32Array<ArrayBuffer>) => Uint32Array<ArrayBuffer>;

/** Gleichverteilte ganze Zahl von 0 bis n−1; Werte über der letzten vollen Runde werden verworfen. */
export function randomBelow(n: number, random: RandomSource): number {
  if (!Number.isInteger(n) || n < 1 || n > 2 ** 32) throw new RangeError(`n = ${n}`);
  const limit = 2 ** 32 - (2 ** 32 % n);
  const buffer = new Uint32Array(1);
  for (;;) {
    const value = random(buffer)[0] ?? 0;
    if (value < limit) return value % n;
  }
}

export function groupChars(group: CharGroup, avoidAmbiguous: boolean): string {
  const chars = GROUPS[group];
  return avoidAmbiguous ? [...chars].filter((c) => !AMBIGUOUS.includes(c)).join('') : chars;
}

/**
 * Jedes Zeichen gleichverteilt aus allen gewählten Gruppen; ein Ergebnis, dem eine gewählte
 * Gruppe fehlt, wird verworfen und neu gezogen. So kommt jede Gruppe vor (wie vom BSI für
 * „vier verschiedene Zeichenarten“ beschrieben), und alle zulässigen Passwörter sind gleich
 * wahrscheinlich.
 */
export function generatePassword(options: PasswordOptions, random: RandomSource): string {
  const groups = [...new Set(options.groups)];
  if (groups.length === 0) throw new RangeError('keine Zeichengruppe');
  if (options.length < Math.max(MIN_LENGTH, groups.length) || options.length > MAX_LENGTH) {
    throw new RangeError(`Länge ${options.length}`);
  }
  const sets = groups.map((g) => groupChars(g, options.avoidAmbiguous));
  const alphabet = sets.join('');
  for (;;) {
    let password = '';
    for (let i = 0; i < options.length; i++)
      password += alphabet[randomBelow(alphabet.length, random)];
    if (sets.every((set) => [...password].some((c) => set.includes(c)))) return password;
  }
}

/** Zeichenvorrat aus den Gruppen */
export function alphabetSize(groups: readonly CharGroup[], avoidAmbiguous: boolean): number {
  return [...new Set(groups)].reduce((sum, g) => sum + groupChars(g, avoidAmbiguous).length, 0);
}

/**
 * Obergrenze der Zufälligkeit in Bit: Länge × log2(Zeichenvorrat). Die Pflicht, dass jede Gruppe
 * vorkommt, senkt den Wert etwas; angezeigt wird er abgerundet.
 */
export function entropyBits(length: number, size: number): number {
  return size <= 1 ? 0 : length * Math.log2(size);
}

export type BsiRating =
  { ok: true; example: 'long' | 'long-two-kinds' | 'short-four-kinds' } | { ok: false };

/**
 * Vergleich mit den Beispielen des BSI (docs/passwort-bsi.md):
 * - lang: mindestens 25 Zeichen
 * - 20 bis 25 Zeichen und zwei Zeichenarten
 * - 8 bis 12 Zeichen und vier Zeichenarten (längere mit vier Zeichenarten erst recht)
 * Das dritte Beispiel (8 Zeichen, drei Zeichenarten plus Mehr-Faktor-Authentisierung) hängt
 * vom Dienst ab und wird hier nicht vergeben.
 */
export function rateAgainstBsi(length: number, kinds: number): BsiRating {
  if (length >= 25) return { ok: true, example: 'long' };
  if (length >= 20 && kinds >= 2) return { ok: true, example: 'long-two-kinds' };
  if (length >= 8 && kinds >= 4) return { ok: true, example: 'short-four-kinds' };
  return { ok: false };
}

/** Das BSI nennt für WLAN-Passwörter (WPA2, WPA3) mindestens 20 Zeichen. */
export const BSI_WLAN_MIN_LENGTH = 20;
