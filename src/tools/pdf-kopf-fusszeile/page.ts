/**
 * Werkzeugseite „Kopf- und Fußzeile“. Gemeinsamer Ablauf: ui/pdf-tool.ts. Die Seite liest die
 * Texte, prüft die Zeichen und die Seitenangabe und liefert die Einstellungen an den Worker.
 */

import {
  isEmptyHeaderFooter,
  type HeaderFooterOptions,
  type Row,
  type RowTexts,
  type Slot,
  selectPages,
  unsupportedInOptions,
} from '../../core/pdf/header-footer-layout.ts';
import type { PageRangeError } from '../../core/pdf/page-ranges.ts';
import { $ } from '../../ui/dom.ts';
import { mountPdfTool } from '../../ui/pdf-tool.ts';

const ROW_ID: Record<Row, string> = { header: 'h', footer: 'f' };
const ROWS: readonly Row[] = ['header', 'footer'];
const SLOTS: readonly Slot[] = ['left', 'center', 'right'];

const textInputs = ROWS.flatMap((row) =>
  SLOTS.map((slot) => ({
    row,
    slot,
    input: $<HTMLInputElement>(`#hf-${ROW_ID[row]}-${slot}`),
  })),
);
const numRow = $<HTMLSelectElement>('#hf-num-row');
const numSlot = $<HTMLSelectElement>('#hf-num-slot');
const numFormat = $<HTMLInputElement>('#hf-num-format');
const sizeSelect = $<HTMLSelectElement>('#hf-size');
const marginSelect = $<HTMLSelectElement>('#hf-margin');
const pagesInput = $<HTMLInputElement>('#hf-pages');
const pagesError = $('#hf-pages-error');
const textError = $('#hf-text-error');
let total = 0;

const emptyRow = (): RowTexts => ({ left: '', center: '', right: '' });

function pagesMessage(error: PageRangeError): string {
  switch (error.code) {
    case 'out-of-range':
      return `„${error.part}“ gibt es nicht: Die PDF hat ${total} ${total === 1 ? 'Seite' : 'Seiten'}.`;
    case 'reversed':
      return `Bei „${error.part}“ muss die erste Seite vor der letzten stehen.`;
    case 'syntax':
      return `„${error.part}“ ist keine Seitenangabe. Schreib Seiten wie 5 oder Bereiche wie 1-3.`;
    case 'empty':
      return '';
  }
}

interface Reading {
  options: HeaderFooterOptions | null;
  pages: string;
  text: string;
}

/** Liest alle Felder. `options` ist null, solange etwas fehlt oder ungültig ist. */
function read(): Reading {
  const texts: Record<Row, RowTexts> = { header: emptyRow(), footer: emptyRow() };
  for (const { row, slot, input } of textInputs) texts[row][slot] = input.value;
  const row = numRow.value;
  const number =
    row === 'none'
      ? null
      : { row: row as Row, slot: numSlot.value as Slot, format: numFormat.value };

  let pages: number[] | null = null;
  let pagesText = '';
  if (total > 0) {
    const selected = selectPages(pagesInput.value, total);
    if (selected.ok) pages = selected.pages;
    else pagesText = pagesMessage(selected.error);
  }

  const base = {
    texts,
    number,
    fontSize: Number(sizeSelect.value),
    marginMm: Number(marginSelect.value),
    pages,
  };
  const missing = unsupportedInOptions(base);
  let textMessage = '';
  if (missing.length > 0) {
    textMessage = `Die Schrift kann diese Zeichen nicht darstellen: ${missing.map((c) => `„${c}“`).join(' ')}. Ersetze sie durch andere Zeichen.`;
  } else if (total > 0 && isEmptyHeaderFooter(base)) {
    textMessage = 'Trage mindestens einen Text oder eine Seitenzahl ein.';
  }

  const ready = total > 0 && pagesText === '' && textMessage === '' && !isEmptyHeaderFooter(base);
  return { options: ready ? base : null, pages: pagesText, text: textMessage };
}

const tool = mountPdfTool<HeaderFooterOptions>({
  prefix: 'hf',
  worker: new Worker(new URL('./header.worker.ts', import.meta.url), { type: 'module' }),
  busyLabel: 'Wird beschriftet …',
  options: () => read().options,
  suffix: '-mit-kopf-fusszeile',
  done: () => 'Fertig: Die PDF mit Kopf- und Fußzeile ist gespeichert.',
  messages: {
    'unsupported-chars':
      'Die Schrift kann mindestens ein Zeichen nicht darstellen. Ersetze die Zeichen in den Feldern und versuch es noch einmal.',
    nothing: 'Trage mindestens einen Text oder eine Seitenzahl ein.',
  },
  onFile: (pages) => {
    total = pages ?? 0;
    render();
  },
});

function render(): void {
  const reading = read();
  pagesError.textContent = reading.pages;
  textError.textContent = reading.text;
  pagesInput.setAttribute('aria-invalid', String(reading.pages !== ''));
  const noNumber = numRow.value === 'none';
  numSlot.disabled = noNumber;
  numFormat.disabled = noNumber;
  tool.render();
}

for (const { input } of textInputs) input.addEventListener('input', render);
for (const el of [numRow, numSlot, sizeSelect, marginSelect]) {
  el.addEventListener('change', render);
}
numFormat.addEventListener('input', render);
pagesInput.addEventListener('input', render);
render();

export const { openFiles } = tool;
