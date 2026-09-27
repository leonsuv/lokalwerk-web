/**
 * Werkzeugseite „PDF-Formular ausfüllen“ (plan-phase2.md, Vorschlag B). pdf-lib liest und füllt
 * das Formular im Worker, pdf.js zeigt die Seite des gerade bearbeiteten Feldes. Die Eingaben
 * werden nicht gespeichert (AGENTS.md Regel 5).
 */

import { isPdf } from '../../core/files/classify.ts';
import { formatBytes } from '../../core/format/bytes.ts';
import type { FormField, FormInfo } from '../../core/pdf/form.ts';
import { $, $$ } from '../../ui/dom.ts';
import { saveBlob } from '../../ui/download.ts';
import { preventAccidentalFileOpen, wireDropzone } from '../../ui/dropzone.ts';
import { countLocalBytes } from '../../ui/local-counter.ts';
import type { PDFDocumentProxy } from '../../ui/pdfjs/pdfjs.ts';
import { loadPdfjs, PdfjsUnsupportedError } from '../../ui/pdfjs/support.ts';
import { unsupportedNote } from '../../ui/pdfjs/unsupported-note.ts';
import { showToast } from '../../ui/toast.ts';
import { createWorkerClient } from '../../ui/worker-protocol.ts';
import { workshopLink } from '../../ui/workshop-link.ts';
import { editable, FormFields } from './fields.ts';
import { FALLBACK, MESSAGES, messageFor, NO_FIELDS } from './messages.ts';
import type { FormRequest } from './form.worker.ts';

// Weiter in der PDF-Werkstatt (plan-phase3.md 5.2)
const toWorkshop = workshopLink();

// pdf-lib im Worker und pdf.js sofort laden (plan.md N4, offline).
const worker = new Worker(new URL('./form.worker.ts', import.meta.url), { type: 'module' });
const client = createWorkerClient<FormRequest>(worker);
const pdfjs = loadPdfjs();
// Zu alter Browser (docs/pdfjs-kompatibilitaet.md 5): Hinweis oben, Ausfüllen geht trotzdem
const showUnsupported = unsupportedNote('preview');
let unsupported = false;
pdfjs.catch((error: unknown) => {
  if (!(error instanceof PdfjsUnsupportedError)) return;
  unsupported = true;
  render();
});

type Current =
  | { state: 'checking'; file: File }
  | { state: 'ok'; file: File; info: FormInfo; doc: PDFDocumentProxy | null; fields: FormFields }
  | { state: 'error'; file: File; error: string };

const fileList = $<HTMLUListElement>('#form-file');
const fieldsForm = $<HTMLFormElement>('#form-fields');
const view = $<HTMLDivElement>('#form-view');
const flattenButtons = $$<HTMLButtonElement>('button[data-flatten]');
const saveButton = $<HTMLButtonElement>('#form-save');
const saveLabel = $('#form-save-label');
const idleLabel = saveLabel.textContent ?? '';

let current: Current | null = null;
let flatten = false;
let busy = false;
let openToken = 0;
let previewToken = 0;
let shownPage = 0;
let charset: Set<number> | null = null;

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
    const n = entry.info.fields.length;
    info.textContent = `${entry.info.pages} ${entry.info.pages === 1 ? 'Seite' : 'Seiten'}, ${n} ${n === 1 ? 'Feld' : 'Felder'}, ${size}`;
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
  showUnsupported({ unsupported, fileLoaded: current?.state === 'ok' });
  $('#form-empty').hidden = current !== null;
  const ok = current?.state === 'ok' ? current : null;
  $('#form-signed').hidden = !ok?.info.signed;
  $('#form-hybrid').hidden = ok?.info.xfa !== 'hybrid';
  for (const b of flattenButtons) {
    b.setAttribute('aria-pressed', String((b.dataset.flatten === 'yes') === flatten));
  }
  const fields = ok?.info.fields ?? [];
  if (ok) ok.fields.charset = charset;
  $('#form-count').textContent = ok ? String(fields.length) : '–';
  $('#form-missing').textContent = ok ? String(ok.fields.missing()) : '–';
  const charsOk = ok ? ok.fields.checkChars() : true;
  saveButton.disabled = busy || !ok || !fields.some(editable) || !charsOk || charset === null;
  $<HTMLButtonElement>('#form-clear').disabled = busy || current === null;
}

