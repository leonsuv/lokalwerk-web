/**
 * Werkzeugseite „PDF-Werkstatt“ (plan-phase3.md). Zustand und Befehle: src/core/workshop/ und
 * store.ts; Aktionen: actions.ts; Spalten: board.ts; Vorschaubilder mit pdf.js: thumbs.ts;
 * Tastatur: keyboard.ts; Menüs und Dialoge: menu.ts, dialogs.ts; Lesen und Export mit pdf-lib
 * im Worker: workshop.worker.ts.
 */

import { isImage, isPdf } from '../../core/files/classify.ts';
import { imagePageBox } from '../../core/workshop/export-plan.ts';
import { addSources, renameDoc } from '../../core/workshop/commands.ts';
import {
  allPages,
  indexPages,
  MEMORY_HINT_BYTES,
  NO_FACTS,
  totalSourceSize,
  type DocId,
  type PagePick,
  type Source,
  type SourceId,
} from '../../core/workshop/model.ts';
import {
  moveFocus,
  selectionSummary,
  selectOnly,
  selectRange,
  toggle,
} from '../../core/workshop/selection.ts';
import { $ } from '../../ui/dom.ts';
import { preventAccidentalFileOpen, wireDropzone } from '../../ui/dropzone.ts';
import { prepareImage } from '../../ui/image-prepare.ts';
import { showToast } from '../../ui/toast.ts';
import { createWorkerClient, WorkerError } from '../../ui/worker-protocol.ts';
import { createActions } from './actions.ts';
import { Board, SourceBadges } from './board.ts';
import { MergeDialog, MoveDialog, ShortcutsDialog } from './dialogs.ts';
import { setupDrag } from './drag.ts';
import { currentDoc, Exporter, lossSources } from './export.ts';
import { handleAreaKey, handleBoardKey } from './keyboard.ts';
import { Menu, type MenuItem } from './menu.ts';
import { setupMobile } from './mobile.ts';
import { Preview } from './preview.ts';
import { SourceFiles } from './sources.ts';
import { WorkshopStore } from './store.ts';
import * as t from './texts.ts';
import { Thumbs } from './thumbs.ts';
import type { AddImageResult, AddPdfResult, WorkshopRequest } from './workshop.worker.ts';

// Beides sofort laden: pdf-lib im Worker, pdf.js samt eigenem Worker (plan.md N4, offline).
const worker = new Worker(new URL('./workshop.worker.ts', import.meta.url), { type: 'module' });
const client = createWorkerClient<WorkshopRequest>(worker);
const pdfjs = import('../../ui/pdfjs/pdfjs.ts');

const messageFor = (error: unknown): string =>
  (error instanceof WorkerError ? t.ERRORS[error.code] : undefined) ?? t.FALLBACK_ERROR;

const files = new SourceFiles(pdfjs);
const store = new WorkshopStore((ids) => {
  files.release(ids);
  void client.request({ type: 'release', ids }).catch(() => undefined);
});
const thumbs = new Thumbs(files, pdfjs);
const boardEl = $('#ws-board');
const board = new Board(boardEl, thumbs, new SourceBadges());
const input = $<HTMLInputElement>('#ws-input');
const status = $('#ws-status');
const live = $('#ws-live');
const menu = new Menu($('#ws-menu'));
const shortcutsDialog = new ShortcutsDialog();

// ---------------------------------------------------------------------------------------------
// Ansagen und Fokus

let announceFrame = 0;
function announce(message: string): void {
  // Erst leeren, damit auch eine wiederholte gleiche Ansage erneut vorgelesen wird.
  live.textContent = '';
  cancelAnimationFrame(announceFrame);
  announceFrame = requestAnimationFrame(() => (live.textContent = message));
}

function announceSelection(): void {
  const { pages, docs } = selectionSummary(store.state, store.selection);
  announce(t.selected(pages, docs));
}

/** Nach dem nächsten Zeichnen: Fokus auf die Seite mit dem Fokus, sonst auf die Spalte */
let pendingFocus: { doc: DocId | undefined } | null = null;

function focusDocName(doc: DocId): void {
  const name = board.column(doc)?.name;
  if (!name) return;
  name.focus();
  name.select();
}

