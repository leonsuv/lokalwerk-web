/**
 * Werkzeugseite „Prüfsumme berechnen“ (plan-phase2.md, Werkzeug 26). Die Berechnung läuft im
 * Worker; diese Datei zeigt Fortschritt, Ergebnis und den Vergleich mit einer Eingabe.
 */

import { formatBytes } from '../../core/format/bytes.ts';
import { parseExpectedHash, type HashAlgorithm } from '../../core/hash/sha.ts';
import { $ } from '../../ui/dom.ts';
import { preventAccidentalFileOpen, wireDropzone } from '../../ui/dropzone.ts';
import { countLocalBytes } from '../../ui/local-counter.ts';
import { showToast } from '../../ui/toast.ts';
import { createWorkerClient, WorkerError } from '../../ui/worker-protocol.ts';
import type { HashProgress, HashRequest, HashResult } from './hash.worker.ts';

const MESSAGES: Record<string, string> = {
  unreadable:
    'Die Datei konnte nicht gelesen werden. Prüfe, ob sie noch am selben Ort liegt, und füge sie erneut hinzu.',
  mismatch:
    'Die Gegenprobe mit der Kryptografie des Browsers ergab ein anderes Ergebnis. Lade die Seite neu und versuch es noch einmal.',
  'worker-failed': 'Das Werkzeug konnte nicht starten. Lade die Seite neu.',
};
const FALLBACK =
  'Die Prüfsumme konnte nicht berechnet werden. Lade die Seite neu und versuch es noch einmal.';
const messageFor = (error: unknown): string =>
  (error instanceof WorkerError ? MESSAGES[error.code] : undefined) ?? FALLBACK;

// Worker sofort starten, danach geht alles offline (plan.md N4).
const worker = new Worker(new URL('./hash.worker.ts', import.meta.url), { type: 'module' });
const client = createWorkerClient<HashRequest>(worker);

const fileList = $<HTMLUListElement>('#hash-file');
const tableBody = $('#hash-table tbody');
const expected = $<HTMLInputElement>('#hash-expected');
const compare = $('#hash-compare');
const clearButton = $<HTMLButtonElement>('#hash-clear');

type Current =
  | { state: 'running'; file: File; percent: number }
  | { state: 'done'; file: File; result: HashResult }
  | { state: 'error'; file: File; error: string };
let current: Current | null = null;

function fileRow(entry: Current): HTMLLIElement {
  const li = document.createElement('li');
  const meta = document.createElement('div');
  meta.className = 'meta';
  const name = document.createElement('b');
  name.textContent = entry.file.name;
  const info = document.createElement('span');
  const size = formatBytes(entry.file.size);
  if (entry.state === 'running') info.textContent = `${size}, wird berechnet … ${entry.percent} %`;
  if (entry.state === 'done') info.textContent = size;
  if (entry.state === 'error') {
    const error = document.createElement('span');
    error.className = 'err';
    error.textContent = entry.error;
    info.append(`${size}, `, error);
  }
  meta.append(name, info);
  li.append(meta);
  return li;
}

function hashRow(algorithm: HashAlgorithm, hex: string, note: string): HTMLTableRowElement {
  const tr = document.createElement('tr');
  const th = document.createElement('th');
  th.scope = 'row';
  th.textContent = algorithm;
  const td = document.createElement('td');
  td.className = 'mono';
  td.textContent = hex;
  const noteCell = document.createElement('td');
  noteCell.className = 'hint';
  noteCell.textContent = note;
  const action = document.createElement('td');
  const copy = document.createElement('button');
  copy.type = 'button';
  copy.className = 'btn ghost sm';
  copy.dataset.hex = hex;
  copy.textContent = 'Kopieren';
  copy.setAttribute('aria-label', `${algorithm} kopieren`);
  action.append(copy);
  tr.append(th, td, noteCell, action);
  return tr;
}

function renderCompare(): void {
  compare.replaceChildren();
  if (current?.state !== 'done' || expected.value.trim() === '') return;
  const parsed = parseExpectedHash(expected.value);
  const badge = document.createElement('span');
  if (!parsed) {
    badge.className = 'badge err';
    badge.textContent =
      'Keine SHA-256- oder SHA-1-Prüfsumme erkannt. Füge die ganze Prüfsumme ein (64 oder 40 Zeichen).';
  } else {
    const actual = parsed.algorithm === 'SHA-256' ? current.result.sha256 : current.result.sha1;
    const same = actual === parsed.hex;
    badge.className = same ? 'badge ok' : 'badge err';
    badge.textContent = same
      ? `Stimmt überein (${parsed.algorithm}).`
      : `Stimmt nicht überein (${parsed.algorithm}). Die Datei ist verändert, unvollständig oder eine andere.`;
  }
  compare.append(badge);
}

function render(): void {
  fileList.replaceChildren(...(current ? [fileRow(current)] : []));
  $('#hash-empty').hidden = current !== null;
  const result = current?.state === 'done' ? current.result : null;
  $('#hash-panel').hidden = result === null;
  if (result) {
    tableBody.replaceChildren(
      hashRow('SHA-256', result.sha256, 'Standard'),
      hashRow('SHA-1', result.sha1, 'veraltet, nur zum Vergleich'),
    );
    $('#hash-cross').textContent =
      result.crossCheck === 'ok'
        ? 'Gegenprobe mit der Kryptografie des Browsers: gleiches Ergebnis.'
        : 'Bei Dateien über 64 MB entfällt die Gegenprobe mit der Kryptografie des Browsers.';
  }
  clearButton.disabled = current === null || current.state === 'running';
  renderCompare();
}

async function run(file: File): Promise<void> {
  current = { state: 'running', file, percent: 0 };
  render();
  try {
    const result = await client.request<HashResult>({ type: 'hash', file }, (progress) => {
      const { done, total } = progress as HashProgress;
      if (current?.file !== file || current.state !== 'running') return;
      current.percent = total > 0 ? Math.floor((done / total) * 100) : 0;
      render();
    });
    if (current.file !== file) return;
    current = { state: 'done', file, result };
    countLocalBytes(file.size);
  } catch (error) {
    if (current.file !== file) return;
    current = { state: 'error', file, error: messageFor(error) };
  }
  render();
}

tableBody.addEventListener('click', (event) => {
  const button = (event.target as Element).closest<HTMLButtonElement>('button[data-hex]');
  if (!button?.dataset.hex) return;
  navigator.clipboard.writeText(button.dataset.hex).then(
    () => showToast('Prüfsumme kopiert.'),
    () => showToast('Kopieren ist hier nicht möglich. Markiere die Prüfsumme und kopiere sie.'),
  );
});
expected.addEventListener('input', renderCompare);
clearButton.addEventListener('click', () => {
  current = null;
  render();
  $<HTMLInputElement>('#hash-input').focus();
});

preventAccidentalFileOpen();
wireDropzone($('#hash-drop'), $<HTMLInputElement>('#hash-input'), (files) => {
  const [file] = files;
  if (!file) return;
  if (files.length > 1) showToast('Es wird eine Datei auf einmal geprüft: die erste.');
  if (current?.state === 'running') {
    showToast('Warte, bis die laufende Berechnung fertig ist.');
    return;
  }
  void run(file);
});
render();
