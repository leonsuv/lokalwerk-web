/**
 * Werkzeugseite „PDF-Formular ausfüllen“ (plan-phase2.md, Vorschlag B). pdf-lib liest und füllt
 * das Formular im Worker, pdf.js zeigt die Seite des gerade bearbeiteten Feldes. Die Eingaben
 * werden nicht gespeichert (AGENTS.md Regel 5).
 */

import { isPdf } from '../../core/files/classify.ts';
import { formatBytes } from '../../core/format/bytes.ts';
import type { FieldValue, FormField, FormInfo } from '../../core/pdf/form.ts';
import { unsupportedChars } from '../../core/pdf/winansi.ts';
import { $, $$ } from '../../ui/dom.ts';
import { saveBlob } from '../../ui/download.ts';
import { preventAccidentalFileOpen, wireDropzone } from '../../ui/dropzone.ts';
import { countLocalBytes } from '../../ui/local-counter.ts';
import type { PDFDocumentProxy } from '../../ui/pdfjs/pdfjs.ts';
import { showToast } from '../../ui/toast.ts';
import { createWorkerClient, WorkerError } from '../../ui/worker-protocol.ts';
import type { FormRequest } from './form.worker.ts';

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
  'worker-failed': 'Das Werkzeug konnte nicht starten. Lade die Seite neu.',
  xfa: 'Das ist ein XFA-Formular. Das lässt sich hier nicht ausfüllen; nimm dafür das Programm, das der Herausgeber des Formulars nennt.',
  charset:
    'Eine Eingabe enthält Zeichen, die die PDF-Schrift nicht darstellen kann. Ersetze sie, zum Beispiel Ł durch L.',
};
const FALLBACK =
  'Die Datei konnte nicht verarbeitet werden. Lade die Seite neu und versuch es noch einmal.';
const messageFor = (error: unknown): string =>
  (error instanceof WorkerError ? MESSAGES[error.code] : undefined) ?? FALLBACK;

// pdf-lib im Worker und pdf.js sofort laden (plan.md N4, offline).
const worker = new Worker(new URL('./form.worker.ts', import.meta.url), { type: 'module' });
const client = createWorkerClient<FormRequest>(worker);
const pdfjs = import('../../ui/pdfjs/pdfjs.ts');

type Current =
  | { state: 'checking'; file: File }
  | { state: 'ok'; file: File; info: FormInfo; doc: PDFDocumentProxy | null }
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

const editable = (f: FormField) => !f.readOnly && f.kind !== 'signature';

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

function labelText(f: FormField): string {
  return f.required ? `${f.label} (Pflichtfeld)` : f.label;
}

function hint(text: string, className = 'hint'): HTMLParagraphElement {
  const p = document.createElement('p');
  p.className = className;
  p.textContent = text;
  return p;
}

/** Ein Eingabeelement je Feld; data-index verweist auf info.fields */
function control(f: FormField, i: number): HTMLElement {
  const id = `form-f-${i}`;
  const wrap = document.createElement('div');
  wrap.className = 'field';
  wrap.dataset.index = String(i);

  if (f.kind === 'text') {
    const label = document.createElement('label');
    label.className = 'lbl';
    label.htmlFor = id;
    label.textContent = labelText(f);
    const input = f.multiline
      ? document.createElement('textarea')
      : document.createElement('input');
    if (input instanceof HTMLInputElement) input.type = 'text';
    input.id = id;
    input.value = typeof f.value === 'string' ? f.value : '';
    input.disabled = f.readOnly;
    input.required = f.required;
    if (f.maxLength !== null) input.maxLength = f.maxLength;
    input.setAttribute('aria-describedby', `${id}-err`);
    const err = hint('', 'hint err');
    err.id = `${id}-err`;
    wrap.append(label, input, err);
  } else if (f.kind === 'checkbox') {
    wrap.classList.add('check-list');
    const label = document.createElement('label');
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.id = id;
    box.checked = f.value === true;
    box.disabled = f.readOnly;
    label.append(box, labelText(f));
    wrap.append(label);
  } else if (f.kind === 'radio') {
    const set = document.createElement('fieldset');
    set.className = 'check-list';
    const legend = document.createElement('legend');
    legend.className = 'lbl';
    legend.textContent = labelText(f);
    const pills = document.createElement('div');
    pills.className = 'pills';
    for (const [k, option] of ['', ...f.options].entries()) {
      const label = document.createElement('label');
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = id;
      radio.value = option;
      radio.id = `${id}-${k}`;
      radio.checked = f.value === option;
      radio.disabled = f.readOnly;
      label.append(radio, option === '' ? 'Keine Auswahl' : option);
      pills.append(label);
    }
    set.append(legend, pills);
    wrap.append(set);
  } else if (f.kind === 'dropdown' || f.kind === 'list') {
    const label = document.createElement('label');
    label.className = 'lbl';
    label.htmlFor = id;
    label.textContent = labelText(f);
    const select = document.createElement('select');
    select.id = id;
    select.multiple = f.multiselect;
    select.disabled = f.readOnly;
    if (f.multiselect) select.size = Math.min(6, Math.max(2, f.options.length));
    const selected = Array.isArray(f.value) ? f.value : [];
    if (!f.multiselect) select.append(new Option('Bitte wählen', '', false, selected.length === 0));
    for (const option of f.options) {
      select.append(new Option(option, option, false, selected.includes(option)));
    }
    wrap.append(label, select);
  } else {
    const label = document.createElement('span');
    label.className = 'lbl';
    label.textContent = labelText(f);
    const note = document.createElement('p');
    note.className = 'hint';
    const link = document.createElement('a');
    link.href = '/pdf-unterschreiben/';
    link.textContent = 'Unterschrift einfügen';
    note.append(
      'Unterschriftsfeld: wird hier nicht ausgefüllt. Eine Unterschrift als Bild setzt du mit ',
      link,
      '.',
    );
    wrap.append(label, note);
  }
  if (f.readOnly && f.kind !== 'signature')
    wrap.append(hint('Schreibgeschützt, lässt sich nicht ändern.'));
  return wrap;
}

