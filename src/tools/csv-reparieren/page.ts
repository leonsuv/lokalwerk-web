/**
 * Werkzeugseite „CSV reparieren“ (plan-phase2.md, Werkzeug 21). Lesen, Prüfen und Schreiben
 * laufen im Worker; diese Datei zeigt Vorschau und jede geplante Änderung vor dem Speichern.
 */

import type { TextEncoding } from '../../core/csv/decode.ts';
import type { OutputEncoding } from '../../core/csv/encode.ts';
import type { Delimiter } from '../../core/csv/parse.ts';
import { isCsv } from '../../core/files/classify.ts';
import { $, $$ } from '../../ui/dom.ts';
import { saveBlob } from '../../ui/download.ts';
import { preventAccidentalFileOpen, wireDropzone } from '../../ui/dropzone.ts';
import { countLocalBytes } from '../../ui/local-counter.ts';
import { showToast } from '../../ui/toast.ts';
import { createWorkerClient } from '../../ui/worker-protocol.ts';
import type { ReadSummary, RepairRequest, SaveResult } from './repair-types.ts';

const worker = new Worker(new URL('./repair.worker.ts', import.meta.url), { type: 'module' });
const client = createWorkerClient<RepairRequest>(worker);

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
const FAILED =
  'Die Datei konnte nicht verarbeitet werden. Lade die Seite neu und versuch es noch einmal.';

const repairButtons = $$<HTMLButtonElement>('button[data-repair]');
const saveButton = $<HTMLButtonElement>('#rep-save');
const saveLabel = $('#rep-save-label');
const clearButton = $<HTMLButtonElement>('#rep-clear');
const idleLabel = saveLabel.textContent ?? '';

let loaded: { file: File; summary: Extract<ReadSummary, { ok: true }> } | null = null;
let repair = true;
let busy = false;

function chip(text: string): HTMLSpanElement {
  const el = document.createElement('span');
  el.className = 'chip';
  el.textContent = text;
  return el;
}

function cell(tag: 'td' | 'th', text: string): HTMLElement {
  const el = document.createElement(tag);
  el.textContent = text;
  return el;
}

function columnName(headers: string[], column: number): string {
  const title = headers[column - 1]?.trim();
  return title ? `${column} (${title})` : String(column);
}

function render(): void {
  const s = loaded?.summary;
  $('#rep-empty').hidden = loaded !== null;
  $('#rep-panel').hidden = !s;
  $('#rep-changes-card').hidden = !s || (s.changeCount === 0 && s.unsureCount === 0);
  $('#rep-repair-field').hidden = !s || s.changeCount === 0;
  for (const b of repairButtons)
    b.setAttribute('aria-pressed', String((b.dataset.repair === 'yes') === repair));
  saveButton.disabled = busy || !s;
  clearButton.disabled = busy || !s;
  if (!s || !loaded) return;

  $('#rep-file').textContent = loaded.file.name;
  $('#rep-facts').replaceChildren(
    chip(`Kodierung: ${ENCODING_NAMES[s.encoding]}`),
    chip(`Trennzeichen: ${DELIMITER_NAMES[s.delimiter]}`),
    chip(`${s.rows} Zeilen, ${s.columns} Spalten`),
  );
  const irregular = $('#rep-irregular');
  irregular.hidden = s.irregular.rows.length === 0;
  const shown = s.irregular.rows.slice(0, 20).join(', ');
  irregular.textContent = `Diese Zeilen haben nicht ${s.irregular.expected} Spalten wie die meisten: ${shown}${s.irregular.rows.length > 20 ? ' …' : ''}. Oft steht dort ein Trennzeichen im Text ohne Anführungszeichen. Prüfe sie im Tabellenprogramm.`;

  const preview = $<HTMLTableElement>('#rep-preview');
  const caption = preview.caption;
  const body = document.createElement('tbody');
  for (const row of repair ? s.preview : s.previewRaw) {
    const tr = document.createElement('tr');
    for (let c = 0; c < s.columns; c++) tr.append(cell('td', row[c] ?? ''));
    body.append(tr);
  }
  preview.replaceChildren(...(caption ? [caption] : []), body);

  $('#rep-changes-intro').textContent =
    s.changeCount === 0
      ? 'Keine Stelle ließ sich eindeutig reparieren.'
      : `${s.changeCount} ${s.changeCount === 1 ? 'Zelle wird' : 'Zellen werden'} beim Speichern so geändert${s.changeCount > s.changes.length ? ` (die ersten ${s.changes.length} sind hier aufgelistet)` : ''}. Mit „So lassen“ bleibt alles unverändert.`;
  $('#rep-changes tbody').replaceChildren(
    ...s.changes.map((c) => {
      const tr = document.createElement('tr');
      tr.append(
        cell('td', String(c.row)),
        cell('td', columnName(s.headers, c.column)),
        cell('td', c.before),
        cell('td', c.after),
      );
      return tr;
    }),
  );
  $('#rep-changes').hidden = s.changeCount === 0;
  $('#rep-unsure').hidden = s.unsureCount === 0;
  $('#rep-unsure-list').replaceChildren(
    ...s.unsure.map((u) => {
      const li = document.createElement('li');
      li.textContent = `Zeile ${u.row}, Spalte ${columnName(s.headers, u.column)}: „${u.before}“`;
      return li;
    }),
  );
}

