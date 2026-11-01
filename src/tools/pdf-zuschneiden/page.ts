/**
 * Werkzeugseite „PDF zuschneiden“. Gemeinsamer Ablauf: ui/pdf-tool.ts.
 */

import { POINTS_PER_MM } from '../../core/pdf/crop-geometry.ts';
import { pageIndices, parsePageRanges } from '../../core/pdf/page-ranges.ts';
import { $ } from '../../ui/dom.ts';
import { mountPdfTool } from '../../ui/pdf-tool.ts';
import type { CropOptions } from './crop.worker.ts';

const SIDES = ['top', 'right', 'bottom', 'left'] as const;
const inputs = Object.fromEntries(
  SIDES.map((s) => [s, $<HTMLInputElement>(`#crp-${s}`)]),
) as Record<(typeof SIDES)[number], HTMLInputElement>;
const pagesInput = $<HTMLInputElement>('#crp-pages');
const marginError = $('#crp-margin-error');
const pagesError = $('#crp-pages-error');
let total = 0;

/** „5“ oder „5,5“ in Millimetern; leer gilt als 0 */
function parseMm(text: string): number | null {
  const t = text.trim().replace(',', '.');
  if (t === '') return 0;
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  return n <= 1000 ? n : null;
}

function readOptions(): { options: CropOptions | null; margin: string; pages: string } {
  const values = SIDES.map((s) => parseMm(inputs[s].value));
  let margin = '';
  if (values.some((v) => v === null)) {
    margin = 'Gib die Ränder als Zahl in Millimetern ein, zum Beispiel 5 oder 12,5.';
  }
  let pages: number[] | null = null;
  let pagesMessage = '';
  if (pagesInput.value.trim() !== '' && total > 0) {
    const parsed = parsePageRanges(pagesInput.value, total);
    if (parsed.ok) pages = parsed.ranges.flatMap(pageIndices);
    else {
      const e = parsed.error;
      pagesMessage =
        e.code === 'out-of-range'
          ? `„${e.part}“ gibt es nicht: Die PDF hat ${total} ${total === 1 ? 'Seite' : 'Seiten'}.`
          : e.code === 'reversed'
            ? `Bei „${e.part}“ muss die erste Seite vor der letzten stehen.`
            : e.code === 'syntax'
              ? `„${e.part}“ ist keine Seitenangabe. Schreib Seiten wie 5 oder Bereiche wie 1-3.`
              : '';
    }
  }
  const [top, right, bottom, left] = values;
  const none = values.every((v) => v === 0);
  const ready = !margin && !pagesMessage && !none;
  return {
    options: ready
      ? {
          margins: {
            top: (top ?? 0) * POINTS_PER_MM,
            right: (right ?? 0) * POINTS_PER_MM,
            bottom: (bottom ?? 0) * POINTS_PER_MM,
            left: (left ?? 0) * POINTS_PER_MM,
          },
          pages,
        }
      : null,
    margin,
    pages: pagesMessage,
  };
}

const tool = mountPdfTool<CropOptions>({
  prefix: 'crp',
  worker: new Worker(new URL('./crop.worker.ts', import.meta.url), { type: 'module' }),
  busyLabel: 'Wird zugeschnitten …',
  options: () => readOptions().options,
  suffix: '-zugeschnitten',
  done: () => 'Fertig: Die Seiten sind zugeschnitten und die neue PDF ist gespeichert.',
  messages: {
    'margins-too-large':
      'Die Ränder sind größer als eine der Seiten. Verkleinere sie oder wähle nur passende Seiten.',
  },
  onFile: (pages) => {
    total = pages ?? 0;
    render();
  },
});

function render(): void {
  const { margin, pages } = readOptions();
  marginError.textContent = margin;
  pagesError.textContent = pages;
  for (const s of SIDES) inputs[s].setAttribute('aria-invalid', String(margin !== ''));
  pagesInput.setAttribute('aria-invalid', String(pages !== ''));
  tool.render();
}
for (const el of [...Object.values(inputs), pagesInput]) el.addEventListener('input', render);
render();

export const { openFiles } = tool;
