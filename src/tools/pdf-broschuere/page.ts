/**
 * Werkzeugseite „Broschüre erstellen“. Gemeinsamer Ablauf: ui/pdf-tool.ts.
 */

import { mountPdfTool } from '../../ui/pdf-tool.ts';

const tool = mountPdfTool<Record<string, never>>({
  prefix: 'brs',
  worker: new Worker(new URL('./booklet.worker.ts', import.meta.url), { type: 'module' }),
  busyLabel: 'Broschüre wird erstellt …',
  options: () => ({}),
  suffix: '-broschuere',
  done: () =>
    'Fertig: Die Broschüre ist gespeichert. Druck sie beidseitig, Wenden an der langen Kante.',
});

export const { openFiles } = tool;