const actions = createActions({
  store,
  announce,
  focusAfterRender: (doc) => {
    pendingFocus = { doc };
    // Befehle ohne Änderung zeichnen nicht neu: dann gleich
    queueMicrotask(applyFocus);
  },
  focusDocName,
  openFilePicker: () => input.click(),
  openMoveDialog: (keys) => moveDialog.open(store.state, keys),
  openShortcuts: () => shortcutsDialog.open(),
});

const moveDialog = new MoveDialog((keys, choice) => actions.moveTo(keys, choice.doc, choice.index));
const mergeDialog = new MergeDialog((docs) => actions.merge(docs));
const preview = new Preview(store, files, pdfjs, {
  rotate: (key) => actions.rotateOne(key, 90),
  shift: (key, delta) => actions.shiftOne(key, delta),
  closed: (key) => {
    store.select(moveFocus(store.selection, key));
    pendingFocus = { doc: undefined };
    applyFocus();
  },
});

function openPreview(key = store.selection.focus): void {
  if (key) preview.show(key);
}

const exporter = new Exporter(store, client, {
  status: (text) => (status.textContent = text),
  busy: () => render(),
  done: (message) => {
    showToast(message);
    announce(message);
  },
  failed: (error) => showToast(messageFor(error)),
});

function applyFocus(): void {
  if (!pendingFocus) return;
  const { doc } = pendingFocus;
  pendingFocus = null;
  const key = store.selection.focus;
  if (key && board.focusTile(key)) return;
  const fallback = doc ?? store.state.docs[0]?.id;
  const column = fallback ? board.column(fallback) : undefined;
  const first = fallback ? store.state.docs.find((d) => d.id === fallback)?.pages[0] : undefined;
  if (first) {
    store.select(moveFocus(store.selection, first.key));
    board.focusTile(first.key);
  } else {
    column?.list.focus();
  }
}

// ---------------------------------------------------------------------------------------------
// Zeichnen

const toolbar = $('#ws-toolbar');
const phone = window.matchMedia('(max-width: 640px)');

// Handy-Ansicht (W10); „Mehr“ enthält, was nicht in die untere Leiste passt
const mobile = setupMobile({
  store,
  actions,
  board: boardEl,
  menu,
  phone,
  openPreview: (key) => openPreview(key),
  announceSelection,
  moreItems: () => [
    { id: 'undo', label: 'Rückgängig', disabled: !store.canUndo },
    { id: 'redo', label: 'Wiederholen', disabled: !store.canRedo },
    {
      id: 'duplicate',
      label: 'Duplizieren',
      disabled: store.selection.keys.size === 0,
      separator: true,
    },
    { id: 'extract', label: 'Als neues Dokument', disabled: store.selection.keys.size === 0 },
    { id: 'blank-end', label: 'Leere Seite am Ende' },
    { id: 'new-doc', label: 'Neues Dokument', separator: true },
    { id: 'merge', label: 'Dokumente zusammenführen …', disabled: store.state.docs.length < 2 },
  ],
  runMore: (id) => {
    const choices: Record<string, () => void> = {
      undo: actions.undo,
      redo: actions.redo,
      duplicate: actions.duplicate,
      extract: actions.extract,
      'blank-end': () => actions.insertBlank('neighbour', mobile.activeDoc() ?? undefined),
      'new-doc': actions.newDoc,
      merge: () => mergeDialog.open(store.state),
    };
    choices[id]?.();
  },
});
$('#ws-m-add').addEventListener('click', () => actions.addFiles());

