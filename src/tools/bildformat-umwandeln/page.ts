/**
 * Werkzeugseite „Bildformat umwandeln“ (plan-phase2.md, Werkzeug 12). Umwandeln und
 * Metadaten-Prüfung laufen im Worker, sonst (ohne OffscreenCanvas) direkt auf der Seite.
 */

import { isImage } from '../../core/files/classify.ts';
import { formatBytes } from '../../core/format/bytes.ts';
import { convertedName, hasQuality, type ImageFormat } from '../../core/images/convert.ts';
import { ZipError } from '../../core/zip/write.ts';
import { $ } from '../../ui/dom.ts';
import { saveBlob } from '../../ui/download.ts';
import { preventAccidentalFileOpen, wireDropzone } from '../../ui/dropzone.ts';
import { countLocalBytes } from '../../ui/local-counter.ts';
import { showToast } from '../../ui/toast.ts';
import { createWorkerClient, WorkerError } from '../../ui/worker-protocol.ts';
import { zipBlobs } from '../../ui/zip.ts';
import { convertImage, supportsFormat, type ConvertSettings } from './convert.ts';
import type { ConvertImageRequest } from './convert.worker.ts';

const MESSAGES: Record<string, string> = {
  'not-image': 'Das ist kein Bild. Unterstützt werden JPEG, PNG, WebP und GIF.',
  decode:
    'Dieses Bildformat kann dein Browser nicht öffnen. Speichere das Bild als JPEG oder PNG und versuch es noch einmal.',
  'too-large': 'Das Bild ist zu groß für deinen Browser. Verkleinere es zuerst.',
  encode: 'Das Bild konnte nicht neu gespeichert werden. Wähle ein anderes Zielformat.',
  'format-unsupported': 'Dein Browser kann dieses Format nicht erzeugen. Wähle JPEG oder PNG.',
  metadata:
    'In der fertigen Datei wurden noch Metadaten gefunden. Das Bild wird deshalb nicht angeboten.',
  'worker-failed': 'Das Werkzeug konnte nicht starten. Lade die Seite neu.',
};
const FALLBACK =
  'Das Bild konnte nicht umgewandelt werden. Lade die Seite neu und versuch es noch einmal.';

const messageFor = (error: unknown): string =>
  (error instanceof WorkerError ? MESSAGES[error.code] : undefined) ?? FALLBACK;

// Mit OffscreenCanvas im Worker, damit die Seite nicht einfriert; der Worker startet sofort
// (plan.md N4). Sonst Rückfall auf den Haupt-Thread.
const worker =
  typeof OffscreenCanvas === 'undefined'
    ? null
    : new Worker(new URL('./convert.worker.ts', import.meta.url), { type: 'module' });
const client = worker ? createWorkerClient<ConvertImageRequest>(worker) : null;

const convert = (file: File, settings: ConvertSettings): Promise<Blob> =>
  client ? client.request<Blob>({ type: 'convert', file, settings }) : convertImage(file, settings);
const supports = (format: ImageFormat): Promise<boolean> =>
  client ? client.request<boolean>({ type: 'supports', format }) : supportsFormat(format);

type Item =
  | { state: 'pending'; name: string }
  | { state: 'error'; name: string; error: string }
  | { state: 'done'; name: string; outName: string; blob: Blob; url: string };

const grid = $('#fmt-list');
const typeSelect = $<HTMLSelectElement>('#fmt-type');
const quality = $<HTMLInputElement>('#fmt-quality');
const zipButton = $<HTMLButtonElement>('#fmt-zip');
const zipLabel = $('#fmt-zip-label');
const clearButton = $<HTMLButtonElement>('#fmt-clear');
const zipIdleLabel = zipLabel.textContent ?? '';

