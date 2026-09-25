/**
 * Werkzeugseite „Duplikate finden“ (plan-phase2.md, Werkzeug 23). Lesen, Suchen und Schreiben
 * laufen im Worker. Gelöscht wird nie etwas; die gespeicherte Datei bekommt eine Markierung.
 */

import { isSpreadsheet } from '../../core/files/classify.ts';
import { $ } from '../../ui/dom.ts';
import { saveBlob } from '../../ui/download.ts';
import { preventAccidentalFileOpen, wireDropzone } from '../../ui/dropzone.ts';
import { countLocalBytes } from '../../ui/local-counter.ts';
import { showToast } from '../../ui/toast.ts';
import { createWorkerClient } from '../../ui/worker-protocol.ts';
import type { DupExport, DupFound, DupRead, DupRequest } from './dup-types.ts';

const worker = new Worker(new URL('./dup.worker.ts', import.meta.url), { type: 'module' });
const client = createWorkerClient<DupRequest>(worker);

const FAILED =
  'Die Liste konnte nicht verarbeitet werden. Lade die Seite neu und versuch es noch einmal.';
/** So viele Gruppen werden in der Tabelle gezeigt; die Zahl oben nennt immer alle */
const MAX_SHOWN = 300;

const columnsBox = $('#dup-columns');
const saveButton = $<HTMLButtonElement>('#dup-save');
const saveLabel = $('#dup-save-label');
const clearButton = $<HTMLButtonElement>('#dup-clear');
const idleLabel = saveLabel.textContent ?? '';

let loaded: { file: File; read: Extract<DupRead, { ok: true }> } | null = null;
let found: DupFound | null = null;
let busy = false;

function readError(result: Extract<DupRead, { ok: false }>): string {
  switch (result.code) {
    case 'empty':
      return 'Die Datei ist leer.';
    case 'no-data':
      return 'Die Liste braucht eine Kopfzeile und mindestens eine weitere Zeile.';
    case 'unreadable':
      return 'Die Datei konnte nicht gelesen werden. Prüfe, ob sie noch am selben Ort liegt, und füge sie erneut hinzu.';
    case 'unterminated-quote':
      return `In Zeile ${result.line ?? '?'} fehlt ein schließendes Anführungszeichen. Prüfe die Datei im Tabellenprogramm.`;
    case 'encrypted':
      return 'Die Datei ist mit einem Passwort geschützt. Speichere sie ohne Passwort und versuch es noch einmal.';
    case 'damaged':
      return 'Die Datei ist beschädigt. Öffne sie in deinem Tabellenprogramm und speichere sie erneut.';
    case 'not-spreadsheet':
    case 'unsupported':
      return 'Nur Excel- (.xlsx, .xls), ODS- oder CSV-Dateien werden unterstützt.';
  }
}