function render(): void {
  // Eine Kachel, die beim Umsortieren kurz aus dem Dokument genommen wird, verliert den Fokus.
  const hadFocus = boardEl.contains(document.activeElement);
  const { state, selection } = store;
  board.render(state, selection);
  if (hadFocus && !boardEl.contains(document.activeElement) && !pendingFocus) {
    pendingFocus = { doc: undefined };
  }
  applyFocus();

  const hasDocs = state.docs.length > 0;
  $('#ws-drop').hidden = hasDocs;
  const pageCount = state.docs.reduce((n, d) => n + d.pages.length, 0);
  $('#ws-docs').textContent = hasDocs ? String(state.docs.length) : '–';
  $('#ws-pages').textContent = hasDocs ? String(pageCount) : '–';
  const summary = selectionSummary(state, selection);
  $('#ws-selected').textContent =
    summary.pages > 0 ? t.moveSubtitle(summary.pages, summary.docs) : '–';
  const size = totalSourceSize(state.sources.values());
  $('#ws-memory').hidden = size < MEMORY_HINT_BYTES;
  if (size >= MEMORY_HINT_BYTES) $('#ws-memory-text').textContent = t.memoryHint(size);

  const focusAt = selection.focus ? indexPages(state).get(selection.focus) : undefined;
  const enabled: Record<string, boolean> = {
    pages: actions.targets().length > 0,
    focus: focusAt !== undefined,
    split: focusAt !== undefined && focusAt.pageIndex > 0,
    docs: hasDocs,
    docs2: state.docs.length > 1,
    undo: store.canUndo,
    redo: store.canRedo,
  };
  for (const button of toolbar.querySelectorAll<HTMLButtonElement>('button[data-needs]')) {
    button.disabled = !enabled[button.dataset.needs ?? ''];
  }

  // Export (rechte Spalte)
  const doc = currentDoc(state, selection);
  $('#ws-export-doc-label').textContent = t.exportDocLabel(doc?.name ?? 'Dokument');
  $<HTMLButtonElement>('#ws-export-doc').disabled = exporter.busy || !doc;
  $<HTMLButtonElement>('#ws-export-sel').disabled = exporter.busy || summary.pages === 0;
  $<HTMLButtonElement>('#ws-export-zip').disabled = exporter.busy || pageCount === 0;
  const loss = lossSources(state, state.docs);
  $('#ws-loss').hidden = loss.length === 0;
  if (loss.length > 0) $('#ws-loss-text').textContent = t.lossNote(loss);
  preview.refresh();
  mobile.render();
}

store.subscribe(render);

// ---------------------------------------------------------------------------------------------
// Dateien

let loadingCount = 0;

/**
 * Dateien öffnen: ohne Ziel jede PDF als eigenes Dokument, mit Ziel an dieser Stelle im
 * Dokument. Alle Dateien einer Ablage bilden einen Schritt im Verlauf. `layouts` gibt je Datei
 * die Seitenfolge vor (Übergabe aus „PDF-Seiten bearbeiten“).
 */
async function addFiles(
  list: File[],
  target?: { doc: DocId; index: number },
  layouts?: ReadonlyMap<File, readonly PagePick[]>,
): Promise<void> {
  const accepted = list.filter((f) => isPdf(f) || isImage(f));
  const other = list.filter((f) => !isPdf(f) && !isImage(f)).map((f) => f.name);
  if (other.length > 0) showToast(t.NOT_SUPPORTED(other));
  if (accepted.length === 0) return;
  loadingCount++;
  const added: Source[] = [];
  const sourceLayouts = new Map<SourceId, readonly PagePick[]>();
  const failed: string[] = [];
  for (const [i, file] of accepted.entries()) {
    status.textContent = t.loading(i + 1, accepted.length);
    const id = store.ids('s');
    try {
      if (isPdf(file)) {
        const info = await client.request<AddPdfResult>({ type: 'add-pdf', id, file });
        added.push({ id, kind: 'pdf', name: file.name, size: file.size, ...info });
      } else {
        const size = await addImage(id, file);
        const box = imagePageBox(size.width, size.height);
        added.push({
          id,
          kind: 'image',
          name: file.name,
          size: file.size,
          pages: [{ box, rotate: 0 }],
          facts: NO_FACTS,
        });
      }
      files.add(id, file);
      const layout = layouts?.get(file);
      if (layout) sourceLayouts.set(id, layout);
    } catch (error) {
      failed.push(t.fileError(file.name, messageFor(error)));
    }
  }
  loadingCount--;
  if (loadingCount === 0) status.textContent = '';
  for (const message of failed) showToast(message);
  if (added.length === 0) return;
  const result = store.run(addSources(added, target, sourceLayouts));
  // Die Quellen sind neu: Jede Seite, die auf sie verweist, ist gerade hinzugekommen.
  const addedIds = new Set(added.map((s) => s.id));
  let pageCount = 0;
  for (const { page } of allPages(store.state)) {
    if (page.kind === 'source' && addedIds.has(page.source)) pageCount++;
  }
  if (result.doc) mobile.showDoc(result.doc);
  const targetDoc = target ? store.state.docs.find((d) => d.id === target.doc) : undefined;
  announce(targetDoc ? t.addedInto(pageCount, targetDoc.name) : t.added(added.length, pageCount));
}

