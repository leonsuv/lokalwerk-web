/**
 * Web Worker für „Briefpapier überlagern“. Lädt pdf-lib beim Start (plan.md N4).
 */

import { overlayLetterhead, type LetterheadSettings } from '../../core/pdf/letterhead.ts';
import { readFile, servePdfTool } from '../../ui/pdf-worker.ts';

/** Einstellungen plus das Briefpapier, das die Seite als Datei mitschickt */
export type BriefpapierOptions = LetterheadSettings & { letterhead: File };

servePdfTool<BriefpapierOptions>(async (bytes, options) => [
  {
    name: '',
    bytes: await overlayLetterhead(bytes, await readFile(options.letterhead), options),
  },
]);
