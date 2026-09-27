/**
 * Werkzeugseite „PDF-Metadaten entfernen“ (plan-phase2.md, Werkzeug 8). Prüfen und Entfernen
 * laufen im Worker; diese Datei zeigt die Befunde und speichert das Ergebnis.
 */

import { isPdf } from '../../core/files/classify.ts';
import { formatBytes } from '../../core/format/bytes.ts';
import { $ } from '../../ui/dom.ts';
import { saveBlob } from '../../ui/download.ts';
import { preventAccidentalFileOpen, wireDropzone } from '../../ui/dropzone.ts';
import { countLocalBytes } from '../../ui/local-counter.ts';
import { showToast } from '../../ui/toast.ts';
import { createWorkerClient, WorkerError } from '../../ui/worker-protocol.ts';
import { workshopLink } from '../../ui/workshop-link.ts';
import type { MetadataRequest, PdfInspection } from './metadata.worker.ts';

// Weiter in der PDF-Werkstatt (plan-phase3.md 5.2)
const toWorkshop = workshopLink();

const MESSAGES: Record<string, string> = {
  empty: 'Die Datei ist leer.',
  encrypted:
    'Die PDF ist verschlüsselt (Passwort- oder Kopierschutz). Entferne den Schutz und füge sie erneut hinzu.',
  damaged:
    'Die Datei ist beschädigt oder keine gültige PDF. Speichere sie im Ursprungsprogramm erneut als PDF.',
  'no-pages': 'Die PDF enthält keine Seiten.',
  'out-of-memory': 'Nicht genug Arbeitsspeicher für diese PDF.',
  unreadable:
    'Die Datei konnte nicht gelesen werden. Prüfe, ob sie noch am selben Ort liegt, und füge sie erneut hinzu.',
  'metadata-left':
    'In der neuen Datei wurden noch Angaben gefunden. Sie wird deshalb nicht angeboten.',
  'worker-failed': 'Das Werkzeug konnte nicht starten. Lade die Seite neu.',
};
const FALLBACK =
  'Die Datei konnte nicht verarbeitet werden. Lade die Seite neu und versuch es noch einmal.';

const messageFor = (error: unknown): string =>
  (error instanceof WorkerError ? MESSAGES[error.code] : undefined) ?? FALLBACK;

/** Deutsche Namen der Standardangaben (ISO 32000-2, Tabelle 349) */
const LABELS: Record<string, string> = {
  Title: 'Titel',
  Author: 'Autor',
  Subject: 'Thema',
  Keywords: 'Stichwörter',
  Creator: 'Erstellt mit',
  Producer: 'PDF erzeugt mit',
  CreationDate: 'Erstellt am',
  ModDate: 'Zuletzt geändert am',
  Trapped: 'Überfüllung (Druckvorstufe)',
};

// Worker sofort starten: lädt pdf-lib, danach geht alles offline (plan.md N4).
const worker = new Worker(new URL('./metadata.worker.ts', import.meta.url), { type: 'module' });
const client = createWorkerClient<MetadataRequest>(worker);

const fileList = $<HTMLUListElement>('#meta-file');
const panel = $('#meta-panel');
const infoBody = $('#meta-info tbody');
const moreBody = $('#meta-more tbody');
const saveButton = $<HTMLButtonElement>('#meta-save');
const saveLabel = $('#meta-save-label');
const clearButton = $<HTMLButtonElement>('#meta-clear');
const idleLabel = saveLabel.textContent ?? '';

type Current =
  | { state: 'checking'; file: File }
  | { state: 'ok'; file: File; result: PdfInspection }
  | { state: 'error'; file: File; error: string };
let current: Current | null = null;
let busy = false;

function cells(...texts: string[]): HTMLTableRowElement {
  const tr = document.createElement('tr');
  for (const [i, text] of texts.entries()) {
    const cell = document.createElement(i === 0 ? 'th' : 'td');
    if (i === 0) cell.setAttribute('scope', 'row');
    cell.textContent = text;
    tr.append(cell);
  }
  return tr;
}

