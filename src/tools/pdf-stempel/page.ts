/**
 * Werkzeugseite „Stempel und Wasserzeichen“ (plan-phase2.md, Werkzeug 7). pdf-lib läuft im
 * Worker; diese Datei prüft die Eingaben (auch den Zeichensatz, E8a) und speichert das Ergebnis.
 */

import { isPdf } from '../../core/files/classify.ts';
import { formatBytes } from '../../core/format/bytes.ts';
import { parsePageRanges, type PageRange } from '../../core/pdf/page-ranges.ts';
import type { StampColor, StampOptions, StampPlacement } from '../../core/pdf/stamp.ts';
import { unsupportedChars } from '../../core/pdf/winansi.ts';
import { $ } from '../../ui/dom.ts';
import { saveBlob } from '../../ui/download.ts';
import { preventAccidentalFileOpen, wireDropzone } from '../../ui/dropzone.ts';
import { countLocalBytes } from '../../ui/local-counter.ts';
import { showToast } from '../../ui/toast.ts';
import { createWorkerClient, WorkerError } from '../../ui/worker-protocol.ts';
import type { PdfFacts, StampRequest } from './stamp.worker.ts';

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
const worker = new Worker(new URL('./stamp.worker.ts', import.meta.url), { type: 'module' });
const client = createWorkerClient<StampRequest>(worker);

const fileList = $<HTMLUListElement>('#stamp-file');
const textInput = $<HTMLInputElement>('#stamp-text');
const pagesInput = $<HTMLInputElement>('#stamp-pages');
const opacity = $<HTMLInputElement>('#stamp-opacity');
const saveButton = $<HTMLButtonElement>('#stamp-save');
const saveLabel = $('#stamp-save-label');
const clearButton = $<HTMLButtonElement>('#stamp-clear');
const idleLabel = saveLabel.textContent ?? '';

type Current =
  | { state: 'checking'; file: File }
  | { state: 'ok'; file: File; facts: PdfFacts }
  | { state: 'error'; file: File; error: string };
let current: Current | null = null;
let busy = false;
let charset: Set<number> | null = null;

const quoted = (chars: string[]) => chars.map((c) => `„${c}“`).join(', ');

function textError(): string {
  const text = textInput.value;
  if (text.trim() === '') return 'Gib den Text für den Stempel ein.';
  if (!charset) return '';
  const missing = unsupportedChars(text, charset);
  if (missing.length === 0) return '';
  return `Diese Zeichen kann die PDF-Schrift nicht darstellen: ${quoted(missing)}. Ersetze sie, zum Beispiel Ł durch L.`;
}

function pagesResult(): { ranges: PageRange[] } | { error: string } {
  if (current?.state !== 'ok' || pagesInput.value.trim() === '') return { ranges: [] };
  const parsed = parsePageRanges(pagesInput.value, current.facts.pages);
  if (parsed.ok) return { ranges: parsed.ranges };
  const e = parsed.error;
  const pages = current.facts.pages;
  switch (e.code) {
    case 'syntax':
      return {
        error: `„${e.part}“ ist keine Seitenangabe. Schreib Seiten wie 5 oder Bereiche wie 1-3.`,
      };
    case 'out-of-range':
      return {
        error: `„${e.part}“ gibt es nicht: Die PDF hat ${pages} ${pages === 1 ? 'Seite' : 'Seiten'}.`,
      };
    case 'reversed':
      return { error: `Bei „${e.part}“ muss die erste Seite vor der letzten stehen.` };
    default:
      return { ranges: [] };
  }
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
  fileList.replaceChildren(...(current ? [fileRow(current)] : []));
  $('#stamp-empty').hidden = current !== null;
  $('#stamp-signed').hidden = !(current?.state === 'ok' && current.facts.signed);
  $('#stamp-opacity-val').textContent = opacity.value;
  const tError = textError();
  $('#stamp-text-error').textContent = tError;
  textInput.setAttribute('aria-invalid', String(tError !== ''));
  const pages = pagesResult();
  const pError = 'error' in pages ? pages.error : '';
  $('#stamp-pages-error').textContent = pError;
  pagesInput.setAttribute('aria-invalid', String(pError !== ''));
  saveButton.disabled =
    busy || current?.state !== 'ok' || charset === null || tError !== '' || pError !== '';
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
  const pages = pagesResult();
  if (current?.state !== 'ok' || 'error' in pages || textError() !== '') return;
  const { file } = current;
  const options: StampOptions = {
    text: textInput.value.trim(),
    placement: $<HTMLSelectElement>('#stamp-placement').value as StampPlacement,
    color: $<HTMLSelectElement>('#stamp-color').value as StampColor,
    opacity: Number(opacity.value) / 100,
    pages: pages.ranges,
  };
  busy = true;
  saveLabel.textContent = 'Wird gestempelt …';
  render();
  try {
    const bytes = await client.request<Uint8Array>({ type: 'stamp', file, options });
    const base = file.name.replace(/\.pdf$/i, '').trim() || 'dokument';
    saveBlob(
      `${base}-gestempelt.pdf`,
      new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }),
    );
    countLocalBytes(file.size);
    showToast('Fertig: Die gestempelte PDF ist gespeichert.');
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
  $<HTMLInputElement>('#stamp-input').focus();
});
for (const el of [textInput, pagesInput, opacity]) el.addEventListener('input', render);

client.request<number[]>({ type: 'charset' }).then(
  (codes) => {
    charset = new Set(codes);
    render();
  },
  () => showToast(MESSAGES['worker-failed'] ?? FALLBACK),
);

preventAccidentalFileOpen();
wireDropzone($('#stamp-drop'), $<HTMLInputElement>('#stamp-input'), openFiles);
render();
