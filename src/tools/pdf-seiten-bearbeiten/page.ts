/**
 * Werkzeugseite „PDF-Seiten bearbeiten“ (plan-phase2.md, Werkzeug 2). Die Vorschau zeichnet
 * pdf.js, gespeichert wird mit pdf-lib im Worker. Umsortieren geht über Knöpfe, also mit Maus,
 * Tastatur und Touch gleich (WCAG 2.2, 2.5.7: keine Ziehbewegung nötig).
 */

import { isPdf } from '../../core/files/classify.ts';
import { formatBytes } from '../../core/format/bytes.ts';
import type { PagePlan } from '../../core/pdf/organize.ts';
import { normalizeRotation } from '../../core/pdf/stamp-geometry.ts';
import { $ } from '../../ui/dom.ts';
import { saveBlob } from '../../ui/download.ts';
import { preventAccidentalFileOpen, wireDropzone } from '../../ui/dropzone.ts';
import { LazyRenderer } from '../../ui/lazy-render.ts';
import { countLocalBytes } from '../../ui/local-counter.ts';
import type { PDFDocumentProxy } from '../../ui/pdfjs/pdfjs.ts';
import { showToast } from '../../ui/toast.ts';
import { createWorkerClient, WorkerError } from '../../ui/worker-protocol.ts';
import { workshopLink } from '../../ui/workshop-link.ts';
import type { OrganizeRequest } from './organize.worker.ts';

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
  'worker-failed': 'Das Werkzeug konnte nicht starten. Lade die Seite neu.',
};
const FALLBACK =
  'Die Datei konnte nicht verarbeitet werden. Lade die Seite neu und versuch es noch einmal.';
const messageFor = (error: unknown): string =>
  (error instanceof WorkerError ? MESSAGES[error.code] : undefined) ?? FALLBACK;

// Beides sofort laden: pdf-lib im Worker, pdf.js samt eigenem Worker (plan.md N4, offline).
const worker = new Worker(new URL('./organize.worker.ts', import.meta.url), { type: 'module' });
const client = createWorkerClient<OrganizeRequest>(worker);
const pdfjs = import('../../ui/pdfjs/pdfjs.ts');

/** Kantenlänge der Vorschau in CSS-Pixeln */
const THUMB = 150;

interface PageEntry {
  id: number;
  /** Seite im Original, ab 1 */
  source: number;
  /** Zusätzliche Drehung im Uhrzeigersinn */
  rotate: number;
  li: HTMLLIElement;
  thumb: HTMLDivElement;
}

type Current =
  | { state: 'checking'; file: File }
  | { state: 'ok'; file: File; pages: number }
  | { state: 'error'; file: File; error: string };

const fileList = $<HTMLUListElement>('#org-file');
const grid = $<HTMLOListElement>('#org-pages');
const saveButton = $<HTMLButtonElement>('#org-save');
const saveLabel = $('#org-save-label');
const idleLabel = saveLabel.textContent ?? '';

let current: Current | null = null;
let doc: PDFDocumentProxy | null = null;
let entries: PageEntry[] = [];
let nextId = 1;
let busy = false;
let openToken = 0;
const lazy = new LazyRenderer();

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
    info.textContent = `${entry.pages} ${entry.pages === 1 ? 'Seite' : 'Seiten'}, ${size}`;
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

function actionButton(action: string, icon: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn icon';
  button.dataset.action = action;
  // Festes Markup ohne Nutzerdaten; der HTML-Parser setzt den SVG-Namensraum selbst.
  button.innerHTML = `<svg width="18" height="18" aria-hidden="true"><use href="#${icon}" /></svg>`;
  return button;
}

