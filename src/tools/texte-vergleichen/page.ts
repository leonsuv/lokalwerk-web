/**
 * Werkzeugseite „Texte vergleichen“ (plan-phase2.md, Werkzeug 27). Der Vergleich läuft im
 * Worker; diese Datei zeigt das Ergebnis. Texte werden nicht gespeichert (AGENTS.md Regel 5).
 */

import { decodeText } from '../../core/csv/decode.ts';
import type { CompareResult, Row } from '../../core/text/compare.ts';
import { $, $$ } from '../../ui/dom.ts';
import { countLocalBytes } from '../../ui/local-counter.ts';
import { showToast } from '../../ui/toast.ts';
import { createWorkerClient, WorkerError } from '../../ui/worker-protocol.ts';
import type { CompareRequest } from './compare.worker.ts';

const worker = new Worker(new URL('./compare.worker.ts', import.meta.url), { type: 'module' });
const client = createWorkerClient<CompareRequest>(worker);

const oldText = $<HTMLTextAreaElement>('#cmp-old');
const newText = $<HTMLTextAreaElement>('#cmp-new');
const runButton = $<HTMLButtonElement>('#cmp-run');
const runLabel = $('#cmp-run-label');
const resultCard = $('#cmp-result-card');
const diffBox = $('#cmp-diff');
const caseButtons = $$<HTMLButtonElement>('button[data-case]');
const spaceButtons = $$<HTMLButtonElement>('button[data-space]');
const viewButtons = $$<HTMLButtonElement>('button[data-view]');
const idleLabel = runLabel.textContent ?? '';

let ignoreCase = false;
let ignoreWhitespace = false;
let onlyChanges = false;
let result: CompareResult | null = null;

/** Zeilen um Änderungen herum, die bei „Nur Änderungen“ sichtbar bleiben */
const CONTEXT = 2;

function lineElement(row: Row): HTMLElement {
  const div = document.createElement('div');
  const oldNo = document.createElement('span');
  const newNo = document.createElement('span');
  const sign = document.createElement('span');
  oldNo.className = 'no';
  newNo.className = 'no';
  sign.className = 'sign';
  sign.setAttribute('aria-hidden', 'true');
  const text = document.createElement('span');
  const label = document.createElement('span');
  label.className = 'visually-hidden';

  if (row.kind === 'equal') {
    div.className = 'diff-line';
    oldNo.textContent = String(row.oldLine);
    newNo.textContent = String(row.newLine);
    text.textContent = row.text;
  } else {
    const deleted = row.kind === 'delete';
    div.className = `diff-line ${deleted ? 'del' : 'ins'}`;
    (deleted ? oldNo : newNo).textContent = String(deleted ? row.oldLine : row.newLine);
    sign.textContent = deleted ? '−' : '+';
    label.textContent = deleted ? 'Entfernt: ' : 'Hinzugefügt: ';
    text.append(label);
    for (const segment of row.segments) {
      if (!segment.changed || row.segments.length === 1) {
        text.append(segment.text);
        continue;
      }
      const mark = document.createElement(deleted ? 'del' : 'ins');
      mark.textContent = segment.text;
      text.append(mark);
    }
  }
  div.append(oldNo, newNo, sign, text);
  return div;
}

function gap(count: number): HTMLElement {
  const div = document.createElement('div');
  div.className = 'diff-gap';
  div.textContent = `${count} unveränderte ${count === 1 ? 'Zeile' : 'Zeilen'}`;
  return div;
}

