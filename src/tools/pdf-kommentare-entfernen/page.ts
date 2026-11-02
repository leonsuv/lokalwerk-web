/**
 * Werkzeugseite „PDF-Kommentare entfernen“. Die Anmerkungen liest der Worker in ./list.worker.ts,
 * das Entfernen läuft im Worker in ./annotations.worker.ts. Diese Datei zeigt die Liste und die
 * Auswahl der Arten; Ablage, Dateizeile und Speichern kommen aus src/ui/pdf-tool.ts.
 */

import { isPdf } from '../../core/files/classify.ts';
import {
  defaultSelection,
  summarizeTypes,
  type AnnotationListing,
  type AnnotationType,
} from '../../core/pdf/annotations.ts';
import { $ } from '../../ui/dom.ts';
import { PDF_MESSAGES, mountPdfTool } from '../../ui/pdf-tool.ts';
import { createWorkerClient, WorkerError } from '../../ui/worker-protocol.ts';
import type { AnnotationOptions } from './annotations.worker.ts';

const FALLBACK =
  'Die Datei konnte nicht verarbeitet werden. Lade die Seite neu und versuch es noch einmal.';

const messageFor = (error: unknown): string =>
  (error instanceof WorkerError ? PDF_MESSAGES[error.code] : undefined) ?? FALLBACK;

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// Die Worker sofort starten: sie laden pdf-lib, danach geht alles offline (plan.md N4).
const worker = new Worker(new URL('./annotations.worker.ts', import.meta.url), { type: 'module' });
const listWorker = new Worker(new URL('./list.worker.ts', import.meta.url), { type: 'module' });
const listClient = createWorkerClient<{ type: 'list'; file: File }>(listWorker);

const loading = $('#kom-loading');
const errorLine = $('#kom-error');
const none = $('#kom-none');
const tableWrap = $('#kom-table-wrap');
const tableBody = $('#kom-table tbody');
const choose = $('#kom-choose');
const typeBox = $('#kom-types');
const formsNote = $('#kom-forms');
const countNow = $('#kom-count');
const keptNow = $('#kom-kept');

/** Die Datei, die gerade gelesen wird oder wurde; nur sie gilt für die Antwort der Liste */
let pendingFile: File | null = null;
/** Erhöht sich bei jeder neuen Datei, damit veraltete Antworten verworfen werden */
let token = 0;
let listing: AnnotationListing | null = null;
let types: AnnotationType[] = [];
let selected = new Set<string>();
let listError: string | null = null;
let reading = false;

/** Einstellungen für den Worker; null, solange nichts zu entfernen gewählt ist */
function options(): AnnotationOptions | null {
  if (!listing || selected.size === 0) return null;
  return { types: [...selected] };
}

const tool = mountPdfTool<AnnotationOptions>({
  prefix: 'kom',
  worker,
  busyLabel: 'Wird gespeichert …',
  options,
  suffix: '-ohne-anmerkungen',
  done: () => 'Fertig: Die neue PDF ist gespeichert. Deine Originaldatei bleibt unverändert.',
  onFile: (pages) => {
    if (pages === null) reset();
    else void startListing();
  },
});

function reset(): void {
  token++;
  listing = null;
  types = [];
  selected = new Set();
  listError = null;
  reading = false;
  typeBox.replaceChildren();
  tableBody.replaceChildren();
  renderPanel();
}

function rowFor(page: number, label: string, text: string | null): HTMLTableRowElement {
  const tr = document.createElement('tr');
  const pageCell = document.createElement('th');
  pageCell.scope = 'row';
  pageCell.textContent = String(page);
  const kindCell = document.createElement('td');
  kindCell.textContent = label;
  const textCell = document.createElement('td');
  if (text === null) {
    textCell.textContent = 'Kein Text';
  } else {
    textCell.textContent = text;
  }
  tr.append(pageCell, kindCell, textCell);
  return tr;
}

/** Eine Auswahlzeile je Art; die Häkchen werden nur hier gebaut, nicht bei jedem Klick neu. */
function buildTypeBoxes(): void {
  typeBox.replaceChildren(
    ...types.map((type) => {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.value = type.subtype;
      input.checked = selected.has(type.subtype);
      label.append(input, ` ${type.label} (${type.count})`);
      return label;
    }),
  );
}

function renderPanel(): void {
  const hasListing = listing !== null;
  loading.hidden = !reading;
  errorLine.hidden = listError === null;
  errorLine.textContent = listError ?? '';
  none.hidden = !(hasListing && listing?.items.length === 0);
  tableWrap.hidden = !(hasListing && (listing?.items.length ?? 0) > 0);
  choose.hidden = !(hasListing && types.length > 0);

  const removing = types.filter((t) => selected.has(t.subtype));
  const removeCount = removing.reduce((sum, t) => sum + t.count, 0);
  const total = listing?.items.length ?? 0;
  countNow.textContent = String(removeCount);
  keptNow.textContent = String(total - removeCount);

  const forms = listing?.formFields ?? 0;
  formsNote.hidden = forms === 0;
  formsNote.textContent =
    forms === 0
      ? ''
      : `${count(forms, 'Formularfeld bleibt', 'Formularfelder bleiben')} erhalten. Formularfelder gehören zum Formular und werden nicht entfernt.`;
}

function renderListing(result: AnnotationListing): void {
  listing = result;
  types = summarizeTypes(result.items);
  selected = defaultSelection(types);
  tableBody.replaceChildren(
    ...result.items.map((item) => rowFor(item.page, item.label, item.text)),
  );
  buildTypeBoxes();
}

async function startListing(): Promise<void> {
  const file = pendingFile;
  if (!file) return;
  const current = ++token;
  listing = null;
  types = [];
  selected = new Set();
  listError = null;
  reading = true;
  typeBox.replaceChildren();
  tableBody.replaceChildren();
  renderPanel();
  tool.render();
  try {
    const result = await listClient.request<AnnotationListing>({ type: 'list', file });
    if (current !== token) return;
    renderListing(result);
  } catch (error) {
    if (current !== token) return;
    listError = messageFor(error);
  }
  reading = false;
  renderPanel();
  tool.render();
}

/** Nimmt die erste PDF aus der Auswahl; die Liste wird gelesen, sobald der Worker die Seitenzahl meldet. */
export function openFiles(files: File[]): void {
  const [file] = files.filter(isPdf);
  if (file) pendingFile = file;
  tool.openFiles(files);
}

typeBox.addEventListener('change', (event) => {
  const input = event.target as HTMLInputElement;
  if (input.type !== 'checkbox') return;
  if (input.checked) selected.add(input.value);
  else selected.delete(input.value);
  renderPanel();
  tool.render();
});

renderPanel();