function createEntry(source: number): PageEntry {
  const id = nextId++;
  const li = document.createElement('li');
  li.className = 'page-tile';
  li.dataset.id = String(id);
  const thumb = document.createElement('div');
  thumb.className = 'page-thumb';
  const body = document.createElement('div');
  body.className = 'body';
  const name = document.createElement('span');
  name.className = 'nm';
  const info = document.createElement('span');
  info.className = 'sz';
  const actions = document.createElement('div');
  actions.className = 'tile-actions';
  actions.append(
    actionButton('rotate-left', 'i-rotate-left'),
    actionButton('rotate-right', 'i-rotate-right'),
    actionButton('back', 'i-left'),
    actionButton('forward', 'i-right'),
    actionButton('remove', 'i-x'),
  );
  body.append(name, info, actions);
  li.append(thumb, body);
  const entry: PageEntry = { id, source, rotate: 0, li, thumb };
  scheduleThumb(entry);
  return entry;
}

const LABELS: Record<string, string> = {
  'rotate-left': 'nach links drehen',
  'rotate-right': 'nach rechts drehen',
  back: 'nach vorn schieben',
  forward: 'nach hinten schieben',
  remove: 'löschen',
};

function updateEntry(entry: PageEntry, index: number): void {
  const [name, info] = entry.li.querySelectorAll('.nm, .sz');
  if (name) name.textContent = `Seite ${entry.source}`;
  const turned = entry.rotate === 0 ? '' : `, um ${entry.rotate}° gedreht`;
  if (info) info.textContent = `Position ${index + 1}${turned}`;
  for (const button of entry.li.querySelectorAll<HTMLButtonElement>('button[data-action]')) {
    const action = button.dataset.action ?? '';
    button.setAttribute(
      'aria-label',
      `Seite ${entry.source}, Position ${index + 1}: ${LABELS[action] ?? action}`,
    );
    button.disabled =
      busy ||
      (action === 'back' && index === 0) ||
      (action === 'forward' && index === entries.length - 1) ||
      (action === 'remove' && entries.length === 1);
  }
}

function scheduleThumb(entry: PageEntry): void {
  lazy.observe(entry.li, async () => {
    const { pageSize, renderPageAt } = await pdfjs;
    if (!doc) return;
    const rotate = entry.rotate;
    try {
      const size = await pageSize(doc, entry.source, rotate);
      const scale =
        (THUMB * (globalThis.devicePixelRatio || 1)) / Math.max(size.width, size.height);
      const canvas = await renderPageAt(doc, entry.source, { scale, extraRotation: rotate });
      canvas.setAttribute('aria-hidden', 'true');
      if (entry.rotate === rotate) entry.thumb.replaceChildren(canvas);
    } catch {
      const err = document.createElement('span');
      err.className = 'err';
      err.textContent = 'Keine Vorschau möglich';
      entry.thumb.replaceChildren(err);
    }
  });
}

function render(): void {
  toWorkshop(current?.state === 'ok' ? [current.file] : null);
  fileList.replaceChildren(...(current ? [fileRow(current)] : []));
  $('#org-empty').hidden = current !== null;
  const ok = current?.state === 'ok';
  grid.hidden = !ok;
  $('#org-count').textContent = current?.state === 'ok' ? String(current.pages) : '–';
  $('#org-result').textContent = ok ? String(entries.length) : '–';
  $('#org-rotated').textContent = ok ? String(entries.filter((e) => e.rotate !== 0).length) : '–';
  entries.forEach(updateEntry);
  saveButton.disabled = busy || !ok || entries.length === 0;
  $<HTMLButtonElement>('#org-rotate-all').disabled = busy || !ok;
  $<HTMLButtonElement>('#org-reset').disabled = busy || !ok;
  $<HTMLButtonElement>('#org-clear').disabled = busy || current === null;
}

function showPages(pages: number): void {
  lazy.clear();
  entries = Array.from({ length: pages }, (_, i) => createEntry(i + 1));
  grid.replaceChildren(...entries.map((e) => e.li));
}

/** Nach dem Umordnen den Tastaturfokus beim selben Knopf lassen, sonst beim nächsten sinnvollen. */
function restoreFocus(id: number, action: string): void {
  const li = grid.querySelector(`li[data-id="${id}"]`);
  const buttons = [...(li?.querySelectorAll<HTMLButtonElement>('button[data-action]') ?? [])];
  (
    buttons.find((b) => b.dataset.action === action && !b.disabled) ??
    buttons.find((b) => !b.disabled)
  )?.focus();
}

