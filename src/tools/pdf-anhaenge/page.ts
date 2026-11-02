/**
 * Werkzeugseite „Anhänge verwalten“. Die Anhänge liest und schreibt der Worker; diese Datei
 * zeigt die Liste, sammelt die Änderungen und speichert das Ergebnis.
 */

import { isPdf } from '../../core/files/classify.ts';
import { formatBytes } from '../../core/format/bytes.ts';
import type { AttachmentInfo } from '../../core/pdf/attachments.ts';
import { sumAttachmentSizes } from '../../core/pdf/attachment-totals.ts';
import { $ } from '../../ui/dom.ts';
import { saveBlob } from '../../ui/download.ts';
import { preventAccidentalFileOpen, wireDropzone } from '../../ui/dropzone.ts';
import { countLocalBytes } from '../../ui/local-counter.ts';
import { PDF_MESSAGES } from '../../ui/pdf-tool.ts';
import { showToast } from '../../ui/toast.ts';
import { createWorkerClient, WorkerError } from '../../ui/worker-protocol.ts';
import type { AttachmentsRequest } from './attachments.worker.ts';

const MESSAGES: Record<string, string> = {
  ...PDF_MESSAGES,
  'duplicate-name':
    'Im Dokument gibt es schon einen Anhang mit diesem Namen. Benenne die Datei auf deinem Gerät um oder entferne den alten Anhang.',
};
const FALLBACK =
  'Die Datei konnte nicht verarbeitet werden. Lade die Seite neu und versuch es noch einmal.';

const messageFor = (error: unknown): string =>
  (error instanceof WorkerError ? MESSAGES[error.code] : undefined) ?? FALLBACK;

const worker = new Worker(new URL('./attachments.worker.ts', import.meta.url), { type: 'module' });
const client = createWorkerClient<AttachmentsRequest>(worker);

const fileList = $<HTMLUListElement>('#anh-file');
const addedList = $<HTMLUListElement>('#anh-added');
const panel = $('#anh-panel');
const tableBody = $('#anh-table tbody');
const saveButton = $<HTMLButtonElement>('#anh-save');
const saveLabel = $('#anh-save-label');
const clearButton = $<HTMLButtonElement>('#anh-clear');
const addInput = $<HTMLInputElement>('#anh-add-input');
const idleLabel = saveLabel.textContent ?? '';

type Current =
  | { state: 'checking'; file: File }
  | { state: 'ok'; file: File; attachments: AttachmentInfo[] }
  | { state: 'error'; file: File; error: string };

let current: Current | null = null;
let removed = new Set<number>();
let added: File[] = [];
let busy = false;

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Gleicher Name wie ein verbleibender Anhang oder ein anderer neuer: die PDF ließe sich nicht speichern */
function conflicts(): string[] {
  if (current?.state !== 'ok') return [];
  const kept = new Set(current.attachments.filter((a) => !removed.has(a.index)).map((a) => a.name));
  const seen = new Set<string>();
  const clashes: string[] = [];
  for (const file of added) {
    if (kept.has(file.name) || seen.has(file.name)) clashes.push(file.name);
    seen.add(file.name);
  }
  return clashes;
}

