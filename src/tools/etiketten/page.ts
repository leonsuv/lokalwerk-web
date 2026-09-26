/**
 * Werkzeugseite „Etiketten aus einer Liste“ (plan-phase2.md Werkzeug 24). Bögen nur nach Maßen
 * (E10), Probedruck mit Rahmen und 100-mm-Linie. Lesen, Prüfen und PDF laufen im Worker.
 */

import { isCsv, isSpreadsheet } from '../../core/files/classify.ts';
import { formatBytes } from '../../core/format/bytes.ts';
import { MM_TO_PT } from '../../core/labels/fit.ts';
import {
  checkSheet,
  labelRect,
  labelsPerPage,
  PAGE,
  pageCount,
  presetSheet,
  PRESETS,
  type SheetSpec,
} from '../../core/labels/layout.ts';
import { emptyPlan, planIsEmpty, type LinePlan } from '../../core/labels/lines.ts';
import type { PrepareOptions } from '../../core/labels/prepare.ts';
import { $ } from '../../ui/dom.ts';
import { saveBlob } from '../../ui/download.ts';
import { preventAccidentalFileOpen, wireDropzone } from '../../ui/dropzone.ts';
import { countLocalBytes } from '../../ui/local-counter.ts';
import { showToast } from '../../ui/toast.ts';
import { createWorkerClient } from '../../ui/worker-protocol.ts';
import type { LabelPrepared, LabelRead, LabelRequest } from './label-types.ts';

const worker = new Worker(new URL('./labels.worker.ts', import.meta.url), { type: 'module' });
const client = createWorkerClient<LabelRequest>(worker);

const FAILED =
  'Die Etiketten konnten nicht erzeugt werden. Lade die Seite neu und versuch es noch einmal.';
const CUSTOM = 'eigene';
const PREVIEW_MAX = 420;

const presetSelect = $<HTMLSelectElement>('#lab-preset');
const SHEET_FIELDS: readonly [keyof SheetSpec, string][] = [
  ['columns', '#lab-columns'],
  ['rows', '#lab-rows'],
  ['labelWidth', '#lab-width'],
  ['labelHeight', '#lab-height'],
  ['marginTop', '#lab-top'],
  ['marginLeft', '#lab-left'],
  ['gapX', '#lab-gapx'],
  ['gapY', '#lab-gapy'],
];
const sizeInput = $<HTMLInputElement>('#lab-size');
const paddingInput = $<HTMLInputElement>('#lab-padding');
const startInput = $<HTMLInputElement>('#lab-start');
const preview = $<HTMLCanvasElement>('#lab-preview');
const testButton = $<HTMLButtonElement>('#lab-test');
const saveButton = $<HTMLButtonElement>('#lab-save');
const saveLabel = $('#lab-save-label');
const testLabel = $('#lab-test-label');
const idleSave = saveLabel.textContent ?? '';
const idleTest = testLabel.textContent ?? '';

type Current =
  | { state: 'reading'; file: File }
  | { state: 'ok'; file: File; read: Extract<LabelRead, { ok: true }> }
  | { state: 'error'; file: File; error: string };

let current: Current | null = null;
let plan: LinePlan = emptyPlan();
let prepared: LabelPrepared | null = null;
let busy = false;
let run = 0;
let timer = 0;