grid.addEventListener('click', (event) => {
  const button = (event.target as Element).closest<HTMLButtonElement>('button[data-action]');
  const li = button?.closest<HTMLLIElement>('li[data-id]');
  if (!button || !li || busy) return;
  const i = entries.findIndex((e) => e.id === Number(li.dataset.id));
  const entry = entries[i];
  if (!entry) return;
  const action = button.dataset.action ?? '';

  if (action === 'rotate-left' || action === 'rotate-right') {
    entry.rotate = normalizeRotation(entry.rotate + (action === 'rotate-left' ? -90 : 90));
    scheduleThumb(entry);
    render();
    return;
  }
  if (action === 'remove') {
    entries.splice(i, 1);
    entry.li.remove();
    render();
    const next = entries[i] ?? entries[i - 1];
    if (next) restoreFocus(next.id, 'remove');
    showToast(`Seite ${entry.source} gelöscht.`);
    return;
  }
  const j = action === 'back' ? i - 1 : i + 1;
  const other = entries[j];
  if (!other) return;
  entries[i] = other;
  entries[j] = entry;
  grid.replaceChildren(...entries.map((e) => e.li));
  render();
  restoreFocus(entry.id, action);
});

async function open(file: File): Promise<void> {
  const token = ++openToken;
  lazy.clear();
  entries = [];
  grid.replaceChildren();
  const previous = doc;
  doc = null;
  if (previous) void (await pdfjs).closePdf(previous);
  current = { state: 'checking', file };
  render();

  let pages: number;
  try {
    pages = await client.request<number>({ type: 'inspect', file });
  } catch (error) {
    if (token !== openToken) return;
    current = { state: 'error', file, error: messageFor(error) };
    render();
    return;
  }
  try {
    const { openPdf } = await pdfjs;
    const opened = await openPdf(new Uint8Array(await file.arrayBuffer()));
    if (token !== openToken) {
      void (await pdfjs).closePdf(opened);
      return;
    }
    doc = opened;
  } catch {
    // Speichern geht trotzdem; die Kacheln zeigen dann „Keine Vorschau möglich“.
  }
  if (token !== openToken) return;
  current = { state: 'ok', file, pages };
  showPages(pages);
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
  if (current?.state !== 'ok' || entries.length === 0) return;
  const { file } = current;
  const plan: PagePlan[] = entries.map((e) => ({ source: e.source, rotate: e.rotate }));
  busy = true;
  saveLabel.textContent = 'Wird gespeichert …';
  render();
  try {
    const bytes = await client.request<Uint8Array>({ type: 'organize', file, plan });
    const base = file.name.replace(/\.pdf$/i, '').trim() || 'dokument';
    saveBlob(
      `${base}-bearbeitet.pdf`,
      new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }),
    );
    countLocalBytes(file.size);
    showToast(
      `Fertig: Die PDF mit ${plan.length} ${plan.length === 1 ? 'Seite' : 'Seiten'} ist gespeichert.`,
    );
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
$('#org-rotate-all').addEventListener('click', () => {
  for (const entry of entries) {
    entry.rotate = normalizeRotation(entry.rotate + 90);
    scheduleThumb(entry);
  }
  render();
});
$('#org-reset').addEventListener('click', () => {
  if (current?.state !== 'ok') return;
  showPages(current.pages);
  render();
  showToast('Alle Änderungen zurückgesetzt.');
});
$('#org-clear').addEventListener('click', () => {
  openToken++;
  lazy.clear();
  entries = [];
  grid.replaceChildren();
  current = null;
  const previous = doc;
  doc = null;
  if (previous) void pdfjs.then((m) => m.closePdf(previous));
  render();
  $<HTMLInputElement>('#org-input').focus();
});

preventAccidentalFileOpen();
wireDropzone($('#org-drop'), $<HTMLInputElement>('#org-input'), openFiles);
render();
