/**
 * Werkzeugseite „Seitengröße ändern“. Gemeinsamer Ablauf: ui/pdf-tool.ts.
 */

import type { ResizeOptions } from '../../core/pdf/resize.ts';
import type { FitMode, TargetChoice } from '../../core/pdf/resize-geometry.ts';
import { $ } from '../../ui/dom.ts';
import { mountPdfTool } from '../../ui/pdf-tool.ts';

const sizeSelect = $<HTMLSelectElement>('#rsz-size');
const modeSelect = $<HTMLSelectElement>('#rsz-mode');

// Die Einstellungen werden erst beim Speichern gelesen, Änderungen brauchen kein render().
const tool = mountPdfTool<ResizeOptions>({
  prefix: 'rsz',
  worker: new Worker(new URL('./resize.worker.ts', import.meta.url), { type: 'module' }),
  busyLabel: 'Wird geändert …',
  options: () => ({
    size: sizeSelect.value as TargetChoice,
    mode: modeSelect.value as FitMode,
  }),
  suffix: '-neue-groesse',
  done: () => 'Fertig: Die neue PDF ist gespeichert.',
  messages: {
    'page-too-small':
      'Eine Seite ist zu klein für den Rand. Wähle DIN A4, DIN A5 oder US Letter statt „Wie das Blatt“.',
  },
});

export const { openFiles } = tool;
