/**
 * Werkzeugseite „SEPA-Sammelüberweisung“. Einlesen im Worker, Prüfung und Erzeugung der
 * pain.001-Datei mit den Modulen aus src/core/sepa/ (docs/sepa-entscheidungen.md).
 */

import { isSpreadsheet } from '../../core/files/classify.ts';
import { formatEuro } from '../../core/format/money.ts';
import { FIELDS, guessColumns, type ColumnMapping, type Field } from '../../core/sepa/columns.ts';
import { checkExecutionDate, nextWorkday } from '../../core/sepa/dates.ts';
import { formatIban } from '../../core/sepa/iban.ts';
import { createMessageId, endToEndId, paymentInformationId } from '../../core/sepa/ids.ts';
import { buildPain001 } from '../../core/sepa/pain001.ts';
import {
  checkDebtor,
  checkTransfers,
  type CheckResult,
  type CheckedRow,
} from '../../core/sepa/transfers.ts';
import { toTable, type Table } from '../../core/sheet/table.ts';
import { $ } from '../../ui/dom.ts';
import { saveBlob } from '../../ui/download.ts';
import { preventAccidentalFileOpen, wireDropzone } from '../../ui/dropzone.ts';
import { countLocalBytes } from '../../ui/local-counter.ts';
import { showToast } from '../../ui/toast.ts';
import { createWorkerClient } from '../../ui/worker-protocol.ts';
import {
  dateMessage,
  readErrorMessage,
  rowErrorMessage,
  rowWarningMessage,
  TABLE_MESSAGES,
} from './messages.ts';
import type { ReadResult } from './read-result.ts';
import { SAMPLE_DEBTOR, SAMPLE_ROWS } from './sample.ts';
import type { ReadRequest } from './sheet.worker.ts';

/** Größere Listen werden vollständig geprüft, aber nur bis hierhin in der Tabelle gezeigt. */
const TABLE_LIMIT = 500;

// Worker sofort starten: lädt SheetJS, danach geht alles offline (plan.md N4).
const worker = new Worker(new URL('./sheet.worker.ts', import.meta.url), { type: 'module' });
const client = createWorkerClient<ReadRequest>(worker);

const nameInput = $<HTMLInputElement>('#s-name');
const ibanInput = $<HTMLInputElement>('#s-iban');
const bicInput = $<HTMLInputElement>('#s-bic');
const dateInput = $<HTMLInputElement>('#s-date');
const buildButton = $<HTMLButtonElement>('#sepa-build');
const outPanel = $('#sepa-out-panel');
const xmlOutput = $<HTMLTextAreaElement>('#sepa-xml');

let table: Table | null = null;
let mapping: ColumnMapping = guessColumns([]);
let result: CheckResult | null = null;
let fileName = '';

dateInput.value = nextWorkday(new Date());

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: { className?: string; text?: string } = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (props.className) element.className = props.className;
  if (props.text !== undefined) element.textContent = props.text;
  element.append(...children);
  return element;
}

const currentDebtor = () =>
  checkDebtor({ name: nameInput.value, iban: ibanInput.value, bic: bicInput.value });
const currentDate = () => checkExecutionDate(dateInput.value, new Date());

function invalidateOutput(): void {
  outPanel.hidden = true;
  xmlOutput.value = '';
}

function updateBuildButton(): void {
  buildButton.disabled = !(
    result &&
    result.valid.length > 0 &&
    currentDebtor().errors.length === 0 &&
    currentDate().ok
  );
}

function renderAccountStatus(): void {
  const status = $('#s-acc-status');
  const debtor = currentDebtor();
  if (nameInput.value.trim() === '' && ibanInput.value.trim() === '') {
    status.replaceChildren('Diese Angaben stehen als Auftraggeber in der Datei.');
  } else if (debtor.errors.length > 0) {
    status.replaceChildren(
      el('span', {
        className: 'badge err',
        text: debtor.errors.map((e) => rowErrorMessage(e, 'Kontoinhaber')).join(', '),
      }),
    );
  } else {
    const notes = debtor.warnings.map(rowWarningMessage).join('; ');
    status.replaceChildren(
      el('span', { className: 'badge ok', text: 'Konto geprüft' }),
      notes ? ` ${notes}` : '',
    );
  }

  const date = currentDate();
  const message = dateMessage(date);
  const dateStatus = $('#s-date-status');
  dateStatus.replaceChildren(
    message ? el('span', { className: date.ok ? '' : 'badge err', text: message }) : '',
  );
  updateBuildButton();
}

