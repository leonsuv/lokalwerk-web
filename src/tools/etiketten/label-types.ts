/** Nachrichten zwischen der Seite „Etiketten aus einer Liste“ und ihrem Worker */

import type { LinePlan } from '../../core/labels/lines.ts';
import type { LabelProblem, PreparedLabel, PrepareOptions } from '../../core/labels/prepare.ts';
import type { TableReadError } from '../../core/table/read-file.ts';

export type LabelRequest =
  | { type: 'read'; file: File }
  | { type: 'prepare'; options: PrepareOptions }
  | { type: 'build'; options: PrepareOptions; start: number; test: boolean };

export type LabelRead =
  | { ok: true; headers: string[]; rows: number; sheet: string | null; plan: LinePlan }
  | { ok: false; code: TableReadError | 'unreadable'; line?: number };

export interface LabelPrepared {
  count: number;
  empty: number;
  shrunk: number;
  problems: LabelProblem[];
  /** Etiketten für die Vorschau des ersten Blatts */
  preview: PreparedLabel[];
}