function fileRow(entry: Current): HTMLLIElement {
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
    info.textContent = `${count(entry.attachments.length, 'Anhang', 'Anhänge')}, ${size}`;
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

function attachmentRow(entry: AttachmentInfo): HTMLTableRowElement {
  const tr = document.createElement('tr');
  const isRemoved = removed.has(entry.index);

  const nameCell = document.createElement('th');
  nameCell.scope = 'row';
  nameCell.textContent = entry.name;
  if (!entry.readable) {
    const badge = document.createElement('span');
    badge.className = 'badge err';
    badge.textContent = 'Nicht lesbar';
    nameCell.append(' ', badge);
  }

  const sizeCell = document.createElement('td');
  sizeCell.textContent = entry.size === null ? 'unbekannt' : formatBytes(entry.size);

  const actionCell = document.createElement('td');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn ghost';
  button.dataset.index = String(entry.index);
  button.textContent = isRemoved ? 'Wieder behalten' : 'Entfernen';
  button.setAttribute(
    'aria-label',
    `${entry.name}: ${isRemoved ? 'wieder behalten' : 'entfernen'}`,
  );
  button.disabled = busy;
  actionCell.append(button);

  tr.append(nameCell, sizeCell, actionCell);
  return tr;
}

function addedRow(file: File, index: number): HTMLLIElement {
  const li = document.createElement('li');
  const num = document.createElement('span');
  num.className = 'num';
  num.textContent = String(index + 1);
  const meta = document.createElement('div');
  meta.className = 'meta';
  const name = document.createElement('b');
  name.textContent = file.name;
  const info = document.createElement('span');
  info.textContent = formatBytes(file.size);
  meta.append(name, info);
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'btn icon';
  remove.dataset.added = String(index);
  remove.setAttribute('aria-label', `${file.name}: nicht anhängen`);
  remove.disabled = busy;
  remove.innerHTML = '<svg width="18" height="18" aria-hidden="true"><use href="#i-x" /></svg>';
  li.append(num, meta, remove);
  return li;
}

function render(): void {
  const ok = current?.state === 'ok' ? current : null;
  fileList.replaceChildren(...(current ? [fileRow(current)] : []));
  $('#anh-empty').hidden = current !== null;
  panel.hidden = ok === null;

  if (ok) {
    const { attachments } = ok;
    const warn = $('#anh-warn');
    const unreadable = attachments.filter((a) => !a.readable).length;
    warn.hidden = unreadable === 0;
    warn.textContent =
      unreadable === 0
        ? ''
        : `${count(unreadable, 'Anhang ist', 'Anhänge sind')} nicht lesbar. Wir können nicht prüfen, was darin steckt. Solche Anhänge bleiben unverändert und lassen sich nur entfernen.`;
    $('#anh-none').hidden = attachments.length > 0;
    $('#anh-table-wrap').hidden = attachments.length === 0;
    tableBody.replaceChildren(...attachments.map(attachmentRow));
  }

  addedList.replaceChildren(...added.map(addedRow));
  const clashes = conflicts();
  const conflict = $('#anh-conflict');
  conflict.hidden = clashes.length === 0;
  conflict.textContent = clashes.length
    ? `Diese Namen gibt es schon: ${clashes.join(', ')}. Benenne die Datei auf deinem Gerät um oder entferne den alten Anhang.`
    : '';

  const kept = ok ? ok.attachments.filter((a) => !removed.has(a.index)) : [];
  const keptSizes = kept.map((a) => a.size);
  $('#anh-count-now').textContent = String(ok ? kept.length + added.length : 0);
  $('#anh-count-removed').textContent = String(removed.size);
  $('#anh-count-added').textContent = String(added.length);
  $('#anh-size').textContent = formatBytes(
    sumAttachmentSizes([...keptSizes, ...added.map((f) => f.size)]),
  );
  const unknown = keptSizes.filter((s) => s === null).length;
  const sizeNote = $('#anh-size-note');
  sizeNote.hidden = unknown === 0;
  sizeNote.textContent =
    unknown === 0
      ? ''
      : `Bei ${count(unknown, 'Anhang', 'Anhängen')} gibt die PDF keine Größe an. Die Summe enthält sie nicht.`;

  saveButton.disabled = busy || ok === null || clashes.length > 0;
  clearButton.disabled = busy || current === null;
  addInput.disabled = busy || ok === null;
}

async function inspect(file: File): Promise<void> {
  current = { state: 'checking', file };
  removed = new Set();
  added = [];
  render();
  try {
    const attachments = await client.request<AttachmentInfo[]>({ type: 'list', file });
    if (current?.file !== file) return;
    current = { state: 'ok', file, attachments };
  } catch (error) {
    if (current?.file !== file) return;
    current = { state: 'error', file, error: messageFor(error) };
  }
  render();
}

export function openFiles(files: File[]): void {
  const [file] = files.filter(isPdf);
  if (!file) {
    showToast('Nur PDF-Dateien werden übernommen.');
    return;
  }
  if (files.length > 1) showToast('Es wird eine PDF auf einmal bearbeitet: die erste.');
  void inspect(file);
}

async function save(): Promise<void> {
  if (current?.state !== 'ok' || conflicts().length > 0) return;
  const { file } = current;
  busy = true;
  saveLabel.textContent = 'Wird gespeichert …';
  render();
  try {
    const bytes = await client.request<Uint8Array>({
      type: 'save',
      file,
      remove: [...removed],
      add: added,
    });
    const base = file.name.replace(/\.pdf$/i, '').trim() || 'dokument';
    saveBlob(
      `${base}-anhaenge.pdf`,
      new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }),
    );
    countLocalBytes(file.size);
    showToast('Fertig: Die neue PDF ist gespeichert. Deine Originaldatei bleibt unverändert.');
  } catch (error) {
    showToast(messageFor(error));
  } finally {
    busy = false;
    saveLabel.textContent = idleLabel;
    render();
  }
}

tableBody.addEventListener('click', (event) => {
  const target = event.target as HTMLElement;
  const button = target.closest<HTMLButtonElement>('button[data-index]');
  if (!button || current?.state !== 'ok') return;
  const index = Number(button.dataset.index);
  if (removed.has(index)) removed.delete(index);
  else removed.add(index);
  render();
  // Fokus auf dem Knopf halten, nachdem die Zeile neu gezeichnet wurde
  tableBody.querySelector<HTMLButtonElement>(`button[data-index="${index}"]`)?.focus();
});

addedList.addEventListener('click', (event) => {
  const target = event.target as HTMLElement;
  const button = target.closest<HTMLButtonElement>('button[data-added]');
  if (!button) return;
  added = added.filter((_, i) => i !== Number(button.dataset.added));
  render();
});

addInput.addEventListener('change', () => {
  const picked = [...(addInput.files ?? [])];
  addInput.value = '';
  if (picked.length === 0 || current?.state !== 'ok') return;
  added = [...added, ...picked];
  render();
});

saveButton.addEventListener('click', () => {
  void save();
});
clearButton.addEventListener('click', () => {
  current = null;
  removed = new Set();
  added = [];
  render();
  $<HTMLInputElement>('#anh-input').focus();
});

preventAccidentalFileOpen();
wireDropzone($('#anh-drop'), $<HTMLInputElement>('#anh-input'), openFiles);
render();
