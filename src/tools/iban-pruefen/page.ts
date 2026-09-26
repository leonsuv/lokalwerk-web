/**
 * Werkzeugseite „IBAN-Liste prüfen“ (plan-phase2.md Werkzeug 16, E9: vorerst ohne Bankdaten)
 * mit Reiter „SEPA-Texte prüfen“ (Vorschlag D). Die Liste liest und prüft der Worker.
 */

import { isCsv, isSpreadsheet } from '../../core/files/classify.ts';
import { formatBytes } from '../../core/format/bytes.ts';
import {
  NAME_MAX_LENGTH,
  PURPOSE_MAX_LENGTH,
  REFERENCE_MAX_LENGTH,
  sanitizeSepaText,
} from '../../core/sepa/charset.ts';
import { checkIbanValue } from '../../core/sepa/iban-list.ts';
import { $, $$ } from '../../ui/dom.ts';
import { saveBlob } from '../../ui/download.ts';
import { preventAccidentalFileOpen, wireDropzone } from '../../ui/dropzone.ts';
import { countLocalBytes } from '../../ui/local-counter.ts';
import { showToast } from '../../ui/toast.ts';
import { createWorkerClient } from '../../ui/worker-protocol.ts';
import { replacementsText } from '../sepa-sammelueberweisung/messages.ts';
import type { IbanChecked, IbanExport, IbanRead, IbanRequest } from './iban-types.ts';
import { ibanCheckMessage } from './messages.ts';

const worker = new Worker(new URL('./iban.worker.ts', import.meta.url), { type: 'module' });
const client = createWorkerClient<IbanRequest>(worker);

const FAILED =
  'Die Liste konnte nicht verarbeitet werden. Lade die Seite neu und versuch es noch einmal.';
/** So viele Zeilen zeigt die Tabelle; die Zahlen rechts nennen immer alle */
const MAX_SHOWN = 500;

const tabs = $$<HTMLButtonElement>('[role="tab"]');
const fileList = $<HTMLUListElement>('#iban-file');
const columnSelect = $<HTMLSelectElement>('#iban-column');
const filterButtons = $$<HTMLButtonElement>('button[data-filter]');
const saveButton = $<HTMLButtonElement>('#iban-save');
const saveLabel = $('#iban-save-label');
const idleLabel = saveLabel.textContent ?? '';

type Current =
  | { state: 'checking'; file: File }
  | { state: 'ok'; file: File; read: Extract<IbanRead, { ok: true }> }
  | { state: 'error'; file: File; error: string };

let current: Current | null = null;
let checked: IbanChecked | null = null;
let onlyProblems = true;
let busy = false;

