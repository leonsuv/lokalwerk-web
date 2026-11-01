/**
 * Werkzeugseite „Mehrere Seiten pro Blatt“. Gemeinsamer Ablauf: ui/pdf-tool.ts.
 */

import { $, $$ } from '../../ui/dom.ts';
import { mountPdfTool } from '../../ui/pdf-tool.ts';
import type { NUpOptions } from './nup.worker.ts';

const perSheet = $<HTMLSelectElement>('#nup-per');
const borderButtons = $$<HTMLButtonElement>('button[data-border]');
let border = false;

const tool = mountPdfTool<NUpOptions>({
  prefix: 'nup',
  worker: new Worker(new URL('./nup.worker.ts', import.meta.url), { type: 'module' }),
  busyLabel: 'Blätter werden erstellt …',
  options: () => ({ perSheet: Number(perSheet.value), border }),
  suffix: '-mehrere-pro-blatt',
  done: () => 'Fertig: Die neue PDF mit mehreren Seiten pro Blatt ist gespeichert.',
});

function render(): void {
  for (const b of borderButtons) {
    b.setAttribute('aria-pressed', String((b.dataset.border === 'yes') === border));
  }
  tool.render();
}
perSheet.addEventListener('change', render);
for (const b of borderButtons) {
  b.addEventListener('click', () => {
    border = b.dataset.border === 'yes';
    render();
  });
}
render();

export const { openFiles } = tool;