function renderMapping(headers: readonly string[]): void {
  const fields = FIELDS.map(({ field, label, required }) => {
    const id = `map-${field}`;
    const select = el('select');
    select.id = id;
    select.dataset.field = field;
    const none = el('option', { text: required ? 'Bitte wählen' : 'Nicht verwenden' });
    none.value = '-1';
    select.append(none);
    headers.forEach((header, i) => {
      const option = el('option', { text: header });
      option.value = String(i);
      option.selected = mapping[field] === i;
      select.append(option);
    });
    const lbl = el('label', { className: 'lbl', text: label });
    lbl.htmlFor = id;
    if (!required) lbl.append(' ', el('span', { className: 'opt', text: '(optional)' }));
    return el('div', {}, lbl, select);
  });
  $('#sepa-map').replaceChildren(...fields);
}

function renderSummary(checked: CheckResult): void {
  const chips: HTMLElement[] = [
    el(
      'span',
      { className: 'chip' },
      el('b', { text: String(checked.valid.length) }),
      ' Überweisungen',
    ),
    el('span', { className: 'chip' }, 'Summe ', el('b', { text: formatEuro(checked.totalCents) })),
  ];
  if (checked.excludedCount > 0) {
    const n = checked.excludedCount;
    chips.push(
      el(
        'span',
        { className: 'chip' },
        el('span', {
          className: 'badge err',
          text: `${n} ${n === 1 ? 'Zeile wird' : 'Zeilen werden'} wegen Fehlern übersprungen`,
        }),
      ),
    );
  }
  if (checked.singleTransfer)
    chips.push(el('span', { className: 'chip', text: TABLE_MESSAGES.single }));
  $('#sepa-summary').replaceChildren(...chips);
}

function checkCell(row: CheckedRow): HTMLElement {
  const cell = el('td');
  if (row.errors.length > 0) {
    cell.append(
      el('span', {
        className: 'badge err',
        text: row.errors.map((e) => rowErrorMessage(e)).join(', '),
      }),
    );
    return cell;
  }
  cell.append(el('span', { className: 'badge ok', text: 'OK' }));
  for (const warning of row.warnings)
    cell.append(el('span', { className: 'hint', text: rowWarningMessage(warning) }));
  return cell;
}

function renderTable(checked: CheckResult): void {
  const th = (text: string, className = '') => {
    const cell = el('th', { className, text });
    cell.scope = 'col';
    return cell;
  };
  const head = el(
    'thead',
    {},
    el(
      'tr',
      {},
      th('Zeile'),
      th('Empfänger'),
      th('IBAN'),
      th('Betrag', 'num'),
      th('Verwendungszweck'),
      th('Prüfung'),
    ),
  );
  const shown = checked.rows.slice(0, TABLE_LIMIT);
  const body = el(
    'tbody',
    {},
    ...shown.map((row) => {
      const tr = el(
        'tr',
        { className: row.errors.length > 0 ? 'bad' : '' },
        el('td', { text: String(row.sourceRow) }),
        el('td', { className: 'name', text: row.name }),
        el('td', { className: 'iban', text: row.iban ? formatIban(row.iban) : '' }),
        el('td', { className: 'num', text: row.cents === null ? '' : formatEuro(row.cents) }),
        el('td', { text: row.purpose }),
        checkCell(row),
      );
      return tr;
    }),
  );
  const caption = el('caption', { className: 'visually-hidden', text: 'Geprüfte Überweisungen' });
  $('#sepa-table').replaceChildren(caption, head, body);

  const note = $('#sepa-table-note');
  const hidden = checked.rows.length - shown.length;
  note.hidden = hidden <= 0;
  if (hidden > 0) {
    const hiddenErrors = checked.rows.slice(TABLE_LIMIT).filter((r) => r.errors.length > 0).length;
    note.textContent =
      `Angezeigt werden die ersten ${TABLE_LIMIT} von ${checked.rows.length} Zeilen. Geprüft werden alle.` +
      (hiddenErrors > 0 ? ` In den nicht angezeigten Zeilen haben ${hiddenErrors} Fehler.` : '');
  }
}