/** Kann der Worker Bilder neu kodieren (OffscreenCanvas)? Sonst geschieht das auf der Seite. */
const workerCanvas = client.request<boolean>({ type: 'canvas' }).catch(() => false);

async function addImage(id: string, file: File): Promise<AddImageResult> {
  const jpeg = file.type === 'image/jpeg' || /\.jpe?g$/i.test(file.name);
  if (await workerCanvas)
    return client.request<AddImageResult>({ type: 'add-image', id, file, jpeg });
  const image = await prepareImage(file, jpeg, 'original');
  return client.request<AddImageResult>({ type: 'add-image', id, image });
}

/** Übergabe aus Startseite und Einzelwerkzeugen (tool-switch.ts, workshop-switch.ts) */
export function openFiles(list: File[], layouts?: ReadonlyMap<File, readonly PagePick[]>): void {
  void addFiles(list, undefined, layouts);
}

// ---------------------------------------------------------------------------------------------
// Werkzeugleiste

toolbar.addEventListener('click', (event) => {
  const button = (event.target as Element).closest<HTMLButtonElement>('button[data-cmd]');
  if (!button || button.disabled) return;
  const commands: Record<string, () => void> = {
    add: actions.addFiles,
    'new-doc': actions.newDoc,
    'rotate-left': () => actions.rotate(-90),
    'rotate-right': () => actions.rotate(90),
    duplicate: actions.duplicate,
    blank: () => openBlankMenu(button, button),
    delete: actions.remove,
    split: actions.split,
    merge: () => mergeDialog.open(store.state),
    undo: actions.undo,
    redo: actions.redo,
    preview: () => openPreview(),
    shortcuts: actions.shortcuts,
  };
  commands[button.dataset.cmd ?? '']?.();
});

/** Größe der leeren Seite wählen (W14): wie die Nachbarseite, DIN A4 hoch oder quer */
function openBlankMenu(anchor: HTMLElement, returnFocus: HTMLElement, opener?: HTMLElement): void {
  const target = actions.blankTarget();
  if (!target) return;
  const rect = anchor.getBoundingClientRect();
  menu.show(
    [
      {
        id: 'neighbour',
        label: t.blankLikeNeighbour(target.neighbour.width, target.neighbour.height),
      },
      { id: 'a4', label: t.BLANK_A4_PORTRAIT },
      { id: 'a4-landscape', label: t.BLANK_A4_LANDSCAPE },
    ],
    { x: rect.left, y: rect.bottom + 4 },
    {
      label: 'Leere Seite',
      returnFocus,
      opener: opener ?? anchor,
      onChoose: (id) => actions.insertBlank(id as 'neighbour' | 'a4' | 'a4-landscape'),
    },
  );
}

// Export
$('#ws-export-doc').addEventListener('click', () => {
  const doc = currentDoc(store.state, store.selection);
  if (doc) void exporter.doc(doc.id);
});
$('#ws-export-sel').addEventListener('click', () => void exporter.selection(actions.targets()));
$('#ws-export-zip').addEventListener('click', () => void exporter.all());

// ---------------------------------------------------------------------------------------------
// Spalten: Auswahl mit der Maus, Menüs, Umbenennen

boardEl.addEventListener('click', (event) => {
  const target = event.target as Element;
  const menuButton = target.closest<HTMLButtonElement>('.ws-col-menu');
  if (menuButton?.dataset.doc) {
    const rect = menuButton.getBoundingClientRect();
    openDocMenu(menuButton.dataset.doc, { x: rect.left, y: rect.bottom + 4 }, menuButton);
    return;
  }
  const tile = target.closest<HTMLElement>('.ws-page');
  const key = tile?.dataset.key;
  if (!key) {
    // Klick auf freie Fläche einer Spalte hebt die Auswahl auf
    if (!target.closest('input, button')) actions.clearSelection();
    return;
  }
  const { state, selection } = store;
  const mod = event.ctrlKey || event.metaKey;
  if (event.shiftKey) store.select(selectRange(state, selection, key, mod));
  else if (mod) store.select(toggle(selection, key));
  else store.select(selectOnly(key));
});

boardEl.addEventListener('focusin', (event) => {
  const key = (event.target as HTMLElement).closest<HTMLElement>('.ws-page')?.dataset.key;
  if (key && store.selection.focus !== key) store.select(moveFocus(store.selection, key));
});