function readError(summary: Extract<ReadSummary, { ok: false }>): string {
  switch (summary.code) {
    case 'empty':
      return 'Die Datei ist leer.';
    case 'unreadable':
      return 'Die Datei konnte nicht gelesen werden. Prüfe, ob sie noch am selben Ort liegt, und füge sie erneut hinzu.';
    case 'unterminated-quote':
      return `In Zeile ${summary.line ?? '?'} fehlt ein schließendes Anführungszeichen. Ab dort lässt sich die Datei nicht eindeutig lesen; prüfe die Stelle im Texteditor.`;
  }
}

async function open(file: File): Promise<void> {
  busy = true;
  loaded = null;
  render();
  try {
    const summary = await client.request<ReadSummary>({ type: 'read', file });
    if (summary.ok) {
      loaded = { file, summary };
      repair = true;
      const delimiter = $<HTMLSelectElement>('#rep-delimiter');
      if (summary.delimiter === ',') delimiter.value = ',';
      if (summary.delimiter === '\t') delimiter.value = 'tab';
    } else {
      showToast(readError(summary));
    }
  } catch {
    showToast(FAILED);
  } finally {
    busy = false;
    render();
  }
  if (loaded) $('#rep-file').focus();
}

async function save(): Promise<void> {
  if (!loaded) return;
  const { file } = loaded;
  const value = $<HTMLSelectElement>('#rep-delimiter').value;
  const delimiter: Delimiter = value === 'tab' ? '\t' : value === ',' ? ',' : ';';
  busy = true;
  saveLabel.textContent = 'Wird gespeichert …';
  render();
  try {
    const result = await client.request<SaveResult>({
      type: 'save',
      repair,
      delimiter,
      encoding: $<HTMLSelectElement>('#rep-encoding').value as OutputEncoding,
    });
    if (!result.ok) {
      const chars = result.chars.map((c) => `„${c}“`).join(', ');
      showToast(
        `Diese Zeichen gibt es in Windows-1252 nicht: ${chars} (zuerst in Zeile ${result.line}). Wähle UTF-8 als Zeichenkodierung.`,
      );
      return;
    }
    const base = file.name.replace(/\.[^./\\]+$/, '').trim() || 'tabelle';
    saveBlob(
      `${base}-repariert.csv`,
      new Blob([result.bytes as Uint8Array<ArrayBuffer>], { type: 'text/csv' }),
    );
    countLocalBytes(file.size);
    showToast(
      result.repaired > 0
        ? `Fertig: CSV gespeichert, ${result.repaired} ${result.repaired === 1 ? 'Zelle' : 'Zellen'} repariert.`
        : 'Fertig: CSV gespeichert.',
    );
  } catch {
    showToast(FAILED);
  } finally {
    busy = false;
    saveLabel.textContent = idleLabel;
    render();
  }
}

for (const b of repairButtons) {
  b.addEventListener('click', () => {
    repair = b.dataset.repair === 'yes';
    render();
  });
}
saveButton.addEventListener('click', () => {
  void save();
});
clearButton.addEventListener('click', () => {
  loaded = null;
  render();
  $<HTMLInputElement>('#rep-input').focus();
});

preventAccidentalFileOpen();
wireDropzone($('#rep-drop'), $<HTMLInputElement>('#rep-input'), (files) => {
  const [file] = files;
  if (!file) return;
  if (!isCsv(file)) {
    showToast(
      'Nur CSV-Dateien (.csv, .txt) werden übernommen. Excel-Dateien wandelst du mit „Excel und CSV umwandeln“ um.',
    );
    return;
  }
  void open(file);
});
render();