function renderResult(): void {
  resultCard.hidden = result === null;
  if (!result) return;
  const { rows, deleted, inserted, unchanged } = result;
  const chips = [
    `${deleted} ${deleted === 1 ? 'Zeile' : 'Zeilen'} entfernt`,
    `${inserted} ${inserted === 1 ? 'Zeile' : 'Zeilen'} hinzugefügt`,
    `${unchanged} unverändert`,
  ].map((text) => {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.textContent = text;
    return chip;
  });
  $('#cmp-summary').replaceChildren(...chips);
  for (const b of viewButtons) {
    b.setAttribute('aria-pressed', String((b.dataset.view === 'changes') === onlyChanges));
  }

  if (deleted === 0 && inserted === 0) {
    const same = document.createElement('p');
    same.className = 'diff-gap';
    same.textContent = 'Die Texte sind gleich.';
    diffBox.replaceChildren(same);
    return;
  }
  const visible = rows.map((row, i) => {
    if (!onlyChanges || row.kind !== 'equal') return true;
    for (let d = -CONTEXT; d <= CONTEXT; d++)
      if (rows[i + d] && rows[i + d]?.kind !== 'equal') return true;
    return false;
  });
  const nodes: HTMLElement[] = [];
  let hidden = 0;
  rows.forEach((row, i) => {
    if (!visible[i]) {
      hidden++;
      return;
    }
    if (hidden > 0) nodes.push(gap(hidden));
    hidden = 0;
    nodes.push(lineElement(row));
  });
  if (hidden > 0) nodes.push(gap(hidden));
  diffBox.replaceChildren(...nodes);
}

function renderOptions(): void {
  for (const b of caseButtons)
    b.setAttribute('aria-pressed', String((b.dataset.case === 'ignore') === ignoreCase));
  for (const b of spaceButtons) {
    b.setAttribute('aria-pressed', String((b.dataset.space === 'ignore') === ignoreWhitespace));
  }
}

async function run(): Promise<void> {
  if (oldText.value === '' && newText.value === '') {
    showToast('Füge zuerst die beiden Texte ein oder lade sie als Textdatei.');
    oldText.focus();
    return;
  }
  runButton.disabled = true;
  runLabel.textContent = 'Wird verglichen …';
  try {
    result = await client.request<CompareResult>({
      oldText: oldText.value,
      newText: newText.value,
      options: { ignoreCase, ignoreWhitespace },
    });
    renderResult();
    $('#cmp-result-title').focus();
  } catch (error) {
    result = null;
    renderResult();
    showToast(
      error instanceof WorkerError && error.code === 'too-many'
        ? 'Die Texte unterscheiden sich in zu vielen Zeilen. Vergleiche kürzere Abschnitte.'
        : 'Der Vergleich hat nicht geklappt. Lade die Seite neu und versuch es noch einmal.',
    );
  } finally {
    runButton.disabled = false;
    runLabel.textContent = idleLabel;
  }
}

async function loadFile(input: HTMLInputElement, target: HTMLTextAreaElement): Promise<void> {
  const [file] = input.files ?? [];
  input.value = '';
  if (!file) return;
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    target.value = decodeText(bytes).text;
    countLocalBytes(file.size);
    showToast(`„${file.name}“ geladen.`);
  } catch {
    showToast('Die Datei konnte nicht gelesen werden. Speichere sie als Textdatei (.txt).');
  }
}

$<HTMLInputElement>('#cmp-old-file').addEventListener('change', (event) => {
  void loadFile(event.target as HTMLInputElement, oldText);
});
$<HTMLInputElement>('#cmp-new-file').addEventListener('change', (event) => {
  void loadFile(event.target as HTMLInputElement, newText);
});
runButton.addEventListener('click', () => {
  void run();
});
$('#cmp-clear').addEventListener('click', () => {
  oldText.value = '';
  newText.value = '';
  result = null;
  renderResult();
  oldText.focus();
});
for (const b of caseButtons) {
  b.addEventListener('click', () => {
    ignoreCase = b.dataset.case === 'ignore';
    renderOptions();
  });
}
for (const b of spaceButtons) {
  b.addEventListener('click', () => {
    ignoreWhitespace = b.dataset.space === 'ignore';
    renderOptions();
  });
}
for (const b of viewButtons) {
  b.addEventListener('click', () => {
    onlyChanges = b.dataset.view === 'changes';
    renderResult();
  });
}

renderOptions();
renderResult();