const count = (n: number, one: string, many: string) =>
  n === 0 ? 'keine' : `${n} ${n === 1 ? one : many}`;

function moreRows(r: PdfInspection): HTMLTableRowElement[] {
  return [
    cells(
      'XMP-Metadaten',
      r.xmpBytes === null ? 'keine' : `vorhanden (${formatBytes(r.xmpBytes)})`,
      'werden entfernt',
    ),
    cells(
      'Frühere Speicherstände',
      count(r.earlierVersions, 'früherer Stand', 'frühere Stände'),
      'werden entfernt',
    ),
    cells('Anhänge', count(r.attachments, 'Datei', 'Dateien'), 'werden entfernt'),
    cells('JavaScript', r.javascript ? 'vorhanden' : 'keines', 'wird entfernt'),
    cells('Lesezeichen', r.bookmarks ? 'vorhanden' : 'keine', 'werden entfernt'),
    cells(
      'Formularfelder',
      count(r.formFields, 'Feld', 'Felder'),
      'werden entfernt, sie lassen sich nicht mehr ausfüllen',
    ),
    cells(
      'Metadaten einzelner Seiten',
      count(r.pagesWithMetadata, 'Seite', 'Seiten'),
      'werden entfernt',
    ),
    cells(
      'Kommentare und Markierungen',
      count(r.comments, 'Kommentar', 'Kommentare'),
      'bleiben erhalten, können Namen enthalten',
    ),
  ];
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
    const { pages, version } = entry.result;
    info.textContent = `${pages} ${pages === 1 ? 'Seite' : 'Seiten'}, ${size}${version ? `, PDF ${version}` : ''}`;
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
  toWorkshop(current?.state === 'ok' ? [current.file] : null);
  fileList.replaceChildren(...(current ? [fileRow(current)] : []));
  $('#meta-empty').hidden = current !== null;
  const result = current?.state === 'ok' ? current.result : null;
  panel.hidden = result === null;
  if (result) {
    infoBody.replaceChildren(...result.info.map((e) => cells(LABELS[e.key] ?? e.key, e.value)));
    $('#meta-info-wrap').hidden = result.info.length === 0;
    $('#meta-none').hidden = result.info.length > 0;
    moreBody.replaceChildren(...moreRows(result));
  }
  saveButton.disabled = busy || result === null;
  clearButton.disabled = busy || current === null;
}

async function inspect(file: File): Promise<void> {
  current = { state: 'checking', file };
  render();
  try {
    const result = await client.request<PdfInspection>({ type: 'inspect', file });
    if (current?.file !== file) return;
    current = { state: 'ok', file, result };
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
  if (files.length > 1) showToast('Es wird eine PDF auf einmal geprüft: die erste.');
  void inspect(file);
}

async function save(): Promise<void> {
  if (current?.state !== 'ok') return;
  const { file } = current;
  busy = true;
  saveLabel.textContent = 'Wird bereinigt …';
  render();
  try {
    const bytes = await client.request<Uint8Array>({ type: 'strip', file });
    const base = file.name.replace(/\.pdf$/i, '').trim() || 'dokument';
    saveBlob(
      `${base}-bereinigt.pdf`,
      new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }),
    );
    countLocalBytes(file.size);
    showToast('Fertig: Die bereinigte PDF ist gespeichert und enthält keine dieser Angaben mehr.');
  } catch (error) {
    showToast(messageFor(error));
  } finally {
    busy = false;
    saveLabel.textContent = idleLabel;
    render();
  }
}

saveButton.addEventListener('click', () => {
  void save();
});
clearButton.addEventListener('click', () => {
  current = null;
  render();
  $<HTMLInputElement>('#meta-input').focus();
});

preventAccidentalFileOpen();
wireDropzone($('#meta-drop'), $<HTMLInputElement>('#meta-input'), openFiles);
render();