function readError(result: Extract<IbanRead, { ok: false }>): string {
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
  if (entry.state === 'checking') info.textContent = `${size}, wird gelesen …`;
  if (entry.state === 'ok') {
    const { rows, sheet } = entry.read;
    info.textContent = `${rows} Zeilen ohne Kopfzeile${sheet ? `, Tabellenblatt „${sheet}“` : ''}, ${size}`;
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

function cell(text: string, className = ''): HTMLTableCellElement {
  const td = document.createElement('td');
  td.textContent = text;
  if (className) td.className = className;
  return td;
}

function render(): void {
  fileList.replaceChildren(...(current ? [fileRow(current)] : []));
  const ok = current?.state === 'ok' ? current : null;
  $('#iban-panel').hidden = !ok;
  for (const b of filterButtons) {
    b.setAttribute('aria-pressed', String((b.dataset.filter === 'problems') === onlyProblems));
  }
  const c = checked;
  $('#iban-rows').textContent = ok ? String(ok.read.rows) : '–';
  $('#iban-ok').textContent = c ? String(c.ok) : '–';
  $('#iban-errors').textContent = c ? String(c.errors) : '–';
  $('#iban-noneea').textContent = c ? String(c.nonEea) : '–';
  $('#iban-empty').textContent = c ? String(c.empty) : '–';
  $('#iban-repeated').textContent = c ? String(c.repeated) : '–';
  saveButton.disabled = busy || !c;
  $<HTMLButtonElement>('#iban-clear').disabled = busy || current === null;

  const rows = (c?.rows ?? []).filter((r) => !onlyProblems || !r.ok || r.message !== 'gültig');
  const shown = rows.slice(0, MAX_SHOWN);
  $('#iban-shown').textContent = !c
    ? ''
    : rows.length === 0
      ? 'Keine Auffälligkeiten: Alle IBANs sind gültig.'
      : rows.length > shown.length
        ? `Die ersten ${shown.length} von ${rows.length} Zeilen.`
        : '';
  $('#iban-table-wrap').hidden = shown.length === 0;
  $('#iban-table tbody').replaceChildren(
    ...shown.map((r) => {
      const tr = document.createElement('tr');
      if (r.bad) tr.className = 'bad';
      tr.append(cell(String(r.line), 'num'), cell(r.shown, 'iban'), cell(r.message));
      return tr;
    }),
  );
}

async function runCheck(): Promise<void> {
  const column = Number(columnSelect.value);
  try {
    checked = await client.request<IbanChecked>({ type: 'check', column });
  } catch {
    checked = null;
    showToast(FAILED);
  }
  render();
}

async function open(file: File): Promise<void> {
  current = { state: 'checking', file };
  checked = null;
  busy = true;
  render();
  try {
    const read = await client.request<IbanRead>({ type: 'read', file });
    if (read.ok) {
      current = { state: 'ok', file, read };
      columnSelect.replaceChildren(
        ...read.headers.map(
          (h, i) => new Option(h.trim() || `Spalte ${i + 1}`, String(i), false, i === read.guess),
        ),
      );
      if (read.guess < 0) columnSelect.value = '0';
      countLocalBytes(file.size);
    } else {
      current = { state: 'error', file, error: readError(read) };
    }
  } catch {
    current = { state: 'error', file, error: FAILED };
  } finally {
    busy = false;
  }
  if (current.state === 'ok') await runCheck();
  else render();
}

export function openFiles(files: File[]): void {
  const [file] = files;
  if (!file) return;
  if (files.length > 1) showToast('Es wird eine Liste auf einmal geprüft: die erste.');
  if (!isSpreadsheet(file) && !isCsv(file)) {
    showToast('Nur Excel- (.xlsx, .xls), ODS- oder CSV-Dateien werden unterstützt.');
    return;
  }
  void open(file);
}

async function save(): Promise<void> {
  if (current?.state !== 'ok') return;
  const { file } = current;
  busy = true;
  saveLabel.textContent = 'Wird gespeichert …';
  render();
  try {
    const result = await client.request<IbanExport>({
      type: 'export',
      column: Number(columnSelect.value),
    });
    const base = file.name.replace(/\.[^./\\]+$/, '').trim() || 'liste';
    saveBlob(
      `${base}-iban-geprueft.${result.extension}`,
      new Blob([result.bytes as Uint8Array<ArrayBuffer>], {
        type:
          result.extension === 'csv'
            ? 'text/csv'
            : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
    );
    showToast('Fertig: Die Liste mit der Spalte „IBAN-Prüfung“ ist gespeichert.');
  } catch {
    showToast(FAILED);
  } finally {
    busy = false;
    saveLabel.textContent = idleLabel;
    render();
  }
}

/** Reiter „SEPA-Texte prüfen“ */
function renderText(): void {
  const field = $<HTMLSelectElement>('#sepa-field').value;
  const max =
    field === 'name'
      ? NAME_MAX_LENGTH
      : field === 'reference'
        ? REFERENCE_MAX_LENGTH
        : PURPOSE_MAX_LENGTH;
  const input = $<HTMLTextAreaElement>('#sepa-input').value;
  const result = sanitizeSepaText(input, max);
  $('#sepa-out').textContent = result.text;
  $('#sepa-length').textContent = input.trim() === '' ? '–' : String(result.lengthBeforeTruncation);
  $('#sepa-max').textContent = String(max);
  $('#sepa-changed').textContent = input.trim() === '' ? '–' : String(result.replacements.length);
  const notes = [];
  if (result.replacements.length > 0)
    notes.push(`Umgeschrieben: ${replacementsText(result.replacements)}.`);
  if (result.truncated) {
    notes.push(
      `Zu lang: ${result.lengthBeforeTruncation} Zeichen, erlaubt sind ${max}. Die Bank bekäme nur den gekürzten Text.`,
    );
  }
  if (input.trim() !== '' && notes.length === 0)
    notes.push('Alles in Ordnung: Der Text bleibt, wie er ist.');
  $('#sepa-note').textContent = notes.join(' ');
}

function selectTab(tab: HTMLButtonElement, focus: boolean): void {
  for (const t of tabs) {
    const selected = t === tab;
    t.setAttribute('aria-selected', String(selected));
    t.tabIndex = selected ? 0 : -1;
    const panel = document.getElementById(t.getAttribute('aria-controls') ?? '');
    if (panel) panel.hidden = !selected;
  }
  if (focus) tab.focus();
}

for (const tab of tabs) {
  tab.addEventListener('click', () => selectTab(tab, false));
  tab.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const i = tabs.indexOf(tab);
    const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    if (next) selectTab(next, true);
  });
}
$<HTMLInputElement>('#iban-single').addEventListener('input', (e) => {
  const input = (e.target as HTMLInputElement).value;
  const msg = $('#iban-single-msg');
  if (input.trim() === '') {
    msg.textContent = '';
    msg.classList.remove('err');
    return;
  }
  const check = checkIbanValue(input);
  const text = ibanCheckMessage(check);
  msg.textContent =
    check.status === 'ok' ? `${check.formatted}: gültig` : /[.!?]$/.test(text) ? text : `${text}.`;
  msg.classList.toggle('err', check.status !== 'ok');
});
columnSelect.addEventListener('change', () => void runCheck());
for (const b of filterButtons) {
  b.addEventListener('click', () => {
    onlyProblems = b.dataset.filter === 'problems';
    render();
  });
}
saveButton.addEventListener('click', () => void save());
$('#iban-clear').addEventListener('click', () => {
  current = null;
  checked = null;
  render();
  $<HTMLInputElement>('#iban-input').focus();
});
$('#sepa-field').addEventListener('change', renderText);
$('#sepa-input').addEventListener('input', renderText);

preventAccidentalFileOpen();
wireDropzone($('#iban-drop'), $<HTMLInputElement>('#iban-input'), openFiles);
render();
renderText();