async function showPreview(f: FormField): Promise<void> {
  if (current?.state !== 'ok' || !current.doc || f.page === null) return;
  const { doc } = current;
  const layer = $('#form-layer');
  const mark = document.createElement('div');
  mark.className = 'field-mark';
  if (f.rect) {
    mark.style.left = `${f.rect.x * 100}%`;
    mark.style.top = `${f.rect.y * 100}%`;
    mark.style.width = `${f.rect.w * 100}%`;
    mark.style.height = `${f.rect.h * 100}%`;
  }
  layer.replaceChildren(mark);
  if (shownPage === f.page) return;
  const token = ++previewToken;
  const { renderPage } = await pdfjs;
  const width = view.parentElement?.clientWidth ?? 280;
  const canvas = document.createElement('canvas');
  canvas.id = 'form-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  await renderPage(doc, f.page, width, { canvas });
  if (token !== previewToken) return;
  $('#form-canvas').replaceWith(canvas);
  view.hidden = false;
  shownPage = f.page;
}

async function closeCurrent(): Promise<void> {
  fieldsForm.replaceChildren();
  view.hidden = true;
  shownPage = 0;
  $('#form-layer').replaceChildren();
  if (current?.state === 'ok' && current.doc) {
    const { doc } = current;
    current = null;
    await (await pdfjs).closePdf(doc);
  }
  current = null;
}

async function open(file: File): Promise<void> {
  const token = ++openToken;
  await closeCurrent();
  current = { state: 'checking', file };
  render();
  let info: FormInfo;
  try {
    info = await client.request<FormInfo>({ type: 'read', file });
  } catch (error) {
    if (token === openToken) current = { state: 'error', file, error: messageFor(error) };
    render();
    return;
  }
  if (token !== openToken) return;
  if (info.xfa === 'pure') {
    current = { state: 'error', file, error: MESSAGES['xfa'] ?? '' };
    render();
    return;
  }
  if (info.fields.length === 0) {
    current = {
      state: 'error',
      file,
      error: NO_FIELDS,
    };
    render();
    return;
  }
  let doc: PDFDocumentProxy | null = null;
  try {
    doc = await (await pdfjs).openPdf(new Uint8Array(await file.arrayBuffer()));
  } catch {
    // Ausfüllen geht trotzdem, nur ohne Vorschau.
  }
  if (token !== openToken) {
    if (doc) void (await pdfjs).closePdf(doc);
    return;
  }
  current = { state: 'ok', file, info, doc, fields: new FormFields(fieldsForm, info) };
  const first = info.fields[0];
  if (first) void showPreview(first);
  render();
}

export function openFiles(files: File[]): void {
  const [file] = files.filter(isPdf);
  if (!file) {
    showToast('Nur PDF-Dateien werden übernommen.');
    return;
  }
  if (files.length > 1) showToast('Es wird eine PDF auf einmal bearbeitet: die erste.');
  void open(file);
}

async function save(): Promise<void> {
  if (current?.state !== 'ok') return;
  const { file } = current;
  busy = true;
  saveLabel.textContent = 'Wird gespeichert …';
  render();
  try {
    const bytes = await client.request<Uint8Array>({
      type: 'fill',
      file,
      values: current.fields.values(),
      flatten,
    });
    const base = file.name.replace(/\.pdf$/i, '').trim() || 'formular';
    saveBlob(
      `${base}-ausgefuellt.pdf`,
      new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }),
    );
    countLocalBytes(file.size);
    showToast('Fertig: Das ausgefüllte Formular ist gespeichert.');
  } catch (error) {
    showToast(messageFor(error));
  } finally {
    busy = false;
    saveLabel.textContent = idleLabel;
    render();
  }
}

fieldsForm.addEventListener('submit', (e) => e.preventDefault());
fieldsForm.addEventListener('input', render);
fieldsForm.addEventListener('change', render);
fieldsForm.addEventListener('focusin', (e) => {
  const f = current?.state === 'ok' ? current.fields.fieldAt(e.target as Element) : undefined;
  if (f) void showPreview(f);
});
for (const b of flattenButtons) {
  b.addEventListener('click', () => {
    flatten = b.dataset.flatten === 'yes';
    render();
  });
}
saveButton.addEventListener('click', () => {
  void save();
});
$('#form-clear').addEventListener('click', () => {
  openToken++;
  void closeCurrent().then(() => {
    render();
    $<HTMLInputElement>('#form-input').focus();
  });
});

client.request<number[]>({ type: 'charset' }).then(
  (codes) => {
    charset = new Set(codes);
    render();
  },
  () => showToast(MESSAGES['worker-failed'] ?? FALLBACK),
);

preventAccidentalFileOpen();
wireDropzone($('#form-drop'), $<HTMLInputElement>('#form-input'), openFiles);
render();