function recheck(): void {
  if (!table) return;
  result = checkTransfers(table, mapping);
  renderSummary(result);
  renderTable(result);
  invalidateOutput();
  updateBuildButton();
}

function loadRows(rows: readonly (readonly unknown[])[], name: string): boolean {
  const parsed = toTable(rows);
  if (!parsed.ok) {
    showToast(TABLE_MESSAGES[parsed.code]);
    return false;
  }
  table = parsed.table;
  fileName = name;
  mapping = guessColumns(table.headers);
  $('#sepa-map-panel').hidden = false;
  $('#sepa-empty').hidden = true;
  renderMapping(table.headers);
  recheck();
  return true;
}

export async function openFiles(files: File[]): Promise<void> {
  const [file] = files;
  if (!file) return;
  if (files.length > 1)
    showToast('Es wird nur die erste Datei übernommen. Füge eine Liste auf einmal hinzu.');
  if (!isSpreadsheet(file)) {
    showToast(TABLE_MESSAGES.unsupported);
    return;
  }
  let read: ReadResult;
  try {
    read = await client.request<ReadResult>({ type: 'read', file });
  } catch {
    showToast('Das Werkzeug konnte nicht starten. Lade die Seite neu.');
    return;
  }
  if (!read.ok) {
    showToast(readErrorMessage(read));
    return;
  }
  if (loadRows(read.rows, file.name)) countLocalBytes(file.size);
}

$('#sepa-map').addEventListener('change', (event) => {
  const select = event.target as HTMLSelectElement;
  const field = select.dataset.field as Field | undefined;
  if (!field) return;
  mapping = { ...mapping, [field]: Number(select.value) };
  recheck();
});

for (const input of [nameInput, ibanInput, bicInput, dateInput]) {
  input.addEventListener('input', () => {
    invalidateOutput();
    renderAccountStatus();
  });
}

$('#sepa-sample').addEventListener('click', () => {
  nameInput.value = SAMPLE_DEBTOR.name;
  ibanInput.value = SAMPLE_DEBTOR.iban;
  bicInput.value = '';
  renderAccountStatus();
  if (loadRows(SAMPLE_ROWS, 'Beispieldaten')) {
    showToast('Beispieldaten geladen. Zeile 5 enthält absichtlich einen IBAN-Tippfehler.');
  }
});

buildButton.addEventListener('click', () => {
  const debtor = currentDebtor();
  if (!result || debtor.errors.length > 0 || !currentDate().ok) return;
  const now = new Date();
  const messageId = createMessageId(now, crypto.getRandomValues(new Uint8Array(6)));
  try {
    xmlOutput.value = buildPain001({
      messageId,
      paymentInformationId: paymentInformationId(messageId),
      createdAt: now,
      executionDate: dateInput.value,
      debtor: { name: debtor.name, iban: debtor.iban, bic: debtor.bic },
      transactions: result.valid.map((row, i) => ({
        endToEndId: endToEndId(messageId, i),
        cents: row.cents ?? 0,
        name: row.name,
        iban: row.iban,
        bic: row.bic,
        purpose: row.purpose,
      })),
    });
  } catch (error) {
    console.error(error);
    showToast(
      'Die Datei konnte nicht erstellt werden. Lade die Seite neu und versuch es noch einmal.',
    );
    return;
  }
  outPanel.hidden = false;
  const title = $('#sepa-out-title');
  title.focus({ preventScroll: true });
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  outPanel.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  showToast(
    `Datei mit ${result.valid.length} Überweisungen erstellt${fileName ? ` aus ${fileName}` : ''}.`,
  );
});

$('#sepa-save').addEventListener('click', () => {
  saveBlob(
    `sepa-ueberweisung-${dateInput.value}.xml`,
    new Blob([xmlOutput.value], { type: 'application/xml' }),
  );
});

$('#sepa-copy').addEventListener('click', () => {
  navigator.clipboard.writeText(xmlOutput.value).then(
    () => showToast('XML kopiert.'),
    () => {
      xmlOutput.focus();
      xmlOutput.select();
      showToast('Text markiert. Mit Strg+C bzw. Cmd+C kopieren.');
    },
  );
});

preventAccidentalFileOpen();
wireDropzone($('#sepa-drop'), $<HTMLInputElement>('#sepa-input'), (files) => void openFiles(files));
renderAccountStatus();
