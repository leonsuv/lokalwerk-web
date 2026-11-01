/**
 * Vorder- und Rückseiten zu einer PDF mischen (Werkzeug „Vorder- und Rückseiten mischen“),
 * wenn ein Einzugscanner erst alle Vorderseiten und dann alle Rückseiten erfasst hat. Ohne DOM,
 * läuft im Worker.
 *
 * Wird der Stapel zum Scannen der Rückseiten umgedreht, kommen die Rückseiten in umgekehrter
 * Reihenfolge heraus; dafür gibt es `reverseBack`.
 */

import { PDFDocument } from 'pdf-lib';
import { loadPdf, toPdfError } from './merge.ts';

export interface InterleaveStep {
  from: 'front' | 'back';
  /** Seitennummer in der jeweiligen Datei, ab 0 */
  index: number;
}

/**
 * Reihenfolge der Ausgabe: Vorderseite 1, Rückseite 1, Vorderseite 2, … Sind die Dateien
 * verschieden lang, werden die übrigen Seiten der längeren Datei hinten angehängt.
 */
export function interleaveOrder(
  frontCount: number,
  backCount: number,
  reverseBack: boolean,
): InterleaveStep[] {
  const steps: InterleaveStep[] = [];
  const backAt = (i: number): number => (reverseBack ? backCount - 1 - i : i);
  for (let i = 0; i < Math.max(frontCount, backCount); i++) {
    if (i < frontCount) steps.push({ from: 'front', index: i });
    if (i < backCount) steps.push({ from: 'back', index: backAt(i) });
  }
  return steps;
}

export async function interleavePdfs(
  frontBytes: Uint8Array,
  backBytes: Uint8Array,
  reverseBack: boolean,
  onProgress?: (done: number, total: number) => void,
): Promise<Uint8Array> {
  const front = await loadPdf(frontBytes);
  const back = await loadPdf(backBytes);
  try {
    const out = await PDFDocument.create({ updateMetadata: false });
    const steps = interleaveOrder(front.getPageCount(), back.getPageCount(), reverseBack);
    for (const [n, step] of steps.entries()) {
      const [page] = await out.copyPages(step.from === 'front' ? front : back, [step.index]);
      if (page) out.addPage(page);
      onProgress?.(n + 1, steps.length);
    }
    return await out.save();
  } catch (error) {
    throw toPdfError(error);
  }
}
