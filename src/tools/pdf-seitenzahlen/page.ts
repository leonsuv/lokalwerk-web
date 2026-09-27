/**
 * Werkzeugseite „Seitenzahlen einfügen“ (plan-phase2.md, Werkzeug 6). pdf-lib läuft im Worker;
 * diese Datei liest die Einstellungen, zeigt Hinweise und speichert das Ergebnis.
 */

import { isPdf } from '../../core/files/classify.ts';
import { formatBytes } from '../../core/format/bytes.ts';
import type { NumberFormat, PageNumberOptions } from '../../core/pdf/stamp.ts';
import type { Anchor } from '../../core/pdf/stamp-geometry.ts';
import { $ } from '../../ui/dom.ts';
import { saveBlob } from '../../ui/download.ts';
import { preventAccidentalFileOpen, wireDropzone } from '../../ui/dropzone.ts';
import { countLocalBytes } from '../../ui/local-counter.ts';
import { showToast } from '../../ui/toast.ts';
import { createWorkerClient, WorkerError } from '../../ui/worker-protocol.ts';
import { workshopLink } from '../../ui/workshop-link.ts';
import type { NumbersRequest, PdfFacts } from './numbers.worker.ts';

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

// Worker sofort starten: lädt pdf-lib, danach geht alles offline (plan.md N4).
const worker = new Worker(new URL('./numbers.worker.ts', import.meta.url), { type: 'module' });
const client = createWorkerClient<NumbersRequest>(worker);

const fileList = $<HTMLUListElement>('#num-file');
const fromInput = $<HTMLInputElement>('#num-from');
const startInput = $<HTMLInputElement>('#num-start');
const errorText = $('#num-error');
const saveButton = $<HTMLButtonElement>('#num-save');
const saveLabel = $('#num-save-label');
const clearButton = $<HTMLButtonElement>('#num-clear');
const idleLabel = saveLabel.textContent ?? '';

type Current =
  | { state: 'checking'; file: File }
  | { state: 'ok'; file: File; facts: PdfFacts }
  | { state: 'error'; file: File; error: string };
let current: Current | null = null;
let busy = false;

function options(): PageNumberOptions | string {
  const pages = current?.state === 'ok' ? current.facts.pages : 0;
  const from = Number(fromInput.value);
  const start = Number(startInput.value);
  if (!Number.isInteger(from) || from < 1 || from > pages) {
    return `„Ab Seite“ muss zwischen 1 und ${pages} liegen.`;
  }
  if (!Number.isInteger(start) || start < 0) return '„Erste Zahl“ muss eine ganze Zahl ab 0 sein.';
  return {
    format: $<HTMLSelectElement>('#num-format').value as NumberFormat,
    anchor: $<HTMLSelectElement>('#num-anchor').value as Anchor,
    fromPage: from,
    startAt: start,
    fontSize: Number($<HTMLSelectElement>('#num-size').value),
    marginMm: Number($<HTMLSelectElement>('#num-margin').value),
  };
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
    const { pages, signed } = entry.facts;
    info.textContent = `${pages} ${pages === 1 ? 'Seite' : 'Seiten'}, ${size}${signed ? ', digital signiert' : ''}`;
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
  $('#num-empty').hidden = current !== null;
  $('#num-signed').hidden = !(current?.state === 'ok' && current.facts.signed);
  const result = current?.state === 'ok' ? options() : null;
  const error = typeof result === 'string' ? result : '';
  errorText.textContent = error;
  fromInput.setAttribute('aria-invalid', String(error.startsWith('„Ab')));
  startInput.setAttribute('aria-invalid', String(error.startsWith('„Erste')));
  if (current?.state === 'ok') fromInput.max = String(current.facts.pages);
  saveButton.disabled = busy || result === null || typeof result === 'string';
  clearButton.disabled = busy || current === null;
}

async function inspect(file: File): Promise<void> {
  current = { state: 'checking', file };
  render();
  try {
    const facts = await client.request<PdfFacts>({ type: 'inspect', file });
    if (current?.file !== file) return;
    current = { state: 'ok', file, facts };
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
  if (files.length > 1) showToast('Es wird eine PDF auf einmal bearbeitet: die erste.');
  void inspect(file);
}

async function save(): Promise<void> {
  const opts = options();
  if (current?.state !== 'ok' || typeof opts === 'string') return;
  const { file } = current;
  busy = true;
  saveLabel.textContent = 'Wird bearbeitet …';
  render();
  try {
    const bytes = await client.request<Uint8Array>({ type: 'number', file, options: opts });
    const base = file.name.replace(/\.pdf$/i, '').trim() || 'dokument';
    saveBlob(
      `${base}-mit-seitenzahlen.pdf`,
      new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }),
    );
    countLocalBytes(file.size);
    showToast('Fertig: Die PDF mit Seitenzahlen ist gespeichert.');
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
  $<HTMLInputElement>('#num-input').focus();
});
for (const id of [
  '#num-from',
  '#num-start',
  '#num-format',
  '#num-anchor',
  '#num-size',
  '#num-margin',
]) {
  $(id).addEventListener('input', render);
  $(id).addEventListener('change', render);
}

preventAccidentalFileOpen();
wireDropzone($('#num-drop'), $<HTMLInputElement>('#num-input'), openFiles);
render();
