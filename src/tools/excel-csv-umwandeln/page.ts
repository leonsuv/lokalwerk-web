/**
 * Werkzeugseite „Excel und CSV umwandeln“ (plan-phase2.md, Werkzeug 22). Lesen und Schreiben
 * laufen im Worker; diese Datei zeigt Vorschau, Einstellungen und Meldungen.
 */

import type { TextEncoding } from '../../core/csv/decode.ts';
import type { OutputEncoding } from '../../core/csv/encode.ts';
import type { Delimiter } from '../../core/csv/parse.ts';
import { isSpreadsheet } from '../../core/files/classify.ts';
import { formatValue, type DecimalMark, type SheetValue } from '../../core/sheet/values.ts';
import { $, $$ } from '../../ui/dom.ts';
import { saveBlob } from '../../ui/download.ts';
import { preventAccidentalFileOpen, wireDropzone } from '../../ui/dropzone.ts';
import { countLocalBytes } from '../../ui/local-counter.ts';
import { showToast } from '../../ui/toast.ts';
import { createWorkerClient } from '../../ui/worker-protocol.ts';
import {
  PREVIEW_ROWS,
  type ConvertRequest,
  type CsvOutcome,
  type ReadOutcome,
  type SheetSummary,
  type XlsxOutcome,
} from './convert-types.ts';

// Worker sofort starten: lädt SheetJS, danach geht alles offline (plan.md N4).
const worker = new Worker(new URL('./convert.worker.ts', import.meta.url), { type: 'module' });
const client = createWorkerClient<ConvertRequest>(worker);

const ENCODING_NAMES: Record<TextEncoding, string> = {
  'utf-8': 'UTF-8',
  'utf-16le': 'UTF-16',
  'utf-16be': 'UTF-16',
  'windows-1252': 'Windows-1252',
};
const DELIMITER_NAMES: Record<Delimiter, string> = {
  ';': 'Semikolon',
  ',': 'Komma',
  '\t': 'Tabulator',
};

function readError(outcome: Extract<ReadOutcome, { ok: false }>): string {
  switch (outcome.code) {
    case 'empty':
      return 'Die Datei ist leer.';
    case 'encrypted':
      return 'Die Datei ist mit einem Passwort geschützt. Speichere sie ohne Passwort und versuch es noch einmal.';
    case 'damaged':
      return 'Die Datei ist beschädigt. Öffne sie in deinem Tabellenprogramm und speichere sie erneut.';
    case 'not-spreadsheet':
      return 'Die Datei ist keine Excel- oder ODS-Tabelle. Speichere sie als .xlsx, .ods oder .csv.';
    case 'unterminated-quote':
      return `In Zeile ${outcome.line ?? '?'} fehlt ein schließendes Anführungszeichen. Prüfe die Datei im Tabellenprogramm.`;
    case 'unreadable':
      return 'Die Datei konnte nicht gelesen werden. Prüfe, ob sie noch am selben Ort liegt, und füge sie erneut hinzu.';
    case 'unsupported':
      return 'Nur Excel- (.xlsx, .xls), ODS- oder CSV-Dateien werden unterstützt.';
  }
}
const FAILED =
  'Die Datei konnte nicht umgewandelt werden. Lade die Seite neu und versuch es noch einmal.';

const panel = $('#conv-panel');
const table = $<HTMLTableElement>('#conv-table');
const sheetField = $('#conv-sheet-field');
const sheetSelect = $<HTMLSelectElement>('#conv-sheet');
const delimiterSelect = $<HTMLSelectElement>('#conv-delimiter');
const decimalSelect = $<HTMLSelectElement>('#conv-decimal');
const encodingSelect = $<HTMLSelectElement>('#conv-encoding');
const inDecimalSelect = $<HTMLSelectElement>('#conv-in-decimal');
const detectButtons = $$<HTMLButtonElement>('button[data-detect]');
const saveButton = $<HTMLButtonElement>('#conv-save');
const saveLabel = $('#conv-save-label');
const clearButton = $<HTMLButtonElement>('#conv-clear');

