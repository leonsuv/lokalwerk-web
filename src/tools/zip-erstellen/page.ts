/**
 * Werkzeugseite „ZIP-Archiv erstellen“. Die Dateien werden nur im Browser gebündelt und nicht
 * gespeichert (AGENTS.md Regel 1 und 5). Archiv ohne Kompression, siehe docs/zip.md.
 */

import { formatBytes } from '../../core/format/bytes.ts';
import { safeEntryPath } from '../../core/zip/paths.ts';
import { ZipError } from '../../core/zip/write.ts';
import { $ } from '../../ui/dom.ts';
import { saveBlob } from '../../ui/download.ts';
import { preventAccidentalFileOpen, wireDropzone } from '../../ui/dropzone.ts';
import { countLocalBytes } from '../../ui/local-counter.ts';
import { showToast } from '../../ui/toast.ts';
import { zipBlobs } from '../../ui/zip.ts';

/** Ab dieser Gesamtgröße warnt die Seite vor dem Arbeitsspeicher */
const WARN_BYTES = 250 * 1024 * 1024;

interface Entry {
  id: number;
  file: File;
  /** Pfad im Archiv, wie er hinzugefügt wurde (bei Ordnern mit Unterordnern) */
  path: string;
}

const list = $<HTMLUListElement>('#zip-list');
const saveButton = $<HTMLButtonElement>('#zip-save');
const saveLabel = $('#zip-save-label');
const clearButton = $<HTMLButtonElement>('#zip-clear');
const idleLabel = saveLabel.textContent ?? '';

const entries: Entry[] = [];
let nextId = 1;
let busy = false;

function row(entry: Entry): HTMLLIElement {
  const li = document.createElement('li');
  const meta = document.createElement('div');
  meta.className = 'meta';
  const name = document.createElement('b');
  name.textContent = safeEntryPath(entry.path);
  const info = document.createElement('span');
  info.textContent = formatBytes(entry.file.size);
  meta.append(name, info);
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'btn icon';
  remove.dataset.id = String(entry.id);
  remove.disabled = busy;
  remove.setAttribute('aria-label', `${entry.path}: entfernen`);
  // Festes Markup ohne Nutzerdaten; der HTML-Parser setzt den SVG-Namensraum selbst.
  remove.innerHTML = '<svg width="18" height="18" aria-hidden="true"><use href="#i-x" /></svg>';
  li.append(meta, remove);
  return li;
}

function render(): void {
  list.replaceChildren(...entries.map(row));
  $('#zip-empty').hidden = entries.length > 0;
  const total = entries.reduce((sum, e) => sum + e.file.size, 0);
  $('#zip-count').textContent = String(entries.length);
  $('#zip-size').textContent = formatBytes(total);
  const warn = $('#zip-warn');
  warn.hidden = total < WARN_BYTES;
  warn.textContent =
    'Das Archiv ist groß. Je nach Gerät kann es lange dauern oder am Arbeitsspeicher scheitern.';
  saveButton.disabled = busy || entries.length === 0;
  clearButton.disabled = busy || entries.length === 0;
}

/** Ein abgelegter Ordner erscheint als leere Datei ohne Endung; Ordner gehen nur über die Auswahl */
function looksLikeDroppedFolder(file: File): boolean {
  return (
    file.size === 0 && file.type === '' && !file.name.includes('.') && !file.webkitRelativePath
  );
}

function add(files: File[]): void {
  let folders = 0;
  for (const file of files) {
    if (looksLikeDroppedFolder(file)) {
      folders++;
      continue;
    }
    entries.push({ id: nextId++, file, path: file.webkitRelativePath || file.name });
  }
  if (folders > 0) {
    showToast(
      `${folders === 1 ? 'Ein Ordner' : `${folders} Ordner`} per Ziehen wird nicht übernommen. Wähle ihn mit „Ordner hinzufügen“.`,
    );
  }
  render();
}

function archiveName(): string {
  const raw = $<HTMLInputElement>('#zip-name').value.replace(/\.zip$/i, '');
  // Als Dateiname, nicht als Pfad
  const clean = safeEntryPath(raw).replace(/\//g, '_').trim();
  return `${clean || 'dateien'}.zip`;
}

async function save(): Promise<void> {
  if (entries.length === 0) return;
  busy = true;
  saveLabel.textContent = 'Archiv wird erstellt …';
  render();
  try {
    const blob = await zipBlobs(
      entries.map((e) => ({ name: e.path, blob: e.file })),
      { keepFolders: true },
    );
    saveBlob(archiveName(), blob);
    countLocalBytes(entries.reduce((sum, e) => sum + e.file.size, 0));
    showToast(
      `Fertig: ${entries.length} ${entries.length === 1 ? 'Datei' : 'Dateien'} als ZIP gespeichert.`,
    );
  } catch (error) {
    showToast(
      error instanceof ZipError
        ? 'Das Archiv wäre zu groß oder hätte zu viele Dateien. Teile die Dateien auf mehrere Archive auf.'
        : 'Das Archiv konnte nicht erstellt werden. Lade die Seite neu und versuch es mit weniger Dateien noch einmal.',
    );
  } finally {
    busy = false;
    saveLabel.textContent = idleLabel;
    render();
  }
}

list.addEventListener('click', (event) => {
  const button = (event.target as Element).closest<HTMLButtonElement>('button[data-id]');
  if (!button || busy) return;
  const index = entries.findIndex((e) => String(e.id) === button.dataset.id);
  if (index >= 0) entries.splice(index, 1);
  render();
});
saveButton.addEventListener('click', () => {
  void save();
});
clearButton.addEventListener('click', () => {
  entries.length = 0;
  render();
  $<HTMLInputElement>('#zip-input').focus();
});
$<HTMLInputElement>('#zip-folder').addEventListener('change', (event) => {
  const input = event.target as HTMLInputElement;
  const files = [...(input.files ?? [])];
  input.value = '';
  add(files);
});

preventAccidentalFileOpen();
wireDropzone($('#zip-drop'), $<HTMLInputElement>('#zip-input'), add);
render();