function chosenColumns(): number[] {
  return [...columnsBox.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')]
    .filter((c) => c.checked)
    .map((c) => Number(c.value));
}

function headerName(index: number): string {
  const name = loaded?.read.headers[index]?.trim();
  return name || `Spalte ${index + 1}`;
}

function renderColumns(): void {
  const headers = loaded?.read.headers ?? [];
  columnsBox.replaceChildren(
    ...headers.map((_, i) => {
      const label = document.createElement('label');
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.value = String(i);
      box.checked = true;
      label.append(box, headerName(i));
      return label;
    }),
  );
}

function renderResult(): void {
  const r = loaded?.read;
  $('#dup-empty').hidden = loaded !== null;
  $('#dup-panel').hidden = !r;
  $('#dup-result-card').hidden = !found;
  $('#dup-rows').textContent = r ? String(r.rows) : '–';
  $('#dup-groups').textContent = found ? String(found.groups.length) : '–';
  $('#dup-affected').textContent = found ? String(found.affectedRows) : '–';
  saveButton.disabled = busy || !found || found.groups.length === 0;
  clearButton.disabled = busy || !loaded;
  if (!r || !found || !loaded) return;

  $('#dup-file').textContent = loaded.file.name;
  $('#dup-info').textContent =
    `${r.rows} Zeilen ohne Kopfzeile${r.sheet ? `, Tabellenblatt „${r.sheet}“` : ''}.`;
  const columns = chosenColumns();
  const chip = document.createElement('span');
  chip.className = found.groups.length > 0 ? 'chip' : 'badge ok';
  chip.textContent =
    columns.length === 0
      ? 'Wähle mindestens eine Spalte.'
      : found.groups.length === 0
        ? 'Keine Doppel gefunden.'
        : `${found.groups.length} ${found.groups.length === 1 ? 'Gruppe' : 'Gruppen'} mit zusammen ${found.affectedRows} Zeilen.`;
  $('#dup-summary').replaceChildren(chip);

  const head = document.createElement('tr');
  for (const title of ['Gruppe', 'Zeilen in der Datei', ...columns.map(headerName)]) {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = title;
    head.append(th);
  }
  $('#dup-table thead').replaceChildren(head);
  $('#dup-table tbody').replaceChildren(
    ...found.groups.slice(0, MAX_SHOWN).map((g, i) => {
      const tr = document.createElement('tr');
      for (const text of [String(i + 1), g.lines.join(', '), ...g.sample]) {
        const td = document.createElement('td');
        td.textContent = text;
        tr.append(td);
      }
      return tr;
    }),
  );
  $('#dup-table-wrap').hidden = found.groups.length === 0;
}

async function search(): Promise<void> {
  try {
    found = await client.request<DupFound>({ type: 'find', columns: chosenColumns() });
  } catch {
    found = null;
    showToast(FAILED);
  }
  renderResult();
}

async function open(file: File): Promise<void> {
  loaded = null;
  found = null;
  busy = true;
  renderResult();
  try {
    const read = await client.request<DupRead>({ type: 'read', file });
    if (!read.ok) {
      showToast(readError(read));
      return;
    }
    loaded = { file, read };
    renderColumns();
    countLocalBytes(file.size);
  } catch {
    showToast(FAILED);
  } finally {
    busy = false;
  }
  if (loaded) {
    await search();
    $('#dup-file').focus();
  } else {
    renderResult();
  }
}

export function openFiles(files: File[]): void {
  const [file] = files;
  if (!file) return;
  if (files.length > 1) showToast('Es wird eine Liste auf einmal geprüft: die erste.');
  if (!isSpreadsheet(file)) {
    showToast('Nur Excel- (.xlsx, .xls), ODS- oder CSV-Dateien werden unterstützt.');
    return;
  }
  void open(file);
}

async function save(): Promise<void> {
  if (!loaded) return;
  busy = true;
  saveLabel.textContent = 'Wird gespeichert …';
  renderResult();
  try {
    const result = await client.request<DupExport>({ type: 'export' });
    const base = loaded.file.name.replace(/\.[^./\\]+$/, '').trim() || 'liste';
    saveBlob(
      `${base}-doppelt-markiert.${result.extension}`,
      new Blob([result.bytes as Uint8Array<ArrayBuffer>], {
        type:
          result.extension === 'csv'
            ? 'text/csv'
            : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
    );
    showToast('Fertig: Die Liste mit der Spalte „Doppelt“ ist gespeichert.');
  } catch {
    showToast(FAILED);
  } finally {
    busy = false;
    saveLabel.textContent = idleLabel;
    renderResult();
  }
}

columnsBox.addEventListener('change', () => {
  void search();
});
saveButton.addEventListener('click', () => {
  void save();
});
clearButton.addEventListener('click', () => {
  loaded = null;
  found = null;
  renderResult();
  $<HTMLInputElement>('#dup-input').focus();
});

preventAccidentalFileOpen();
wireDropzone($('#dup-drop'), $<HTMLInputElement>('#dup-input'), openFiles);
renderResult();
