/**
 * Werkzeugseite „Foto-Metadaten anzeigen“ (plan-phase2.md, Werkzeug 15). exifr liest im Worker;
 * der Ort erscheint nur als Text, ohne Karte.
 */

import type { MetaFlag, MetaReport } from '../../core/images/exif-read.ts';
import { isImage } from '../../core/files/classify.ts';
import { formatBytes } from '../../core/format/bytes.ts';
import { ZipError } from '../../core/zip/write.ts';
import { $ } from '../../ui/dom.ts';
import { saveBlob } from '../../ui/download.ts';
import { preventAccidentalFileOpen, wireDropzone } from '../../ui/dropzone.ts';
import { countLocalBytes } from '../../ui/local-counter.ts';
import { showToast } from '../../ui/toast.ts';
import { createWorkerClient, WorkerError } from '../../ui/worker-protocol.ts';
import { zipBlobs } from '../../ui/zip.ts';
import type { MetaRead, MetaRequest, MetaStripped } from './meta-types.ts';

const worker = new Worker(new URL('./meta.worker.ts', import.meta.url), { type: 'module' });
const client = createWorkerClient<MetaRequest>(worker);

const STRIP_ERRORS: Record<string, string> = {
  decode: 'Das Bild lässt sich in diesem Browser nicht öffnen.',
  'too-large':
    'Das Bild ist zu groß für diesen Browser. Verkleinere es zuerst mit „Fotos verkleinern“.',
  metadata: 'In der neuen Datei steckten noch Angaben; sie wurde deshalb nicht gespeichert.',
};
const stripMessage = (error: unknown) =>
  (error instanceof WorkerError ? STRIP_ERRORS[error.code] : undefined) ??
  'Die Datei konnte nicht erzeugt werden. Lade die Seite neu und versuch es noch einmal.';

const FLAG_TEXT: Record<MetaFlag, string> = {
  gps: 'Aufnahmeort',
  camera: 'Kamera',
  date: 'Aufnahmezeit',
  person: 'Angaben zur Person',
  software: 'Programm',
};

interface Item {
  id: number;
  file: File;
  report: MetaReport | null;
  error: string;
}

const list = $('#meta-list');
const stripAll = $<HTMLButtonElement>('#meta-strip-all');
const stripLabel = $('#meta-strip-label');
const idleLabel = stripLabel.textContent ?? '';
let items: Item[] = [];
let nextId = 1;
let busy = false;

const strippedName = (name: string) => {
  const dot = name.lastIndexOf('.');
  return dot > 0
    ? `${name.slice(0, dot)}-ohne-metadaten${name.slice(dot)}`
    : `${name}-ohne-metadaten`;
};

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = '',
  text = '',
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function card(item: Item): HTMLElement {
  const section = el('section', 'meta-card');
  const head = el('div', 'meta-head');
  const title = el('h3', '', item.file.name);
  const size = el('span', 'hint', formatBytes(item.file.size));
  head.append(title, size);
  section.append(head);

  if (item.error) {
    section.append(el('p', 'hint err', item.error));
    return section;
  }
  if (!item.report) {
    section.append(el('p', 'hint', 'Wird gelesen …'));
    return section;
  }
  const chips = el('div', 'summary');
  if (item.report.flags.length === 0 && item.report.sections.length === 0) {
    chips.append(el('span', 'badge ok', 'Keine Metadaten gefunden'));
  } else {
    for (const flag of item.report.flags) chips.append(el('span', 'chip', FLAG_TEXT[flag]));
  }
  section.append(chips);

  for (const s of item.report.sections) {
    const table = el('table', 'meta-table');
    const caption = el('caption', '', s.title);
    const body = el('tbody');
    for (const row of s.rows) {
      const tr = el('tr');
      const th = el('th', '', row.label);
      th.scope = 'row';
      tr.append(th, el('td', '', row.value));
      body.append(tr);
    }
    table.append(caption, body);
    const wrap = el('div', 'table-wrap mt-s');
    wrap.append(table);
    section.append(wrap);
  }
  if (item.report.sections.length > 0) {
    const button = el('button', 'btn ghost sm mt-s', 'Ohne Metadaten speichern');
    button.type = 'button';
    button.dataset.id = String(item.id);
    button.disabled = busy;
    button.setAttribute('aria-label', `${item.file.name} ohne Metadaten speichern`);
    section.append(button);
  }
  return section;
}

