/**
 * Zeilen der Liste in Etiketten umsetzen und prüfen (plan-phase2.md Werkzeug 24). Nichts wird
 * stillschweigend gekürzt oder ersetzt: Zeilen mit Zeichen außerhalb von WinAnsi (Entscheidung
 * E8a) oder mit zu viel Text werden markiert, begründet und nicht gedruckt.
 */

import { unsupportedChars } from '../pdf/winansi.ts';
import { fitFontSize, MM_TO_PT } from './fit.ts';
import type { SheetSpec } from './layout.ts';
import { labelLines, type LinePlan } from './lines.ts';

export interface PreparedLabel {
  lines: string[];
  /** Schriftgröße in Punkt */
  size: number;
}

export type LabelProblem =
  { line: number; reason: 'charset'; chars: string[] } | { line: number; reason: 'too-long' };

export interface Prepared {
  labels: PreparedLabel[];
  problems: LabelProblem[];
  /** Zeilen der Liste ohne Text in den gewählten Spalten */
  empty: number;
  /** Zeilen der Liste, bei denen die Schrift verkleinert wurde */
  shrunk: number;
}

export interface PrepareOptions {
  plan: LinePlan;
  sheet: SheetSpec;
  /** Innenabstand des Etiketts in mm, an allen Seiten */
  padding: number;
  /** gewünschte Schriftgröße in Punkt */
  fontSize: number;
}

/** Schreibfläche eines Etiketts in Punkt */
export function textBox(sheet: SheetSpec, padding: number): { width: number; height: number } {
  return {
    width: Math.max(0, sheet.labelWidth - 2 * padding) * MM_TO_PT,
    height: Math.max(0, sheet.labelHeight - 2 * padding) * MM_TO_PT,
  };
}

/**
 * @param rows Zeilen der Liste ohne Kopfzeile
 * @param widthAtOnePoint Textbreite in Punkt bei Schriftgröße 1
 * @param charset Zeichenvorrat der Schrift (Unicode-Codepunkte)
 */
export function prepareLabels(
  rows: readonly (readonly string[])[],
  options: PrepareOptions,
  widthAtOnePoint: (text: string) => number,
  charset: ReadonlySet<number>,
): Prepared {
  const box = textBox(options.sheet, options.padding);
  const result: Prepared = { labels: [], problems: [], empty: 0, shrunk: 0 };
  rows.forEach((row, i) => {
    // Zeilennummer wie im Tabellenprogramm: Kopfzeile ist 1
    const line = i + 2;
    const lines = labelLines(row, options.plan);
    if (lines.length === 0) {
      result.empty++;
      return;
    }
    const chars = unsupportedChars(lines.join(''), charset);
    if (chars.length > 0) {
      result.problems.push({ line, reason: 'charset', chars });
      return;
    }
    const size = fitFontSize(lines, widthAtOnePoint, box, options.fontSize);
    if (size === null) {
      result.problems.push({ line, reason: 'too-long' });
      return;
    }
    if (size < options.fontSize) result.shrunk++;
    result.labels.push({ lines, size });
  });
  return result;
}