function readError(result: Extract<LabelRead, { ok: false }>): string {
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

/** Name einer Voreinstellung nach Maßen, z. B. „3 × 8, je 70 × 37 mm“ (Blatt ist immer A4) */
const mm = (v: number) => String(v).replace('.', ',');
const presetLabel = (p: (typeof PRESETS)[number]) =>
  `${p.columns} × ${p.rows}, je ${mm(p.labelWidth)} × ${mm(p.labelHeight)} mm`;

presetSelect.replaceChildren(
  ...PRESETS.map((p) => new Option(presetLabel(p), p.id)),
  new Option('Eigene Maße', CUSTOM),
);

function fillSheet(sheet: SheetSpec): void {
  for (const [key, id] of SHEET_FIELDS) $<HTMLInputElement>(id).value = String(sheet[key]);
}

function readSheet(): SheetSpec {
  const value = (id: string) => $<HTMLInputElement>(id).valueAsNumber;
  return {
    columns: value('#lab-columns'),
    rows: value('#lab-rows'),
    labelWidth: value('#lab-width'),
    labelHeight: value('#lab-height'),
    marginTop: value('#lab-top'),
    marginLeft: value('#lab-left'),
    gapX: value('#lab-gapx'),
    gapY: value('#lab-gapy'),
  };
}

const number = (input: HTMLInputElement, fallback: number) =>
  Number.isFinite(input.valueAsNumber) ? input.valueAsNumber : fallback;

function options(): PrepareOptions {
  return {
    plan,
    sheet: readSheet(),
    padding: Math.min(20, Math.max(0, number(paddingInput, 4))),
    fontSize: Math.min(24, Math.max(6, number(sizeInput, 10))),
  };
}

function start(sheet: SheetSpec): number {
  const value = Math.round(number(startInput, 1));
  return Math.min(Math.max(1, value), labelsPerPage(sheet));
}

function sheetMessage(sheet: SheetSpec): string {
  switch (checkSheet(sheet)) {
    case 'invalid':
      return 'Prüf die Maße: Spalten und Reihen als ganze Zahl ab 1, Breite und Höhe ab 5 mm, Ränder und Abstände nicht negativ.';
    case 'too-wide':
      return `Der Bogen ist breiter als ein A4-Blatt (${PAGE.width} mm). Prüf Rand links, Breite, Spalten und Abstand nebeneinander.`;
    case 'too-tall':
      return `Der Bogen ist höher als ein A4-Blatt (${PAGE.height} mm). Prüf Rand oben, Höhe, Reihen und Abstand untereinander.`;
    case null:
      return 'Die Maße stehen meist auf der Packung. Im Zweifel miss auf dem Bogen nach.';
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
  if (entry.state === 'reading') info.textContent = `${size}, wird gelesen …`;
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

/** Auswahl der Spalten je Etikettenzeile */
function renderLineMap(headers: readonly string[]): void {
  const box = $('#lab-lines');
  box.replaceChildren(
    ...plan.map((columns, line) => {
      const set = document.createElement('fieldset');
      set.className = 'line-map';
      const legend = document.createElement('legend');
      legend.className = 'lbl';
      legend.textContent = `Zeile ${line + 1}`;
      set.append(legend);
      columns.forEach((column, slot) => {
        const select = document.createElement('select');
        select.dataset.line = String(line);
        select.dataset.slot = String(slot);
        select.setAttribute('aria-label', `Zeile ${line + 1}, Angabe ${slot + 1}`);
        select.append(
          new Option('–', '-1', false, column < 0),
          ...headers.map(
            (h, i) => new Option(h.trim() || `Spalte ${i + 1}`, String(i), false, i === column),
          ),
        );
        set.append(select);
      });
      return set;
    }),
  );
}

function drawPreview(sheet: SheetSpec, first: number): void {
  const ratio = globalThis.devicePixelRatio || 1;
  const cssWidth = Math.min(PREVIEW_MAX, preview.parentElement?.clientWidth ?? PREVIEW_MAX);
  const scale = (cssWidth * ratio) / PAGE.width;
  preview.width = Math.round(PAGE.width * scale);
  preview.height = Math.round(PAGE.height * scale);
  preview.style.width = `${cssWidth}px`;
  const ctx = preview.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, preview.width, preview.height);
  if (checkSheet(sheet)) return;
  ctx.strokeStyle = '#b0b4c0';
  ctx.lineWidth = Math.max(1, ratio);
  for (let slot = 0; slot < labelsPerPage(sheet); slot++) {
    const r = labelRect(sheet, slot);
    ctx.strokeRect(r.x * scale, r.y * scale, r.width * scale, r.height * scale);
  }
  const { padding } = options();
  ctx.fillStyle = '#000';
  ctx.textBaseline = 'alphabetic';
  (prepared?.preview ?? []).slice(0, labelsPerPage(sheet) - first).forEach((label, i) => {
    const r = labelRect(sheet, first + i);
    // Punkt in Millimeter: gleiche Lage wie in der PDF (core/pdf/labels.ts)
    const size = label.size / MM_TO_PT;
    const block = (label.lines.length - 1) * size * 1.2 + size;
    const top = r.y + padding + (r.height - 2 * padding - block) / 2 + size * 0.8;
    ctx.font = `${size * scale}px Helvetica, Arial, sans-serif`;
    label.lines.forEach((text, n) => {
      ctx.fillText(text, (r.x + padding) * scale, (top + n * size * 1.2) * scale);
    });
  });
}

function problemText(p: LabelPrepared['problems'][number]): string {
  return p.reason === 'charset'
    ? `Zeichen, die die Schrift nicht kennt: ${p.chars.join(' ')}`
    : 'Zu viel Text, passt auch mit 6 pt nicht aufs Etikett.';
}

function render(): void {
  $('#lab-file').replaceChildren(...(current ? [fileRow(current)] : []));
  const ok = current?.state === 'ok';
  $('#lab-empty').hidden = current !== null;
  $('#lab-panel').hidden = !ok;
  const sheet = readSheet();
  const sheetOk = checkSheet(sheet) === null;
  const hint = $('#lab-sheet-hint');
  hint.textContent = sheetMessage(sheet);
  hint.classList.toggle('err', !sheetOk);
  startInput.max = sheetOk ? String(labelsPerPage(sheet)) : '';
  const p = ok ? prepared : null;
  const first = sheetOk ? start(sheet) - 1 : 0;
  $('#lab-count').textContent = p ? String(p.count) : '–';
  $('#lab-pages').textContent = p && sheetOk ? String(pageCount(sheet, p.count, first + 1)) : '–';
  $('#lab-skipped').textContent = p ? String(p.empty) : '–';
  $('#lab-bad').textContent = p ? String(p.problems.length) : '–';
  $('#lab-shrunk').textContent = p ? String(p.shrunk) : '–';
  const ready = !busy && ok && sheetOk && (p?.count ?? 0) > 0;
  saveButton.disabled = !ready;
  testButton.disabled = !ready;
  $<HTMLButtonElement>('#lab-clear').disabled = busy || current === null;
  if (ok) drawPreview(sheet, first);

  const problems = p?.problems ?? [];
  $('#lab-problems').hidden = problems.length === 0;
  $('#lab-problems-hint').textContent =
    'Diese Zeilen der Liste kommen nicht auf die Etiketten. Kürze den Text oder ersetze die Zeichen im Tabellenprogramm und füge die Liste erneut hinzu.';
  $('#lab-problems-table tbody').replaceChildren(
    ...problems.slice(0, 200).map((problem) => {
      const tr = document.createElement('tr');
      tr.className = 'bad';
      const line = document.createElement('td');
      line.className = 'num';
      line.textContent = String(problem.line);
      const reason = document.createElement('td');
      reason.textContent = problemText(problem);
      tr.append(line, reason);
      return tr;
    }),
  );
}

async function update(): Promise<void> {
  if (current?.state !== 'ok' || checkSheet(readSheet())) {
    render();
    return;
  }
  if (planIsEmpty(plan)) {
    prepared = { count: 0, empty: 0, shrunk: 0, problems: [], preview: [] };
    render();
    return;
  }
  const mine = ++run;
  try {
    const result = await client.request<LabelPrepared>({ type: 'prepare', options: options() });
    if (mine === run) prepared = result;
  } catch {
    if (mine === run) showToast(FAILED);
  }
  render();
}

function schedule(): void {
  clearTimeout(timer);
  render();
  timer = window.setTimeout(() => void update(), 150);
}

async function open(file: File): Promise<void> {
  current = { state: 'reading', file };
  prepared = null;
  render();
  try {
    const read = await client.request<LabelRead>({ type: 'read', file });
    if (read.ok) {
      current = { state: 'ok', file, read };
      plan = read.plan;
      renderLineMap(read.headers);
      countLocalBytes(file.size);
    } else {
      current = { state: 'error', file, error: readError(read) };
    }
  } catch {
    current = { state: 'error', file, error: FAILED };
  }
  if (current.state === 'ok') await update();
  else render();
}

export function openFiles(files: File[]): void {
  const [file] = files;
  if (!file) return;
  if (files.length > 1) showToast('Es wird eine Liste auf einmal verarbeitet: die erste.');
  if (!isSpreadsheet(file) && !isCsv(file)) {
    showToast('Nur Excel- (.xlsx, .xls), ODS- oder CSV-Dateien werden unterstützt.');
    return;
  }
  void open(file);
}

async function save(test: boolean): Promise<void> {
  if (current?.state !== 'ok') return;
  const sheet = readSheet();
  const label = test ? testLabel : saveLabel;
  busy = true;
  label.textContent = 'Wird erstellt …';
  render();
  try {
    const bytes = await client.request<Uint8Array>({
      type: 'build',
      options: options(),
      start: start(sheet),
      test,
    });
    const base = current.file.name.replace(/\.[^./\\]+$/, '').trim() || 'liste';
    saveBlob(
      `${base}-${test ? 'probedruck' : 'etiketten'}.pdf`,
      new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }),
    );
    showToast(
      test
        ? 'Fertig: Der Probedruck ist gespeichert. Druck ihn auf normales Papier und halte ihn gegen den Bogen.'
        : 'Fertig: Die Etiketten-PDF ist gespeichert.',
    );
  } catch {
    showToast(FAILED);
  } finally {
    busy = false;
    saveLabel.textContent = idleSave;
    testLabel.textContent = idleTest;
    render();
  }
}

$('#lab-lines').addEventListener('change', (e) => {
  const select = e.target as HTMLSelectElement;
  const line = plan[Number(select.dataset.line)];
  if (!line) return;
  line[Number(select.dataset.slot)] = Number(select.value);
  schedule();
});
presetSelect.addEventListener('change', () => {
  const preset = PRESETS.find((p) => p.id === presetSelect.value);
  if (preset) fillSheet(presetSheet(preset));
  schedule();
});
for (const [, id] of SHEET_FIELDS) {
  $(id).addEventListener('input', () => {
    presetSelect.value = CUSTOM;
    schedule();
  });
}
for (const input of [sizeInput, paddingInput, startInput])
  input.addEventListener('input', schedule);
testButton.addEventListener('click', () => void save(true));
saveButton.addEventListener('click', () => void save(false));
$('#lab-clear').addEventListener('click', () => {
  current = null;
  prepared = null;
  plan = emptyPlan();
  render();
  $<HTMLInputElement>('#lab-input').focus();
});

const firstPreset = PRESETS[0];
if (firstPreset) fillSheet(presetSheet(firstPreset));
preventAccidentalFileOpen();
wireDropzone($('#lab-drop'), $<HTMLInputElement>('#lab-input'), openFiles);
render();
