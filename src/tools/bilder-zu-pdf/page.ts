/**
 * Werkzeugseite „Bilder zu PDF“ (plan-phase2.md, Werkzeug 3). Bilder vorbereiten und PDF
 * erzeugen laufen im Worker; diese Datei kümmert sich um Liste, Reihenfolge und Meldungen.
 */

import { isImage } from '../../core/files/classify.ts';
import { formatBytes } from '../../core/format/bytes.ts';
import type { PageImage, PageLayout } from '../../core/pdf/from-images.ts';
import { $, $$ } from '../../ui/dom.ts';
import { saveBlob } from '../../ui/download.ts';
import { preventAccidentalFileOpen, wireDropzone } from '../../ui/dropzone.ts';
import { countLocalBytes } from '../../ui/local-counter.ts';
import { showToast } from '../../ui/toast.ts';
import { createWorkerClient, WorkerError } from '../../ui/worker-protocol.ts';
import { workshopLink } from '../../ui/workshop-link.ts';
import type { ImagesProgress, ImagesRequest } from './images.worker.ts';
import { inspectImage, prepareImage, type ImageQuality } from '../../ui/image-prepare.ts';

// Weiter in der PDF-Werkstatt (plan-phase3.md 5.2)
const toWorkshop = workshopLink();

const MESSAGES: Record<string, string> = {
  decode:
    'Dieses Bildformat kann dein Browser nicht öffnen. Speichere das Bild als JPEG und füge es erneut hinzu.',
  encode:
    'Das Bild konnte nicht neu gespeichert werden. Wähle „Kleiner“ und versuch es noch einmal.',
  metadata:
    'In einem vorbereiteten Bild wurden noch Metadaten gefunden. Die PDF wird deshalb nicht erstellt.',
  'out-of-memory':
    'Nicht genug Arbeitsspeicher. Wähle „Kleiner“ oder nimm weniger Bilder auf einmal.',
  damaged:
    'Ein Bild konnte nicht in die PDF übernommen werden. Speichere es als JPEG und füge es erneut hinzu.',
  'worker-failed': 'Das Werkzeug konnte nicht starten. Lade die Seite neu.',
};
const FALLBACK =
  'Die PDF konnte nicht erstellt werden. Lade die Seite neu und versuch es noch einmal.';

const messageFor = (error: unknown): string =>
  (error instanceof WorkerError ? MESSAGES[error.code] : undefined) ?? FALLBACK;

// Worker sofort starten: lädt pdf-lib, danach geht alles offline (plan.md N4).
const worker = new Worker(new URL('./images.worker.ts', import.meta.url), { type: 'module' });
const client = createWorkerClient<ImagesRequest>(worker);
/** Kann der Worker Bilder selbst vorbereiten (OffscreenCanvas)? Sonst macht es die Seite. */
const workerCanvas = client.request<boolean>({ type: 'canvas' }).catch(() => false);

interface Entry {
  id: number;
  file: File;
  state: 'checking' | 'ok' | 'error';
  width: number;
  height: number;
  error: string;
}

const list = $<HTMLUListElement>('#i2p-list');
const layoutSelect = $<HTMLSelectElement>('#i2p-layout');
const marginSelect = $<HTMLSelectElement>('#i2p-margin');
const qualityButtons = $$<HTMLButtonElement>('button[data-quality]');
const saveButton = $<HTMLButtonElement>('#i2p-save');
const saveLabel = $('#i2p-save-label');
const clearButton = $<HTMLButtonElement>('#i2p-clear');
const idleLabel = saveLabel.textContent ?? '';

let entries: Entry[] = [];
let nextId = 1;
let busy = false;
let quality: ImageQuality = 'original';
let inspectQueue = Promise.resolve();

const validEntries = () => entries.filter((e) => e.state === 'ok');
const isJpeg = (file: File) => file.type === 'image/jpeg' || /\.jpe?g$/i.test(file.name);

function actionButton(
  entry: Entry,
  action: string,
  label: string,
  iconName: 'i-up' | 'i-down' | 'i-x',
  disabled: boolean,
): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn icon';
  button.dataset.action = action;
  button.dataset.id = String(entry.id);
  button.disabled = disabled || busy;
  button.setAttribute('aria-label', `${entry.file.name}: ${label}`);
  // Festes Markup ohne Nutzerdaten; der HTML-Parser setzt den SVG-Namensraum selbst.
  button.innerHTML = `<svg width="18" height="18" aria-hidden="true"><use href="#${iconName}" /></svg>`;
  return button;
}

function row(entry: Entry, index: number): HTMLLIElement {
  const li = document.createElement('li');
  const num = document.createElement('span');
  num.className = 'num';
  num.textContent = String(index + 1);
  const meta = document.createElement('div');
  meta.className = 'meta';
  const name = document.createElement('b');
  name.textContent = entry.file.name;
  const info = document.createElement('span');
  const size = formatBytes(entry.file.size);
  if (entry.state === 'checking') info.textContent = `${size}, wird geprüft …`;
  if (entry.state === 'ok') info.textContent = `${entry.width} × ${entry.height} Pixel, ${size}`;
  if (entry.state === 'error') {
    const error = document.createElement('span');
    error.className = 'err';
    error.textContent = entry.error;
    info.append(`${size}, `, error);
  }
  meta.append(name, info);
  li.append(
    num,
    meta,
    actionButton(entry, 'up', 'nach oben', 'i-up', index === 0),
    actionButton(entry, 'down', 'nach unten', 'i-down', index === entries.length - 1),
    actionButton(entry, 'remove', 'entfernen', 'i-x', false),
  );
  return li;
}