let items: Item[] = [];
let queue = Promise.resolve();
/** Wird beim Leeren erhöht, damit noch laufende Ergebnisse die neue Liste nicht füllen. */
let generation = 0;
let zipping = false;

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
    size.textContent = 'Wird umgewandelt …';
    body.append(name, size);
    el.append(thumb, body);
    return el;
  }
  const thumb = document.createElement('img');
  thumb.className = 'thumb';
  thumb.src = item.url;
  thumb.alt = '';
  name.textContent = item.outName;
  size.textContent = formatBytes(item.blob.size);
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
  $('#fmt-empty').hidden = items.length > 0;
  clearButton.disabled = items.length === 0 || zipping;
  zipButton.disabled = zipping || !items.some((item) => item.state === 'done');
  const type = typeSelect.value as ImageFormat;
  $('#fmt-quality-field').hidden = !hasQuality(type);
  $('#fmt-jpeg-hint').hidden = type !== 'image/jpeg';
}

function settings(): ConvertSettings {
  return { type: typeSelect.value as ImageFormat, quality: Number(quality.value) / 100 };
}

async function process(index: number, file: File, s: ConvertSettings, forGeneration: number) {
  if (forGeneration !== generation) return;
  let result: Item;
  try {
    const blob = await convert(file, s);
    countLocalBytes(file.size);
    result = {
      state: 'done',
      name: file.name,
      outName: convertedName(file.name, s.type),
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
  // Einstellungen gelten für alle ab jetzt hinzugefügten Bilder (Text im Arbeitsbereich).
  const s = settings();
  for (const file of files) {
    const index = items.length;
    if (!isImage(file)) {
      items.push({ state: 'error', name: file.name, error: MESSAGES['not-image'] ?? FALLBACK });
      continue;
    }
    items.push({ state: 'pending', name: file.name });
    const forGeneration = generation;
    queue = queue.then(() => process(index, file, s, forGeneration));
  }
  render();
}

grid.addEventListener('click', (event) => {
  const button = (event.target as Element).closest<HTMLButtonElement>('button[data-index]');
  const item = items[Number(button?.dataset.index)];
  if (item?.state === 'done') saveBlob(item.outName, item.blob);
});

async function saveZip(): Promise<void> {
  const done = items.flatMap((item) =>
    item.state === 'done' ? [{ name: item.outName, blob: item.blob }] : [],
  );
  zipping = true;
  zipLabel.textContent = 'ZIP wird erstellt …';
  render();
  try {
    saveBlob('bilder-umgewandelt.zip', await zipBlobs(done));
    const pending = items.filter((item) => item.state === 'pending').length;
    const saved = `${done.length} ${done.length === 1 ? 'Bild' : 'Bilder'} als ZIP gespeichert.`;
    showToast(
      pending > 0
        ? `${saved} ${pending} ${pending === 1 ? 'wird' : 'werden'} noch umgewandelt und ${pending === 1 ? 'ist' : 'sind'} nicht enthalten.`
        : saved,
    );
  } catch (error) {
    showToast(
      error instanceof ZipError
        ? 'Die ZIP-Datei wäre zu groß. Speichere die Bilder in kleineren Gruppen.'
        : 'Die ZIP-Datei konnte nicht erstellt werden. Lade die Seite neu und versuch es noch einmal.',
    );
  } finally {
    zipping = false;
    zipLabel.textContent = zipIdleLabel;
    render();
  }
}

zipButton.addEventListener('click', () => {
  void saveZip();
});
clearButton.addEventListener('click', () => {
  for (const item of items) if (item.state === 'done') URL.revokeObjectURL(item.url);
  items = [];
  generation += 1;
  render();
});
typeSelect.addEventListener('change', render);
quality.addEventListener('input', () => {
  $('#fmt-quality-val').textContent = quality.value;
});

void supports('image/webp').then((ok) => {
  if (ok) return;
  const webp = [...typeSelect.options].find((o) => o.value === 'image/webp');
  if (webp) webp.disabled = true;
  $('#fmt-webp-hint').hidden = false;
  if (typeSelect.value === 'image/webp') typeSelect.value = 'image/jpeg';
  render();
});

preventAccidentalFileOpen();
wireDropzone($('#fmt-drop'), $<HTMLInputElement>('#fmt-input'), addFiles);
render();
