/**
 * Werkzeugseite „Vorder- und Rückseiten mischen“: zwei PDFs (Vorderseiten, Rückseiten) werden
 * abwechselnd zu einer zusammengesetzt. Nichts wird gespeichert (AGENTS.md Regel 5).
 */

import { isPdf } from '../../core/files/classify.ts';
import { formatBytes } from '../../core/format/bytes.ts';
import { $, $$ } from '../../ui/dom.ts';
import { saveBlob } from '../../ui/download.ts';
import { preventAccidentalFileOpen, wireDropzone } from '../../ui/dropzone.ts';
import { countLocalBytes } from '../../ui/local-counter.ts';
import { PDF_MESSAGES } from '../../ui/pdf-tool.ts';
import { showToast } from '../../ui/toast.ts';
import { createWorkerClient, WorkerError } from '../../ui/worker-protocol.ts';
import type { InterleaveRequest } from './interleave.worker.ts';

type Slot = 'front' | 'back';
type Entry =
  | { state: 'checking'; file: File }
  | { state: 'ok'; file: File; pages: number }
  | { state: 'error'; file: File; error: string };

const FALLBACK =
  'Die Datei konnte nicht verarbeitet werden. Lade die Seite neu und versuch es noch einmal.';
const client = createWorkerClient<InterleaveRequest>(
  new Worker(new URL('./interleave.worker.ts', import.meta.url), { type: 'module' }),
);
const messageFor = (error: unknown): string =>
  (error instanceof WorkerError ? PDF_MESSAGES[error.code] : undefined) ?? FALLBACK;

const entries: Record<Slot, Entry | null> = { front: null, back: null };
let reverseBack = true;
let busy = false;

const saveButton = $<HTMLButtonElement>('#mix-save');
const saveLabel = $('#mix-save-label');
const clearButton = $<HTMLButtonElement>('#mix-clear');
const idleLabel = saveLabel.textContent ?? '';
const buttons = $$<HTMLButtonElement>('button[data-reverse]');

function row(entry: Entry): HTMLLIElement {
  const li = document.createElement('li');
  const num = document.createElement('span');
  num.className = 'num';
  num.textContent = '1';
  const meta = document.createElement('div');
  meta.className = 'meta';
  const name = document.createElement('b');
  name.textContent = entry.file.name;
  const info = document.createElement('span');
  const size = formatBytes(entry.file.size);
  if (entry.state === 'checking') info.textContent = `${size}, wird geprüft …`;
  if (entry.state === 'ok') {
    info.textContent = `${entry.pages} ${entry.pages === 1 ? 'Seite' : 'Seiten'}, ${size}`;
  }
  if (entry.state === 'error') {
    const error = document.createElement('span');
    error.className = 'err';
    error.textContent = entry.error;
    info.append(`${size}, `, error);
  }
  meta.append(name, info);
  li.append(num, meta);
  return li;
}

function render(): void {
  for (const slot of ['front', 'back'] as const) {
    const entry = entries[slot];
    $(`#mix-${slot}-file`).replaceChildren(...(entry ? [row(entry)] : []));
  }
  for (const b of buttons) {
    b.setAttribute('aria-pressed', String((b.dataset.reverse === 'yes') === reverseBack));
  }
  const { front, back } = entries;
  const ready = front?.state === 'ok' && back?.state === 'ok';
  const note = $('#mix-note');
  note.hidden = !ready || front.pages === back.pages;
  if (ready) {
    note.textContent = `Die Dateien haben verschieden viele Seiten (${front.pages} und ${back.pages}). Die übrigen Seiten der längeren Datei werden hinten angehängt. Prüfe, ob beide Stapel vollständig gescannt sind.`;
  }
  $('#mix-empty').hidden = front !== null || back !== null;
  saveButton.disabled = busy || !ready;
  clearButton.disabled = busy || (front === null && back === null);
}

async function inspect(slot: Slot, file: File): Promise<void> {
  entries[slot] = { state: 'checking', file };
  render();
  try {
    const pages = await client.request<number>({ type: 'inspect', file });
    if (entries[slot]?.file !== file) return;
    entries[slot] = { state: 'ok', file, pages };
  } catch (error) {
    if (entries[slot]?.file !== file) return;
    entries[slot] = { state: 'error', file, error: messageFor(error) };
  }
  render();
}

/** Mit einer Datei füllt sie das genannte Fach, mit zwei Dateien die Fächer in dieser Reihenfolge */
function takeFiles(files: File[], slot: Slot): void {
  const pdfs = files.filter(isPdf);
  if (pdfs.length === 0) {
    showToast('Nur PDF-Dateien werden übernommen.');
    return;
  }
  if (pdfs.length > 2)
    showToast('Es werden zwei PDFs gebraucht: die ersten beiden werden genommen.');
  const [first, second] = pdfs;
  if (first && second) {
    void inspect('front', first);
    void inspect('back', second);
  } else if (first) {
    void inspect(slot, first);
  }
}

async function save(): Promise<void> {
  const { front, back } = entries;
  if (front?.state !== 'ok' || back?.state !== 'ok') return;
  busy = true;
  saveLabel.textContent = 'Wird gemischt …';
  render();
  try {
    const bytes = await client.request<Uint8Array>({
      type: 'run',
      front: front.file,
      back: back.file,
      reverseBack,
    });
    const base = front.file.name.replace(/\.pdf$/i, '').trim() || 'dokument';
    saveBlob(
      `${base}-gemischt.pdf`,
      new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }),
    );
    countLocalBytes(front.file.size + back.file.size);
    showToast('Fertig: Vorder- und Rückseiten sind gemischt und die neue PDF ist gespeichert.');
  } catch (error) {
    showToast(messageFor(error));
  } finally {
    busy = false;
    saveLabel.textContent = idleLabel;
    render();
  }
}

preventAccidentalFileOpen();
for (const slot of ['front', 'back'] as const) {
  wireDropzone($(`#mix-${slot}-drop`), $<HTMLInputElement>(`#mix-${slot}-input`), (files) => {
    takeFiles(files, slot);
  });
}
for (const b of buttons) {
  b.addEventListener('click', () => {
    reverseBack = b.dataset.reverse === 'yes';
    render();
  });
}
saveButton.addEventListener('click', () => {
  void save();
});
clearButton.addEventListener('click', () => {
  entries.front = null;
  entries.back = null;
  render();
  $<HTMLInputElement>('#mix-front-input').focus();
});
render();

/** Von der Startseite: zwei Dateien füllen beide Fächer, eine das erste freie */
export function openFiles(files: File[]): void {
  takeFiles(files, entries.front === null || entries.back !== null ? 'front' : 'back');
}
