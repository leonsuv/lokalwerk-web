/**
 * Trennzeichen erkennen: ; , oder Tab. Jedes wird probeweise auf die ersten Zeilen angewendet
 * (mit Anführungszeichen-Regeln). Gewinnt, wer die meisten Zeilen mit derselben Spaltenzahl
 * größer 1 erzeugt; bei Gleichstand mehr Spalten, dann Semikolon (in Deutschland üblich).
 */

import { parseCsv, type Delimiter } from './parse.ts';

const CANDIDATES: Delimiter[] = [';', ',', '\t'];
const SAMPLE_LINES = 20;

function sample(text: string): string {
  // Genug Text für ~20 Zeilen; ein angeschnittenes Anführungszeichen am Ende ist egal,
  // weil nur vollständige Zeilen gezählt werden.
  const lines = text.split(/\r\n|\n|\r/);
  return lines.slice(0, SAMPLE_LINES).join('\n');
}

function score(text: string, delimiter: Delimiter): { rows: number; columns: number } {
  let rows: string[][];
  try {
    rows = parseCsv(text, delimiter);
  } catch {
    rows = parseCsv(text.replace(/"/g, ''), delimiter);
  }
  const counts = rows.filter((r) => r.some((c) => c.trim() !== '')).map((r) => r.length);
  const frequency = new Map<number, number>();
  for (const c of counts) if (c > 1) frequency.set(c, (frequency.get(c) ?? 0) + 1);
  let best = { rows: 0, columns: 1 };
  for (const [columns, rowsWithCount] of frequency) {
    if (rowsWithCount > best.rows || (rowsWithCount === best.rows && columns > best.columns)) {
      best = { rows: rowsWithCount, columns };
    }
  }
  return best;
}

export function detectDelimiter(text: string): Delimiter {
  const head = sample(text);
  let winner: Delimiter = ';';
  let best = { rows: 0, columns: 1 };
  for (const delimiter of CANDIDATES) {
    const s = score(head, delimiter);
    if (s.rows > best.rows || (s.rows === best.rows && s.columns > best.columns)) {
      best = s;
      winner = delimiter;
    }
  }
  return winner;
}
