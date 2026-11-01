/**
 * Werkzeugseite „PDF-Seiten halbieren“. Gemeinsamer Ablauf: ui/pdf-tool.ts.
 */

import type { HalveDirection } from '../../core/pdf/halve.ts';
import { $$ } from '../../ui/dom.ts';
import { mountPdfTool } from '../../ui/pdf-tool.ts';
import type { HalveOptions } from './halve.worker.ts';

const buttons = $$<HTMLButtonElement>('button[data-direction]');
let direction: HalveDirection = 'vertical';

const tool = mountPdfTool<HalveOptions>({
  prefix: 'hlv',
  worker: new Worker(new URL('./halve.worker.ts', import.meta.url), { type: 'module' }),
  busyLabel: 'Wird geteilt …',
  options: () => ({ direction }),
  suffix: '-halbiert',
  done: () => 'Fertig: Jede Seite ist in zwei Hälften geteilt und die neue PDF gespeichert.',
});

function render(): void {
  for (const b of buttons)
    b.setAttribute('aria-pressed', String(b.dataset.direction === direction));
  tool.render();
}
for (const b of buttons) {
  b.addEventListener('click', () => {
    direction = b.dataset.direction === 'horizontal' ? 'horizontal' : 'vertical';
    render();
  });
}
render();

export const { openFiles } = tool;