boardEl.addEventListener('keydown', (event) =>
  handleBoardKey(event, {
    store,
    actions,
    focusPage: (key) => board.focusTile(key),
    columnsOf: (doc) => board.columnsOf(doc),
    openContextMenu: (_key, anchor) => {
      const rect = anchor.getBoundingClientRect();
      openPageMenu({ x: rect.left + 12, y: rect.top + 24 }, anchor);
    },
    openPreview: (key) => openPreview(key),
    announceSelection,
  }),
);

boardEl.addEventListener('dblclick', (event) => {
  const key = (event.target as Element).closest<HTMLElement>('.ws-page')?.dataset.key;
  if (key) openPreview(key);
});

boardEl.addEventListener('contextmenu', (event) => {
  const tile = (event.target as Element).closest<HTMLElement>('.ws-page');
  const key = tile?.dataset.key;
  if (!tile || !key) return;
  event.preventDefault();
  if (!store.selection.keys.has(key)) store.select(selectOnly(key));
  else store.select(moveFocus(store.selection, key));
  openPageMenu({ x: event.clientX, y: event.clientY }, tile);
});

function pageMenuItems(): MenuItem[] {
  const focus = store.selection.focus
    ? indexPages(store.state).get(store.selection.focus)
    : undefined;
  return [
    { id: 'preview', label: 'Große Vorschau', shortcut: 'Eingabe', keys: 'Enter' },
    { id: 'rotate-right', label: 'Rechts drehen', shortcut: 'R', keys: 'R', separator: true },
    { id: 'rotate-left', label: 'Links drehen', shortcut: t.combo('shift', 'R'), keys: 'Shift+R' },
    { id: 'duplicate', label: 'Duplizieren', shortcut: 'D', keys: 'D' },
    { id: 'move', label: 'Verschieben nach …', shortcut: 'M', keys: 'M' },
    {
      id: 'cut',
      label: 'Ausschneiden',
      shortcut: t.combo('mod', 'X'),
      keys: 'Control+X Meta+X',
      separator: true,
    },
    { id: 'copy', label: 'Kopieren', shortcut: t.combo('mod', 'C'), keys: 'Control+C Meta+C' },
    {
      id: 'paste',
      label: 'Davor einfügen',
      shortcut: t.combo('mod', 'V'),
      keys: 'Control+V Meta+V',
      disabled: !store.clipboard,
    },
    { id: 'blank', label: 'Leere Seite danach …', separator: true },
    { id: 'split', label: 'Dokument hier teilen', disabled: !focus || focus.pageIndex === 0 },
    { id: 'extract', label: 'Als neues Dokument' },
    { id: 'delete', label: 'Löschen', shortcut: 'Entf', keys: 'Delete', separator: true },
  ];
}

function openPageMenu(at: { x: number; y: number }, returnFocus: HTMLElement): void {
  menu.show(pageMenuItems(), at, {
    label: 'Seite',
    returnFocus,
    onChoose: (id) => {
      const choices: Record<string, () => void> = {
        preview: () => openPreview(),
        blank: () => openBlankMenu(returnFocus, returnFocus),
        split: actions.split,
        extract: actions.extract,
        'rotate-right': () => actions.rotate(90),
        'rotate-left': () => actions.rotate(-90),
        duplicate: actions.duplicate,
        move: actions.moveDialog,
        cut: actions.cut,
        copy: actions.copy,
        paste: () => actions.paste(),
        delete: actions.remove,
      };
      choices[id]?.();
    },
  });
}

