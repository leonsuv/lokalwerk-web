/**
 * Zeilen eines Etiketts aus Spalten der Liste (plan-phase2.md Werkzeug 24). Jede Zeile setzt
 * sich aus bis zu drei Spalten zusammen, mit Leerzeichen verbunden, z. B. „Vorname Nachname“
 * oder „PLZ Ort“. Leere Zeilen fallen weg. Die Zuordnung wird aus den Überschriften geraten und
 * lässt sich in der Oberfläche ändern.
 */

export const MAX_LINES = 5;
export const COLUMNS_PER_LINE = 3;

/** Je Zeile die Spaltennummern, -1 = keine */
export type LinePlan = number[][];

export const emptyPlan = (): LinePlan =>
  Array.from({ length: MAX_LINES }, () => Array<number>(COLUMNS_PER_LINE).fill(-1));

/**
 * Muster je Zeile, in Anzeige-Reihenfolge; jede Gruppe wird eine Zeile. Ein bloßes „Nr“ zählt
 * nicht als Hausnummer, in Mitgliederlisten ist es meist die Mitgliedsnummer.
 */
const LINE_PATTERNS: readonly (readonly RegExp[])[] = [
  [/firma|unternehmen|organisation|verein|institution|behörde|behoerde|company/i],
  [/anrede|titel/i, /vorname|first/i, /nachname|familienname|^name$|last/i],
  [/^(?!.*mail).*(stra(ß|ss)e|str\.|anschrift|adresse|street)/i, /haus\s*-?nr|hausnummer/i],
  [/plz|postleitzahl|zip/i, /^ort$|stadt|wohnort|city/i],
  [/^land$|staat|country/i],
];

const normalize = (h: string) => h.trim();

export function guessPlan(headers: readonly string[]): LinePlan {
  const plan = emptyPlan();
  const used = new Set<number>();
  let line = 0;
  for (const group of LINE_PATTERNS) {
    let slot = 0;
    for (const pattern of group) {
      const index = headers.findIndex((h, i) => !used.has(i) && pattern.test(normalize(h)));
      if (index < 0) continue;
      used.add(index);
      const target = plan[line];
      if (target) target[slot++] = index;
    }
    if (slot > 0) line++;
  }
  // Nichts erkannt: die ersten Spalten untereinander
  if (line === 0) {
    headers.slice(0, MAX_LINES).forEach((_, i) => {
      const target = plan[i];
      if (target) target[0] = i;
    });
  }
  return plan;
}

/** Text der Zeilen für eine Zeile der Liste; Leerraum zusammengefasst, leere Zeilen entfernt */
export function labelLines(row: readonly string[], plan: LinePlan): string[] {
  return plan
    .map((columns) =>
      columns
        .filter((c) => c >= 0)
        .map((c) => (row[c] ?? '').replace(/\s+/g, ' ').trim())
        .filter((t) => t !== '')
        .join(' '),
    )
    .filter((t) => t !== '');
}

export const planIsEmpty = (plan: LinePlan): boolean => plan.every((l) => l.every((c) => c < 0));
