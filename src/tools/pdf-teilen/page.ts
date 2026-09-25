/**
 * Werkzeugseite „PDF teilen“ (plan-phase2.md, Werkzeug 1). pdf-lib läuft im Worker; diese
 * Datei liest die Einstellungen, zeigt Fehler und speichert eine PDF oder ein ZIP.
 */

import { isPdf } from '../../core/files/classify.ts';
import { formatBytes } from '../../core/format/bytes.ts';
import {
  chunks,
  parsePageRanges,
  rangeLabel,
  singlePages,
  type PageRange,
  type PageRangeError,
} from '../../core/pdf/page-ranges.ts';
import { ZipError } from '../../core/zip/write.ts';
import { $, $$ } from '../../ui/dom.ts';
import { saveBlob } from '../../ui/download.ts';
import { preventAccidentalFileOpen, wireDropzone } from '../../ui/dropzone.ts';
import { countLocalBytes } from '../../ui/local-counter.ts';
import { showToast } from '../../ui/toast.ts';
import { createWorkerClient, WorkerError } from '../../ui/worker-protocol.ts';
import { zipBlobs } from '../../ui/zip.ts';
import type { SplitProgress, SplitRequest } from './split.worker.ts';

const MESSAGES: Record<string, string> = {
  empty: 'Die Datei ist leer.',
  encrypted:
    'Die PDF ist verschlüsselt (Passwort- oder Kopierschutz). Entferne den Schutz und füge sie erneut hinzu.',
  damaged:
    'Die Datei ist beschädigt oder keine gültige PDF. Speichere sie im Ursprungsprogramm erneut als PDF.',
  'no-pages': 'Die PDF enthält keine Seiten.',
  'out-of-memory': 'Nicht genug Arbeitsspeicher. Teile die PDF in weniger Dateien auf einmal.',
  unreadable:
    'Die Datei konnte nicht gelesen werden. Prüfe, ob sie noch am selben Ort liegt, und füge sie erneut hinzu.',
  'worker-failed': 'Das Werkzeug konnte nicht starten. Lade die Seite neu.',
};
const FALLBACK =
  'Die Datei konnte nicht verarbeitet werden. Lade die Seite neu und versuch es noch einmal.';

const messageFor = (error: unknown): string =>
  (error instanceof WorkerError ? MESSAGES[error.code] : undefined) ?? FALLBACK;

function rangeMessage(error: PageRangeError): string {
  switch (error.code) {
    case 'empty':
      return 'Gib an, welche Seiten du brauchst, zum Beispiel 1-3.';
    case 'syntax':
      return `„${error.part}“ ist keine Seitenangabe. Schreib Seiten wie 5 oder Bereiche wie 1-3.`;
    case 'out-of-range':
      return `„${error.part}“ gibt es nicht: Die PDF hat ${error.pages} ${error.pages === 1 ? 'Seite' : 'Seiten'}.`;
    case 'reversed':
      return `Bei „${error.part}“ muss die erste Seite vor der letzten stehen.`;
  }
}

// Worker sofort starten: lädt pdf-lib, danach geht alles offline (plan.md N4).
const worker = new Worker(new URL('./split.worker.ts', import.meta.url), { type: 'module' });
const client = createWorkerClient<SplitRequest>(worker);

const fileList = $<HTMLUListElement>('#split-file');
const modeSelect = $<HTMLSelectElement>('#split-mode');
const pagesInput = $<HTMLInputElement>('#split-pages');
const pagesError = $('#split-pages-error');
const chunkInput = $<HTMLInputElement>('#split-chunk');
const chunkError = $('#split-chunk-error');
const groupButtons = $$<HTMLButtonElement>('button[data-group]');
const saveButton = $<HTMLButtonElement>('#split-save');
const saveLabel = $('#split-save-label');
const clearButton = $<HTMLButtonElement>('#split-clear');

type Current =
  | { state: 'checking'; file: File }
  | { state: 'ok'; file: File; pages: number }
  | { state: 'error'; file: File; error: string };
let current: Current | null = null;
let busy = false;
let eachRange = false;

type Plan = { ok: true; groups: PageRange[][] } | { ok: false; error: string | null };