type Loaded =
  | { kind: 'workbook'; file: File; sheets: SheetSummary[] }
  | { kind: 'csv'; file: File; sheet: SheetSummary };
let loaded: Loaded | null = null;
let busy = false;
let detect = true;

const baseName = (name: string) => name.replace(/\.[^./\\]+$/, '').trim() || 'tabelle';
const safePart = (text: string) => text.replace(/[\\/:*?"<>|]+/g, '_').trim();

function currentSheet(): SheetSummary | undefined {
  if (!loaded) return undefined;
  return loaded.kind === 'csv' ? loaded.sheet : loaded.sheets[Number(sheetSelect.value)];
}

function csvDelimiter(): Delimiter {
  const value = delimiterSelect.value;
  return value === 'tab' ? '\t' : value === ',' ? ',' : ';';
}

function csvDecimal(): DecimalMark {
  return csvDelimiter() === ',' || decimalSelect.value === '.' ? '.' : ',';
}

function renderPreview(): void {
  const sheet = currentSheet();
  const caption = table.caption;
  table.replaceChildren();
  if (caption) table.append(caption);
  if (!sheet) return;
  const decimal: DecimalMark = loaded?.kind === 'workbook' ? csvDecimal() : ',';
  const body = document.createElement('tbody');
  for (const row of sheet.preview) {
    const tr = document.createElement('tr');
    for (let c = 0; c < sheet.columns; c++) {
      const td = document.createElement('td');
      const value: SheetValue = row[c] ?? null;
      td.textContent = formatValue(value, decimal);
      if (typeof value === 'number') td.className = 'num';
      tr.append(td);
    }
    body.append(tr);
  }
  table.append(body);
  const shown = Math.min(PREVIEW_ROWS, sheet.rows);
  $('#conv-table-note').textContent =
    sheet.rows > shown
      ? `Vorschau: die ersten ${shown} von ${sheet.rows} Zeilen.`
      : `${sheet.rows} ${sheet.rows === 1 ? 'Zeile' : 'Zeilen'}.`;
}

function render(): void {
  const isWorkbook = loaded?.kind === 'workbook';
  const isCsv = loaded?.kind === 'csv';
  $('#conv-empty').hidden = loaded !== null;
  panel.hidden = loaded === null;
  $('#conv-csv-options').hidden = !isWorkbook;
  $('#conv-xlsx-options').hidden = !isCsv;
  sheetField.hidden = !(loaded?.kind === 'workbook' && loaded.sheets.length > 1);
  $('#conv-result-title').textContent = isWorkbook
    ? 'Ergebnis: CSV-Datei'
    : isCsv
      ? 'Ergebnis: Excel-Datei'
      : 'Ergebnis';
  const commaDelimiter = csvDelimiter() === ',';
  decimalSelect.disabled = commaDelimiter;
  $('#conv-decimal-hint').hidden = !commaDelimiter;
  if (!busy) {
    saveLabel.textContent = isWorkbook
      ? 'CSV-Datei speichern'
      : isCsv
        ? 'Excel-Datei speichern'
        : 'Datei umwandeln';
  }
  saveButton.disabled = busy || loaded === null;
  clearButton.disabled = busy || loaded === null;
  for (const b of detectButtons) {
    b.setAttribute('aria-pressed', String((b.dataset.detect === 'yes') === detect));
  }
  renderPreview();
}

export async function openFiles(files: File[]): Promise<void> {
  const [file] = files;
  if (!file) return;
  if (files.length > 1) showToast('Es wird eine Tabelle auf einmal umgewandelt: die erste.');
  if (!isSpreadsheet(file)) {
    showToast('Nur Excel- (.xlsx, .xls), ODS- oder CSV-Dateien werden unterstützt.');
    return;
  }
  loaded = null;
  busy = true;
  saveLabel.textContent = 'Wird gelesen …';
  render();
  try {
    const outcome = await client.request<ReadOutcome>({ type: 'read', file });
    if (!outcome.ok) {
      showToast(readError(outcome));
      return;
    }
    if (outcome.kind === 'workbook') {
      loaded = { kind: 'workbook', file, sheets: outcome.sheets };
      sheetSelect.replaceChildren(
        ...outcome.sheets.map((s, i) => {
          const option = document.createElement('option');
          option.value = String(i);
          option.textContent = `${s.name} (${s.rows} ${s.rows === 1 ? 'Zeile' : 'Zeilen'})`;
          return option;
        }),
      );
      const first = outcome.sheets.findIndex((s) => s.rows > 0);
      sheetSelect.value = String(Math.max(0, first));
    } else {
      loaded = { kind: 'csv', file, sheet: outcome.sheet };
      $('#conv-in-encoding').textContent = ENCODING_NAMES[outcome.encoding];
      $('#conv-in-delimiter').textContent = DELIMITER_NAMES[outcome.delimiter];
      inDecimalSelect.value = outcome.delimiter === ',' ? '.' : ',';
    }
    $('#conv-file').textContent = file.name;
  } catch {
    showToast(FAILED);
  } finally {
    busy = false;
    render();
  }
  if (loaded) $('#conv-file').focus();
}

async function save(): Promise<void> {
  if (!loaded) return;
  const current = loaded;
  busy = true;
  saveLabel.textContent = 'Wird umgewandelt …';
  render();
  try {
    if (current.kind === 'workbook') {
      const index = Number(sheetSelect.value);
      const outcome = await client.request<CsvOutcome>({
        type: 'to-csv',
        sheet: index,
        delimiter: csvDelimiter(),
        decimal: csvDecimal(),
        encoding: encodingSelect.value as OutputEncoding,
      });
      if (!outcome.ok) {
        const chars = outcome.chars.map((c) => `„${c}“`).join(', ');
        showToast(
          `Diese Zeichen gibt es in Windows-1252 nicht: ${chars} (zuerst in Zeile ${outcome.line}). Wähle UTF-8 als Zeichenkodierung.`,
        );
        return;
      }
      const sheetName = current.sheets[index]?.name ?? '';
      const suffix = current.sheets.length > 1 ? `-${safePart(sheetName)}` : '';
      saveBlob(
        `${baseName(current.file.name)}${suffix}.csv`,
        new Blob([outcome.bytes as Uint8Array<ArrayBuffer>], { type: 'text/csv' }),
      );
      countLocalBytes(current.file.size);
      showToast(`Fertig: ${outcome.rows} ${outcome.rows === 1 ? 'Zeile' : 'Zeilen'} als CSV.`);
    } else {
      const outcome = await client.request<XlsxOutcome>({
        type: 'to-xlsx',
        detect,
        decimal: inDecimalSelect.value === '.' ? '.' : ',',
      });
      saveBlob(
        `${baseName(current.file.name)}.xlsx`,
        new Blob([outcome.bytes as Uint8Array<ArrayBuffer>], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }),
      );
      countLocalBytes(current.file.size);
      const { numbers, dates } = outcome;
      const recognized = detect
        ? ` ${numbers} ${numbers === 1 ? 'Zahl' : 'Zahlen'} und ${dates} ${dates === 1 ? 'Datumswert' : 'Datumswerte'} erkannt.`
        : '';
      showToast(
        `Fertig: ${outcome.rows} ${outcome.rows === 1 ? 'Zeile' : 'Zeilen'} als Excel-Datei.${recognized}`,
      );
    }
  } catch {
    showToast(FAILED);
  } finally {
    busy = false;
    render();
  }
}

saveButton.addEventListener('click', () => {
  void save();
});
clearButton.addEventListener('click', () => {
  loaded = null;
  render();
  $<HTMLInputElement>('#conv-input').focus();
});
for (const select of [sheetSelect, delimiterSelect, decimalSelect]) {
  select.addEventListener('change', render);
}
for (const button of detectButtons) {
  button.addEventListener('click', () => {
    detect = button.dataset.detect === 'yes';
    render();
  });
}

preventAccidentalFileOpen();
wireDropzone($('#conv-drop'), $<HTMLInputElement>('#conv-input'), (files) => {
  void openFiles(files);
});
render();
