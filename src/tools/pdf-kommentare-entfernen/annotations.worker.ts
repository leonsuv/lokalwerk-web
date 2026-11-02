/**
 * Web Worker für „PDF-Kommentare entfernen“: entfernt die gewählten Anmerkungen. Die Liste der
 * Anmerkungen kommt aus ./list.worker.ts. Lädt pdf-lib beim Start, damit die Seite danach offline
 * funktioniert (plan.md N4). Gegenstück zur Seite: ./page.ts.
 */

import { removeAnnotations } from '../../core/pdf/annotations.ts';
import { servePdfTool } from '../../ui/pdf-worker.ts';

export interface AnnotationOptions {
  /** Untertypen, deren Anmerkungen entfallen (z. B. „Highlight“) */
  types: string[];
}

servePdfTool<AnnotationOptions>(async (bytes, options) => {
  const { bytes: out } = await removeAnnotations(bytes, new Set(options.types));
  return [{ name: '', bytes: out }];
});