function openDocMenu(doc: DocId, at: { x: number; y: number }, opener: HTMLElement): void {
  const docs = store.state.docs;
  const position = docs.findIndex((d) => d.id === doc);
  const current = docs[position];
  const nextDoc = docs[position + 1];
  if (!current) return;
  menu.show(
    [
      { id: 'rename', label: 'Umbenennen', shortcut: 'F2', keys: 'F2' },
      {
        id: 'select-all',
        label: 'Alle Seiten auswählen',
        shortcut: t.combo('mod', 'A'),
        keys: 'Control+A Meta+A',
        disabled: current.pages.length === 0,
      },
      { id: 'paste', label: 'Am Anfang einfügen', disabled: !store.clipboard },
      { id: 'append', label: 'Dateien anhängen …' },
      {
        id: 'save',
        label: 'Als PDF speichern',
        disabled: current.pages.length === 0,
        separator: true,
      },
      { id: 'duplicate-doc', label: 'Dokument duplizieren' },
      {
        id: 'merge-next',
        label: 'Mit dem nächsten zusammenführen',
        disabled: nextDoc === undefined,
      },
      { id: 'close-doc', label: 'Dokument schließen', separator: true },
    ],
    at,
    {
      label: t.docMenuLabel(current.name),
      returnFocus: opener,
      opener,
      onChoose: (id) => {
        const choices: Record<string, () => void> = {
          rename: () => actions.renameDoc(doc),
          'select-all': () => actions.selectAll(doc),
          paste: () => {
            store.select({ ...store.selection, focus: null });
            actions.paste(doc);
          },
          append: () => {
            appendTarget = doc;
            input.click();
          },
          save: () => void exporter.doc(doc),
          'merge-next': () => nextDoc && actions.merge([doc, nextDoc.id]),
          'duplicate-doc': () => actions.duplicateDoc(doc),
          'close-doc': () => actions.closeDoc(doc),
        };
        choices[id]?.();
      },
    },
  );
}

// Umbenennen im Spaltenkopf: übernehmen beim Verlassen oder mit Eingabe, Esc stellt zurück
boardEl.addEventListener('change', (event) => {
  const field = event.target as HTMLInputElement;
  const id = field.dataset.doc;
  if (!field.classList.contains('ws-name') || !id) return;
  const before = store.state;
  store.run(renameDoc(id, field.value));
  const doc = store.state.docs.find((d) => d.id === id);
  if (doc && store.state !== before) announce(t.renamed(doc.name));
  // Leerer Name oder ohne Änderung: den gültigen Namen wieder anzeigen
  if (doc) field.value = doc.name;
});
boardEl.addEventListener('keydown', (event) => {
  const field = event.target as HTMLInputElement;
  if (!field.classList.contains('ws-name')) return;
  if (event.key !== 'Enter' && event.key !== 'Escape') return;
  if (event.key === 'Escape') {
    field.value = store.state.docs.find((d) => d.id === field.dataset.doc)?.name ?? field.value;
  }
  event.preventDefault();
  event.stopPropagation();
  // Zurück zu den Seiten: Die Änderung wird beim Verlassen übernommen (change).
  pendingFocus = { doc: field.dataset.doc };
  const focus = store.selection.focus;
  const inDoc = store.state.docs
    .find((d) => d.id === field.dataset.doc)
    ?.pages.some((p) => p.key === focus);
  if (!inDoc) store.select({ ...store.selection, focus: null });
  applyFocus();
});

// Dateien auf eine Spalte ziehen: dort anhängen; auf freie Fläche: neue Dokumente
boardEl.addEventListener('dragover', (event) => {
  if (!event.dataTransfer?.types.includes('Files')) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = 'copy';
});
boardEl.addEventListener('drop', (event) => {
  const dropped = [...(event.dataTransfer?.files ?? [])];
  if (dropped.length === 0) return;
  event.preventDefault();
  const id = (event.target as Element).closest<HTMLElement>('.ws-col')?.dataset.doc;
  const doc = id ? store.state.docs.find((d) => d.id === id) : undefined;
  void addFiles(dropped, doc ? { doc: doc.id, index: doc.pages.length } : undefined);
});

// Ziehen mit Maus und Touch (nicht in der Handy-Ansicht, W10)
setupDrag({ store, actions, board: boardEl, announce, isPhone: () => phone.matches });

// Rückgängig, Wiederholen und „?“ im ganzen Werkstatt-Bereich
$('.ws-page-area').addEventListener('keydown', (event) => handleAreaKey(event, actions));

window.addEventListener('beforeunload', (event) => {
  if (!store.dirty) return;
  event.preventDefault();
  // Ältere Browser zeigen die Warnung nur mit gesetztem returnValue (Text zeigen sie nicht).
  event.returnValue = t.LEAVE_WARNING;
});

/** „Dateien anhängen …“ im Spaltenmenü: Ziel für die nächste Dateiauswahl */
let appendTarget: DocId | null = null;
input.addEventListener('cancel', () => (appendTarget = null));

preventAccidentalFileOpen();
wireDropzone($('#ws-drop'), input, (list) => {
  const doc = appendTarget ? store.state.docs.find((d) => d.id === appendTarget) : undefined;
  appendTarget = null;
  void addFiles(list, doc ? { doc: doc.id, index: doc.pages.length } : undefined);
});
render();
