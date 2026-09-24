/**
 * Werkzeugseite „Fotos verkleinern“. Verkleinern und Metadaten-Prüfung laufen im Worker,
 * sonst (ohne OffscreenCanvas) direkt auf der Seite.
 */

import { isImage } from '../../core/files/classify.ts';
import { formatBytes } from '../../core/format/bytes.ts';
import { outputName, savedPercent, type OutputType } from '../../core/images/resize.ts';
import { $, $$ } from '../../ui/dom.ts';
import { saveBlob } from '../../ui/download.ts';
import { preventAccidentalFileOpen, wireDropzone } from '../../ui/dropzone.ts';
import { countLocalBytes } from '../../ui/local-counter.ts';
import { createWorkerClient, WorkerError } from '../../ui/worker-protocol.ts';
import {
  resizeImage,
  supportsOutputType,
  type ResizeOutput,
  type ResizeSettings,
} from './resize.ts';
import type { ResizeRequest } from './resize.worker.ts';

const MESSAGES: Record<string, string> = {
  'not-image': 'Das ist kein Bild. Unterstützt werden JPEG, PNG und WebP.',
  decode:
    'Dieses Bildformat kann dein Browser nicht öffnen. Speichere das Foto als JPEG und versuch es noch einmal.',
  'too-large': 'Das Foto ist zu groß für deinen Browser. Wähle eine kleinere maximale Breite.',
  encode:
    'Das Foto konnte nicht neu gespeichert werden. Wähle ein anderes Format oder eine andere Breite.',
  'format-unsupported': 'Dein Browser kann dieses Format nicht erzeugen. Wähle JPEG.',
  metadata:
    'In der fertigen Datei wurden noch Metadaten gefunden. Das Foto wird deshalb nicht angeboten.',
  'worker-failed': 'Das Werkzeug konnte nicht starten. Lade die Seite neu.',
};
const FALLBACK =
  'Das Foto konnte nicht verarbeitet werden. Lade die Seite neu und versuch es noch einmal.';

const messageFor = (error: unknown): string =>
  (error instanceof WorkerError ? MESSAGES[error.code] : undefined) ?? FALLBACK;

// Mit OffscreenCanvas im Worker, damit die Seite nicht einfriert; der Worker startet sofort
// (plan.md N4). Sonst Rückfall auf den Haupt-Thread.
const worker =
  typeof OffscreenCanvas === 'undefined'
    ? null
    : new Worker(new URL('./resize.worker.ts', import.meta.url), { type: 'module' });
const client = worker ? createWorkerClient<ResizeRequest>(worker) : null;

const resize = (file: File, settings: ResizeSettings): Promise<ResizeOutput> =>
  client
    ? client.request<ResizeOutput>({ type: 'resize', file, settings })
    : resizeImage(file, settings);
const supports = (outputType: OutputType): Promise<boolean> =>
  client
    ? client.request<boolean>({ type: 'supports', outputType })
    : supportsOutputType(outputType);

type Item =
  | { state: 'pending'; name: string }
  | { state: 'error'; name: string; error: string }
  | { state: 'done'; name: string; outName: string; inSize: number; blob: Blob; url: string };

const grid = $('#img-list');
const widthSelect = $<HTMLSelectElement>('#img-width');
const quality = $<HTMLInputElement>('#img-quality');
const formatButtons = $$<HTMLButtonElement>('.seg button[data-format]');
const clearButton = $<HTMLButtonElement>('#img-clear');

let items: Item[] = [];
let outputType: OutputType = 'image/jpeg';
let queue = Promise.resolve();
/** Wird beim Leeren erhöht, damit noch laufende Ergebnisse die neue Liste nicht füllen. */
let generation = 0;