function render(): void {
  list.replaceChildren(...items.map(card));
  $('#meta-empty').hidden = items.length > 0;
  const done = items.filter((i) => i.report);
  $('#meta-count').textContent = items.length ? String(items.length) : '–';
  $('#meta-gps').textContent = items.length
    ? String(done.filter((i) => i.report?.flags.includes('gps')).length)
    : '–';
  $('#meta-camera').textContent = items.length
    ? String(done.filter((i) => i.report?.flags.includes('camera')).length)
    : '–';
  $('#meta-clean').textContent = items.length
    ? String(done.filter((i) => i.report?.sections.length === 0).length)
    : '–';
  stripAll.disabled = busy || !done.some((i) => (i.report?.sections.length ?? 0) > 0);
  $<HTMLButtonElement>('#meta-clear').disabled = busy || items.length === 0;
}

async function read(item: Item): Promise<void> {
  try {
    const result = await client.request<MetaRead>({ type: 'read', file: item.file });
    if (result.ok) item.report = result.report;
    else
      item.error =
        result.code === 'unreadable'
          ? 'Die Datei konnte nicht gelesen werden. Füge sie erneut hinzu.'
          : 'Das ist kein JPEG-, PNG- oder WebP-Bild, oder die Datei ist beschädigt.';
  } catch {
    item.error = 'Die Datei konnte nicht gelesen werden. Lade die Seite neu.';
  }
  render();
}

export function addFiles(files: File[]): void {
  const images = files.filter(isImage);
  if (images.length < files.length) showToast('Nur Bilder (JPEG, PNG, WebP) werden übernommen.');
  let queue = Promise.resolve();
  for (const file of images) {
    const item: Item = { id: nextId++, file, report: null, error: '' };
    items.push(item);
    countLocalBytes(file.size);
    queue = queue.then(() => read(item));
  }
  render();
}

async function strip(targets: Item[]): Promise<void> {
  busy = true;
  render();
  try {
    const outputs: { name: string; blob: Blob }[] = [];
    for (const [i, item] of targets.entries()) {
      if (targets.length > 1)
        stripLabel.textContent = `Wird erstellt … (${i + 1} von ${targets.length})`;
      const result = await client.request<MetaStripped>({ type: 'strip', file: item.file });
      outputs.push({ name: strippedName(item.file.name), blob: result.blob });
    }
    const [single] = outputs;
    if (outputs.length === 1 && single) saveBlob(single.name, single.blob);
    else saveBlob('fotos-ohne-metadaten.zip', await zipBlobs(outputs));
    showToast(
      outputs.length === 1
        ? 'Fertig: Das Foto ist ohne Metadaten gespeichert.'
        : `Fertig: ${outputs.length} Fotos ohne Metadaten als ZIP gespeichert.`,
    );
  } catch (error) {
    showToast(
      error instanceof ZipError
        ? 'Die ZIP-Datei wäre zu groß. Speichere die Fotos einzeln oder in kleineren Gruppen.'
        : stripMessage(error),
    );
  } finally {
    busy = false;
    stripLabel.textContent = idleLabel;
    render();
  }
}

list.addEventListener('click', (e) => {
  const button = (e.target as Element).closest<HTMLButtonElement>('button[data-id]');
  const item = items.find((i) => i.id === Number(button?.dataset.id));
  if (item && !busy) void strip([item]);
});
stripAll.addEventListener('click', () => {
  void strip(items.filter((i) => (i.report?.sections.length ?? 0) > 0));
});
$('#meta-clear').addEventListener('click', () => {
  items = [];
  render();
  $<HTMLInputElement>('#meta-input').focus();
});

preventAccidentalFileOpen();
wireDropzone($('#meta-drop'), $<HTMLInputElement>('#meta-input'), addFiles);
render();