function valueFor(f: FormField, i: number): FieldValue {
  const id = `form-f-${i}`;
  if (f.kind === 'text') {
    return fieldsForm.querySelector<HTMLInputElement | HTMLTextAreaElement>(`#${id}`)?.value ?? '';
  }
  if (f.kind === 'checkbox')
    return fieldsForm.querySelector<HTMLInputElement>(`#${id}`)?.checked ?? false;
  if (f.kind === 'radio') {
    return fieldsForm.querySelector<HTMLInputElement>(`input[name="${id}"]:checked`)?.value ?? '';
  }
  const select = fieldsForm.querySelector<HTMLSelectElement>(`#${id}`);
  return select ? [...select.selectedOptions].map((o) => o.value).filter((v) => v !== '') : [];
}

function values(): Record<string, FieldValue> {
  if (current?.state !== 'ok') return {};
  const out: Record<string, FieldValue> = {};
  current.info.fields.forEach((f, i) => {
    if (editable(f)) out[f.name] = valueFor(f, i);
  });
  return out;
}

/** Zeichen außerhalb von WinAnsi je Textfeld anzeigen; true, wenn alles passt */
function checkChars(): boolean {
  if (current?.state !== 'ok' || !charset) return true;
  let ok = true;
  current.info.fields.forEach((f, i) => {
    if (f.kind !== 'text' || !editable(f)) return;
    const text = String(valueFor(f, i)).replace(/[\r\n\t]/g, '');
    const missing = unsupportedChars(text, charset ?? new Set());
    const err = $(`#form-f-${i}-err`);
    err.textContent =
      missing.length === 0
        ? ''
        : `Diese Zeichen kann die PDF-Schrift nicht darstellen: ${missing.map((c) => `„${c}“`).join(', ')}. Ersetze sie, zum Beispiel Ł durch L.`;
    $(`#form-f-${i}`).setAttribute('aria-invalid', String(missing.length > 0));
    if (missing.length > 0) ok = false;
  });
  return ok;
}

function render(): void {
  fileList.replaceChildren(...(current ? [fileRow(current)] : []));
  $('#form-empty').hidden = current !== null;
  const ok = current?.state === 'ok' ? current : null;
  $('#form-signed').hidden = !ok?.info.signed;
  $('#form-hybrid').hidden = ok?.info.xfa !== 'hybrid';
  for (const b of flattenButtons) {
    b.setAttribute('aria-pressed', String((b.dataset.flatten === 'yes') === flatten));
  }
  const fields = ok?.info.fields ?? [];
  const vals = values();
  const missing = fields.filter((f) => {
    if (!f.required || !editable(f)) return false;
    const v = vals[f.name];
    return v === '' || v === false || (Array.isArray(v) && v.length === 0);
  }).length;
  $('#form-count').textContent = ok ? String(fields.length) : '–';
  $('#form-missing').textContent = ok ? String(missing) : '–';
  const charsOk = checkChars();
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
      error:
        'Diese PDF hat keine ausfüllbaren Felder. Druck sie aus oder frag beim Herausgeber nach einer ausfüllbaren Fassung.',
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
  current = { state: 'ok', file, info, doc };
  fieldsForm.replaceChildren(...info.fields.map(control));
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
      values: values(),
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
  const wrap = (e.target as Element).closest<HTMLElement>('[data-index]');
  const f = current?.state === 'ok' ? current.info.fields[Number(wrap?.dataset.index)] : undefined;
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
