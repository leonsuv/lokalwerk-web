/** Web Worker für „Texte vergleichen“: lange Texte frieren die Seite so nicht ein. */

import { compareTexts, type CompareResult } from '../../core/text/compare.ts';
import type { CompareOptions } from '../../core/text/diff.ts';
import { serveRequests, WorkerError } from '../../ui/worker-protocol.ts';

export interface CompareRequest {
  oldText: string;
  newText: string;
  options: CompareOptions;
}
export type { CompareResult };

serveRequests<CompareRequest>(async ({ oldText, newText, options }) => {
  const result = compareTexts(oldText, newText, options);
  if (!result) throw new WorkerError('too-many');
  return Promise.resolve({ result });
});
