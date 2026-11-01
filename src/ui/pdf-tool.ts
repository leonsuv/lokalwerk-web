/**
 * Gemeinsamer Baustein für Werkzeuge, die eine PDF lesen und eine neue PDF (oder mehrere
 * Dateien) ausgeben: Ablagefläche, Dateizeile, Prüfung im Worker, Speichern mit Fortschrittstext
 * und die deutschen Fehlermeldungen. Die Werkzeugseite liefert nur ihre Einstellungen und die
 * Anfrage an den Worker. Elemente werden über das Kürzel gefunden: #<kürzel>-drop, -input,
 * -file, -empty, -save, -save-label, -clear und optional -options (nur mit Datei sichtbar).
 * Nichts wird gespeichert (AGENTS.md Regel 5).
 */

import { isPdf } from '../core/files/classify.ts';
import { formatBytes } from '../core/format/bytes.ts';
import { $ } from './dom.ts';
import { saveBlob } from './download.ts';
import { preventAccidentalFileOpen, wireDropzone } from './dropzone.ts';
import { countLocalBytes } from './local-counter.ts';
import { showToast } from './toast.ts';
import { createWorkerClient, WorkerError } from './worker-protocol.ts';
import { workshopLink } from './workshop-link.ts';

export const PDF_MESSAGES: Record<string, string> = {
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

/** Nachrichten an den Worker (Gegenstück: servePdfTool in ./pdf-worker.ts) */
export type PdfToolRequest<O> =
  { type: 'inspect'; file: File } | { type: 'run'; file: File; options: O };

/** Ergebnis von `run`: eine oder mehrere Dateien */
export interface PdfToolOutput {
  files: { name: string; bytes: Uint8Array }[];
}

export interface PdfToolConfig<O> {
  prefix: string;
  worker: Worker;
  busyLabel: string;
  /** Einstellungen der Seite; null, solange sie unvollständig oder ungültig sind (Knopf aus) */
  options: () => O | null;
  /** Dateiendung vor „.pdf“ im Namen des Ergebnisses, z. B. „-halbiert“ */
  suffix: string;
  done: (output: PdfToolOutput) => string;
  /** Weitere Fehlercodes des Werkzeugs */
  messages?: Record<string, string>;
  /** Nach Auswahl einer PDF (Seitenzahl) oder beim Zurücksetzen (null) */
  onFile?: (pages: number | null) => void;
}

type Current =
  | { state: 'checking'; file: File }
  | { state: 'ok'; file: File; pages: number }
  | { state: 'error'; file: File; error: string };

export interface PdfTool {
  /** Nach einer Änderung der Einstellungen aufrufen, damit der Knopf folgt */
  render: () => void;
  /** Dateien übernehmen, zum Beispiel von der Startseite (src/tools/home/loaders.ts) */
  openFiles: (files: File[]) => void;
}

export function mountPdfTool<O>(config: PdfToolConfig<O>): PdfTool {
  const { prefix: p } = config;
  const client = createWorkerClient<PdfToolRequest<O>>(config.worker);
  const toWorkshop = workshopLink();
  const messages = { ...PDF_MESSAGES, ...config.messages };
  const messageFor = (error: unknown): string =>
    (error instanceof WorkerError ? messages[error.code] : undefined) ?? FALLBACK;

  const fileList = $<HTMLUListElement>(`#${p}-file`);
  const saveButton = $<HTMLButtonElement>(`#${p}-save`);
  const saveLabel = $(`#${p}-save-label`);
  const clearButton = $<HTMLButtonElement>(`#${p}-clear`);
  const idleLabel = saveLabel.textContent ?? '';
  const optionsPanel = document.querySelector<HTMLElement>(`#${p}-options`);

  let current: Current | null = null;
  let busy = false;

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

  function render(): void {
    const ok = current?.state === 'ok' ? current : null;
    toWorkshop(ok ? [ok.file] : null);
    fileList.replaceChildren(...(current ? [fileRow(current)] : []));
    $(`#${p}-empty`).hidden = current !== null;
    if (optionsPanel) optionsPanel.hidden = ok === null;
    saveButton.disabled = busy || ok === null || config.options() === null;
    clearButton.disabled = busy || current === null;
  }

  async function inspect(file: File): Promise<void> {
    current = { state: 'checking', file };
    config.onFile?.(null);
    render();
    try {
      const pages = await client.request<number>({ type: 'inspect', file });
      if (current?.file !== file) return;
      current = { state: 'ok', file, pages };
      config.onFile?.(pages);
    } catch (error) {
      if (current?.file !== file) return;
      current = { state: 'error', file, error: messageFor(error) };
    }
    render();
  }

  function openFiles(files: File[]): void {
    const [file] = files.filter(isPdf);
    if (!file) {
      showToast('Nur PDF-Dateien werden übernommen.');
      return;
    }
    if (files.length > 1) showToast('Es wird eine PDF auf einmal bearbeitet: die erste.');
    void inspect(file);
  }

  async function save(): Promise<void> {
    const options = config.options();
    if (current?.state !== 'ok' || options === null) return;
    const { file } = current;
    busy = true;
    saveLabel.textContent = config.busyLabel;
    render();
    try {
      const output = await client.request<PdfToolOutput>({ type: 'run', file, options });
      const base = file.name.replace(/\.pdf$/i, '').trim() || 'dokument';
      for (const out of output.files) {
        saveBlob(
          out.name === '' ? `${base}${config.suffix}.pdf` : out.name,
          new Blob([out.bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }),
        );
      }
      countLocalBytes(file.size);
      showToast(config.done(output));
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
    config.onFile?.(null);
    render();
    $<HTMLInputElement>(`#${p}-input`).focus();
  });
  preventAccidentalFileOpen();
  wireDropzone($(`#${p}-drop`), $<HTMLInputElement>(`#${p}-input`), openFiles);
  render();
  return { render, openFiles };
}