function tile(item: Item, index: number): HTMLElement {
  const el = document.createElement('div');
  el.className = 'img-tile';

  if (item.state === 'error') {
    const box = document.createElement('div');
    box.className = 'err-tile';
    const name = document.createElement('b');
    name.textContent = item.name;
    box.append(name, document.createElement('br'), item.error);
    el.append(box);
    return el;
  }

  const body = document.createElement('div');
  body.className = 'body';
  const name = document.createElement('span');
  name.className = 'nm';
  const size = document.createElement('span');
  size.className = 'sz';

  if (item.state === 'pending') {
    const thumb = document.createElement('div');
    thumb.className = 'thumb';
    name.textContent = item.name;
    size.textContent = 'Wird verkleinert …';
    body.append(name, size);
    el.append(thumb, body);
    return el;
  }

  const thumb = document.createElement('img');
  thumb.className = 'thumb';
  thumb.src = item.url;
  thumb.alt = '';
  name.textContent = item.outName;
  const percent = savedPercent(item.inSize, item.blob.size);
  const saving = document.createElement('span');
  if (percent > 0) {
    saving.className = 'saving';
    saving.textContent = `−${percent}\u00a0%`;
  } else {
    saving.textContent = 'nicht kleiner';
  }
  size.append(formatBytes(item.blob.size), ' ', saving);

  const save = document.createElement('button');
  save.type = 'button';
  save.className = 'btn ghost sm';
  save.dataset.index = String(index);
  save.setAttribute('aria-label', `${item.outName} speichern`);
  // Festes Markup ohne Nutzerdaten; der HTML-Parser setzt den SVG-Namensraum selbst.
  save.innerHTML =
    '<svg width="16" height="16" aria-hidden="true"><use href="#i-save" /></svg>Speichern';

  body.append(name, size, save);
  el.append(thumb, body);
  return el;
}

function render(): void {
  grid.replaceChildren(...items.map(tile));
  $('#img-empty').hidden = items.length > 0;
  clearButton.disabled = items.length === 0;
  const saved = items.reduce(
    (sum, item) => (item.state === 'done' ? sum + Math.max(0, item.inSize - item.blob.size) : sum),
    0,
  );
  $('#img-saved').textContent = formatBytes(saved);
}

async function process(
  index: number,
  file: File,
  settings: ResizeSettings,
  forGeneration: number,
): Promise<void> {
  if (forGeneration !== generation) return;
  let result: Item;
  try {
    const { blob } = await resize(file, settings);
    countLocalBytes(file.size);
    result = {
      state: 'done',
      name: file.name,
      outName: outputName(file.name, settings.type),
      inSize: file.size,
      blob,
      url: URL.createObjectURL(blob),
    };
  } catch (error) {
    result = { state: 'error', name: file.name, error: messageFor(error) };
  }
  if (forGeneration !== generation) {
    if (result.state === 'done') URL.revokeObjectURL(result.url);
    return;
  }
  items[index] = result;
  render();
}

export function addFiles(files: File[]): void {
  // Einstellungen gelten für alle ab jetzt hinzugefügten Fotos (Text im Arbeitsbereich).
  const settings: ResizeSettings = {
    maxWidth: Number(widthSelect.value),
    type: outputType,
    quality: Number(quality.value) / 100,
  };
  for (const file of files) {
    const index = items.length;
    if (!isImage(file)) {
      items.push({ state: 'error', name: file.name, error: MESSAGES['not-image'] ?? FALLBACK });
      continue;
    }
    items.push({ state: 'pending', name: file.name });
    const forGeneration = generation;
    queue = queue.then(() => process(index, file, settings, forGeneration));
  }
  render();
}

grid.addEventListener('click', (event) => {
  const button = (event.target as Element).closest<HTMLButtonElement>('button[data-index]');
  const item = items[Number(button?.dataset.index)];
  if (item?.state === 'done') saveBlob(item.outName, item.blob);
});

clearButton.addEventListener('click', () => {
  for (const item of items) if (item.state === 'done') URL.revokeObjectURL(item.url);
  items = [];
  generation += 1;
  render();
});

quality.addEventListener('input', () => {
  $('#img-quality-val').textContent = quality.value;
});

function selectFormat(type: OutputType): void {
  outputType = type;
  for (const b of formatButtons) b.setAttribute('aria-pressed', String(b.dataset.format === type));
}
for (const button of formatButtons) {
  button.addEventListener('click', () => selectFormat(button.dataset.format as OutputType));
}

void supports('image/webp').then((ok) => {
  if (ok) return;
  const webp = formatButtons.find((b) => b.dataset.format === 'image/webp');
  if (webp) webp.disabled = true;
  $('#img-webp-hint').hidden = false;
  selectFormat('image/jpeg');
});

preventAccidentalFileOpen();
wireDropzone($('#img-drop'), $<HTMLInputElement>('#img-input'), addFiles);
render();