function render(): void {
  toWorkshop(validEntries().map((e) => e.file));
  list.replaceChildren(...entries.map(row));
  $('#i2p-empty').hidden = entries.length > 0;
  $('#i2p-count').textContent = String(validEntries().length);
  $('#i2p-size').textContent = formatBytes(validEntries().reduce((s, e) => s + e.file.size, 0));
  for (const b of qualityButtons) {
    b.setAttribute('aria-pressed', String(b.dataset.quality === quality));
  }
  const checking = entries.some((e) => e.state === 'checking');
  saveButton.disabled = busy || checking || validEntries().length === 0;
  clearButton.disabled = busy || entries.length === 0;
}

/** Nach dem Neuzeichnen den Tastaturfokus an derselben Stelle lassen. */
function restoreFocus(id: number, action: string): void {
  const buttons = [...list.querySelectorAll<HTMLButtonElement>(`button[data-id="${id}"]`)];
  const same = buttons.find((b) => b.dataset.action === action && !b.disabled);
  const fallback = buttons.find((b) => !b.disabled);
  (same ?? fallback)?.focus();
}

list.addEventListener('click', (event) => {
  const button = (event.target as Element).closest<HTMLButtonElement>('button[data-action]');
  if (!button || busy) return;
  const id = Number(button.dataset.id);
  const action = button.dataset.action ?? '';
  const i = entries.findIndex((e) => e.id === id);
  if (i < 0) return;
  if (action === 'remove') {
    entries.splice(i, 1);
    render();
    const next = entries[i] ?? entries[i - 1];
    if (next) restoreFocus(next.id, 'remove');
    else $<HTMLInputElement>('#i2p-input').focus();
    return;
  }
  const j = action === 'up' ? i - 1 : i + 1;
  const a = entries[i];
  const b = entries[j];
  if (!a || !b) return;
  entries[i] = b;
  entries[j] = a;
  render();
  restoreFocus(id, action);
});

async function inspect(entry: Entry): Promise<void> {
  try {
    const size = (await workerCanvas)
      ? await client.request<{ width: number; height: number }>({
          type: 'inspect',
          file: entry.file,
        })
      : await inspectImage(entry.file);
    entry.width = size.width;
    entry.height = size.height;
    entry.state = 'ok';
  } catch (error) {
    entry.state = 'error';
    entry.error = messageFor(error);
  }
  render();
}

export function addFiles(files: File[]): void {
  const images = files.filter(isImage);
  if (images.length < files.length) showToast('Nur Bilder werden übernommen.');
  for (const file of images) {
    const entry: Entry = { id: nextId++, file, state: 'checking', width: 0, height: 0, error: '' };
    entries.push(entry);
    inspectQueue = inspectQueue.then(() => inspect(entry));
  }
  render();
}

async function save(): Promise<void> {
  const sources = validEntries();
  busy = true;
  saveLabel.textContent = 'PDF wird erstellt …';
  render();
  const onProgress = (done: number, total: number) => {
    saveLabel.textContent = `Bilder werden vorbereitet … (${done} von ${total})`;
  };
  try {
    let prepared: PageImage[] | null = null;
    if (!(await workerCanvas)) {
      prepared = [];
      for (const entry of sources) {
        prepared.push(await prepareImage(entry.file, isJpeg(entry.file), quality));
        onProgress(prepared.length, sources.length);
      }
    }
    const bytes = await client.request<Uint8Array>(
      {
        type: 'build',
        sources: prepared ?? sources.map((e) => ({ file: e.file, jpeg: isJpeg(e.file) })),
        quality,
        layout: layoutSelect.value as PageLayout,
        marginMm: Number(marginSelect.value),
      },
      (progress) => {
        const { done, total } = progress as ImagesProgress;
        onProgress(done, total);
      },
    );
    countLocalBytes(sources.reduce((sum, e) => sum + e.file.size, 0));
    const [first] = sources;
    const name =
      sources.length === 1 && first
        ? `${first.file.name.replace(/\.[^./\\]+$/, '').trim() || 'bild'}.pdf`
        : 'bilder.pdf';
    saveBlob(name, new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }));
    showToast(
      `Fertig: ${sources.length} ${sources.length === 1 ? 'Seite' : 'Seiten'} in einer PDF, ${formatBytes(bytes.length)}.`,
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
clearButton.addEventListener('click', () => {
  entries = [];
  render();
  $<HTMLInputElement>('#i2p-input').focus();
});
for (const button of qualityButtons) {
  button.addEventListener('click', () => {
    quality = button.dataset.quality === 'small' ? 'small' : 'original';
    render();
  });
}

preventAccidentalFileOpen();
wireDropzone($('#i2p-drop'), $<HTMLInputElement>('#i2p-input'), addFiles);
render();