/** Welche Dateien mit welchen Seiten entstehen, nach den Einstellungen rechts */
function plan(): Plan {
  if (current?.state !== 'ok') return { ok: false, error: null };
  const { pages } = current;
  if (modeSelect.value === 'single')
    return { ok: true, groups: singlePages(pages).map((r) => [r]) };
  if (modeSelect.value === 'chunks') {
    const size = Number(chunkInput.value);
    if (!Number.isInteger(size) || size < 1) {
      return { ok: false, error: 'Gib eine ganze Zahl ab 1 ein.' };
    }
    return { ok: true, groups: chunks(pages, size).map((r) => [r]) };
  }
  const parsed = parsePageRanges(pagesInput.value, pages);
  if (!parsed.ok) {
    // Ein leeres Feld ist noch kein Fehler, nur noch nicht ausgefüllt.
    return { ok: false, error: parsed.error.code === 'empty' ? null : rangeMessage(parsed.error) };
  }
  return { ok: true, groups: eachRange ? parsed.ranges.map((r) => [r]) : [parsed.ranges] };
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
  if (entry.state === 'ok')
    info.textContent = `${entry.pages} ${entry.pages === 1 ? 'Seite' : 'Seiten'}, ${size}`;
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
  $('#split-empty').hidden = current !== null;
  const mode = modeSelect.value;
  $('#split-ranges-fields').hidden = mode !== 'ranges';
  $('#split-chunk-field').hidden = mode !== 'chunks';
  for (const b of groupButtons) {
    b.setAttribute('aria-pressed', String((b.dataset.group === 'each') === eachRange));
  }

  const result = plan();
  const error = result.ok ? '' : (result.error ?? '');
  pagesError.textContent = mode === 'ranges' ? error : '';
  chunkError.textContent = mode === 'chunks' ? error : '';
  pagesInput.setAttribute('aria-invalid', String(mode === 'ranges' && error !== ''));
  chunkInput.setAttribute('aria-invalid', String(mode === 'chunks' && error !== ''));

  $('#split-count').textContent = current?.state === 'ok' ? String(current.pages) : '–';
  const files = result.ok ? result.groups.length : 0;
  $('#split-files').textContent = result.ok ? String(files) : '–';
  if (!busy) {
    saveLabel.textContent = files > 1 ? `${files} PDFs als ZIP speichern` : 'PDF speichern';
  }
  saveButton.disabled = busy || !result.ok;
  clearButton.disabled = busy || current === null;
}

async function inspect(file: File): Promise<void> {
  current = { state: 'checking', file };
  render();
  try {
    const pages = await client.request<number>({ type: 'inspect', file });
    if (current?.file !== file) return;
    current = { state: 'ok', file, pages };
  } catch (error) {
    if (current?.file !== file) return;
    current = { state: 'error', file, error: messageFor(error) };
  }
  render();
}

export function openFiles(files: File[]): void {
  const pdfs = files.filter(isPdf);
  const [file] = pdfs;
  if (!file) {
    showToast('Nur PDF-Dateien werden übernommen.');
    return;
  }
  if (files.length > 1) showToast('Es wird eine PDF auf einmal geteilt: die erste.');
  pagesInput.value = '';
  void inspect(file);
}

const baseName = (name: string) => name.replace(/\.pdf$/i, '').trim() || 'dokument';

function outputName(base: string, ranges: readonly PageRange[]): string {
  const [only] = ranges;
  if (ranges.length === 1 && only) {
    return only.from === only.to
      ? `${base}-seite-${only.from}.pdf`
      : `${base}-seiten-${rangeLabel(only)}.pdf`;
  }
  return `${base}-auszug.pdf`;
}

async function save(): Promise<void> {
  const result = plan();
  if (current?.state !== 'ok' || !result.ok) return;
  const { file } = current;
  busy = true;
  saveLabel.textContent = 'Wird geteilt …';
  render();
  try {
    const outputs = await client.request<Uint8Array[]>(
      { type: 'split', file, groups: result.groups },
      (progress) => {
        const { done, total } = progress as SplitProgress;
        if (total > 1) saveLabel.textContent = `Wird geteilt … (${done} von ${total})`;
      },
    );
    const base = baseName(file.name);
    const named = outputs.map((bytes, i) => ({
      name: outputName(base, result.groups[i] ?? []),
      blob: new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }),
    }));
    const [single] = named;
    if (named.length === 1 && single) {
      saveBlob(single.name, single.blob);
    } else {
      saveLabel.textContent = 'ZIP wird erstellt …';
      saveBlob(`${base}-geteilt.zip`, await zipBlobs(named));
    }
    countLocalBytes(file.size);
    showToast(
      named.length === 1
        ? 'Fertig: Die neue PDF ist gespeichert.'
        : `Fertig: ${named.length} PDFs als ZIP gespeichert.`,
    );
  } catch (error) {
    showToast(
      error instanceof ZipError
        ? 'Die ZIP-Datei wäre zu groß. Teile die PDF in weniger oder größere Teile.'
        : messageFor(error),
    );
  } finally {
    busy = false;
    render();
  }
}

saveButton.addEventListener('click', () => {
  void save();
});
clearButton.addEventListener('click', () => {
  current = null;
  pagesInput.value = '';
  render();
  $<HTMLInputElement>('#split-input').focus();
});
modeSelect.addEventListener('change', render);
pagesInput.addEventListener('input', render);
chunkInput.addEventListener('input', render);
for (const button of groupButtons) {
  button.addEventListener('click', () => {
    eachRange = button.dataset.group === 'each';
    render();
  });
}

preventAccidentalFileOpen();
wireDropzone($('#split-drop'), $<HTMLInputElement>('#split-input'), openFiles);
render();
