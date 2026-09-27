/**
 * Werkzeugseite „PDF-Werkstatt“ (plan-phase3.md, Umbau zum Editor: docs/umbau-fortschritt.md).
 *
 * Aufbau wie ein Programm: Menüleiste und Werkzeugleiste (ui-commands.ts, menu.ts), links
 * Dokumente und Seitenminiaturen (sidebar.ts), in der Mitte das Seitenraster (grid.ts) oder eine
 * Seite groß (single-view.ts), rechts Eigenschaften und Verlauf (panels.ts), unten die
 * Statusleiste. Zustand und Befehle: src/core/workshop/ und store.ts; Aktionen: actions.ts;
 * Ziehen: drag.ts; Auswahlrechteck: band.ts; Tastatur: keyboard.ts; Lesen und Export mit pdf-lib
 * im Worker: workshop.worker.ts.
 */

import { isImage, isPdf } from '../../core/files/classify.ts';
import { parsePageRanges, pageIndices } from '../../core/pdf/page-ranges.ts';
import {
  exportOptionsFor,
  imagePageBox,
  type WorkshopHandover,
} from '../../core/workshop/export-plan.ts';
import { addSources, renameDoc } from '../../core/workshop/commands.ts';
import {
  clampZoom,
  stepZoom,
  wheelZoom,
  ZOOM_DEFAULT,
  TILE_WIDTH,
} from '../../core/workshop/layout.ts';
import {
  allPages,
  findDoc,
  formSourceOf,
  indexPages,
  NO_FACTS,
  type Doc,
  type DocId,
  type PageKey,
  type PagePick,
  type Source,
  type SourceId,
  type UnredactedPages,
  unredactedPages,
} from '../../core/workshop/model.ts';
import {
  moveFocus,
  selectionSummary,
  selectKeys,
  selectOnly,
  selectRange,
  toggle,
} from '../../core/workshop/selection.ts';
import { $ } from '../../ui/dom.ts';
import { preventAccidentalFileOpen, wireDropzone } from '../../ui/dropzone.ts';
import { prepareImage } from '../../ui/image-prepare.ts';
import { loadPdfjs, PdfjsUnsupportedError } from '../../ui/pdfjs/support.ts';
import { unsupportedNote } from '../../ui/pdfjs/unsupported-note.ts';
import { showToast } from '../../ui/toast.ts';
import { createWorkerClient, WorkerError } from '../../ui/worker-protocol.ts';
import { createActions } from './actions.ts';
import { setupBand } from './band.ts';
import { AskDialog, MergeDialog, MoveDialog, ShortcutsDialog } from './dialogs.ts';
import { setupDrag } from './drag.ts';
import { Exporter } from './export.ts';
import { Grid, SourceBadges } from './grid.ts';
import { handleGridKey, handleShortcut, typing } from './keyboard.ts';
import { closeMenus, MenuBar, openMenu, openMenuAt, type MenuEntry } from './menu.ts';
import { setupMobile } from './mobile.ts';
import { Panels } from './panels.ts';
import { RedactDialog } from './redact-dialog.ts';
import { ariaShortcut, shortcutLabel } from './shortcuts.ts';
import { DocList, PageRail } from './sidebar.ts';
import { SignDialog } from './sign-dialog.ts';
import { SingleView } from './single-view.ts';
import { SourceFiles } from './sources.ts';
import { WorkshopStore, type Change } from './store.ts';
import * as t from './texts.ts';
import { Thumbs } from './thumbs.ts';
import { ToolPanel } from './tool-panel.ts';
import { setupTooltips } from './tooltip.ts';
import {
  createCommands,
  docMenu,
  emptyMenu,
  gapMenu,
  labelOf,
  menubar,
  pageMenu,
  SHORTCUT_GROUPS,
  TOOLBAR,
  type App,
  type MenuContext,
  type ToolMode,
  type ViewMode,
} from './ui-commands.ts';
import type { AddImageResult, AddPdfResult, WorkshopRequest } from './workshop.worker.ts';

// Beides sofort laden: pdf-lib im Worker, pdf.js samt eigenem Worker (plan.md N4, offline).
const worker = new Worker(new URL('./workshop.worker.ts', import.meta.url), { type: 'module' });
const client = createWorkerClient<WorkshopRequest>(worker);
const pdfjs = loadPdfjs();
// Zu alter Browser (docs/pdfjs-kompatibilitaet.md 5): Hinweis über den Seiten, Speichern geht
const showUnsupported = unsupportedNote('preview', document.querySelector('.ws-center'));
let unsupported = false;
pdfjs.catch((error: unknown) => {
  if (!(error instanceof PdfjsUnsupportedError)) return;
  unsupported = true;
  render();
});

const messageFor = (error: unknown): string =>
  (error instanceof WorkerError ? t.ERRORS[error.code] : undefined) ?? t.FALLBACK_ERROR;

const files = new SourceFiles(pdfjs);
/** pdf.js-Dokument schließen, Datei im Worker vergessen */
function releaseSources(ids: SourceId[]): void {
  files.release(ids);
  void client.request({ type: 'release', ids }).catch(() => undefined);
}
const store = new WorkshopStore(releaseSources);
const thumbs = new Thumbs(files, pdfjs);
const app$ = $('#ws-app');
const boardEl = $('#ws-board');
const scroller = $('#ws-scroller');
const grid = new Grid(boardEl, scroller, thumbs, new SourceBadges());
const docListEl = $('#ws-doclist');
const docList = new DocList(docListEl);
const railEl = $('#ws-rail');
const rail = new PageRail(railEl, thumbs);
const input = $<HTMLInputElement>('#ws-input');
const status = $('#ws-status');
const live = $('#ws-live');

// ---------------------------------------------------------------------------------------------
// Ansichtszustand (gehört nicht zum Verlauf)

const view = {
  mode: 'grid' as ViewMode,
  zoom: ZOOM_DEFAULT,
  singleZoom: ZOOM_DEFAULT,
  tool: 'select' as ToolMode,
  collapsed: new Set<DocId>(),
  left: true,
  right: true,
  active: null as DocId | null,
  lastFocus: null as PageKey | null,
};

function activeDoc(): Doc | undefined {
  const { state } = store;
  return (
    (view.active ? findDoc(state, view.active) : undefined) ??
    (store.selection.focus ? indexPages(state).get(store.selection.focus)?.doc : undefined) ??
    state.docs[0]
  );
}

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

/** Nach dem nächsten Zeichnen: Fokus auf die Seite mit dem Fokus, sonst auf das Dokument */
let pendingFocus: { doc: DocId | undefined } | null = null;

function applyFocus(): void {
  if (!pendingFocus) return;
  const { doc } = pendingFocus;
  pendingFocus = null;
  if (view.mode === 'single') {
    single.focus();
    return;
  }
  const key = store.selection.focus;
  if (key && grid.focusTile(key)) return;
  const fallback = doc ?? activeDoc()?.id;
  const target = fallback ? findDoc(store.state, fallback) : undefined;
  const first = target?.pages[0];
  if (first && !view.collapsed.has(target.id)) {
    store.select(moveFocus(store.selection, first.key));
    grid.focusTile(first.key);
  } else if (target) {
    const section = grid.section(target.id);
    if (section && !view.collapsed.has(target.id) && target.pages.length === 0)
      section.list.focus();
    else docList.focus(target.id);
  } else {
    docListEl.focus();
  }
}

function focusDocName(doc: DocId): void {
  if (view.collapsed.delete(doc)) render();
  if (view.mode === 'single') setMode('grid');
  const name = grid.section(doc)?.name;
  if (!name) return;
  name.focus();
  name.select();
}

// ---------------------------------------------------------------------------------------------
// Werkzeuge der Stufe 2 in der rechten Leiste

const charset = client
  .request<number[]>({ type: 'charset' })
  .then((codes): ReadonlySet<number> => new Set(codes));
charset.catch(() => undefined);
const toolPanel = new ToolPanel(
  store,
  announce,
  (doc) => docList.focus(doc),
  charset,
  new SignDialog(store, files, pdfjs),
  store.ids,
  showToast,
  {
    redactDialog: new RedactDialog(store, files, pdfjs),
    files,
    pdfjs,
    client,
    release: releaseSources,
    // Nach dem Schwärzen: Hinweis auf nicht geschwärzte Seiten derselben Datei gleich mit ansagen
    redacted: (name) => {
      const found = unredactedPages(store.state);
      announce(
        [t.redactDone(name), ...found.map((f) => t.unredacted(f.keys.length, f.doc.name))].join(
          ' ',
        ),
      );
    },
  },
);

/** Das Element, das ein Werkzeug geöffnet hat, bekommt danach den Fokus zurück */
const opener = (): HTMLElement | null => document.activeElement as HTMLElement | null;

/** Dokument für „Formular ausfüllen …“, wenn es eine Quelle mit Formular hat */
function hasForm(id: DocId | null | undefined): boolean {
  const doc = id ? findDoc(store.state, id) : undefined;
  return !!doc && formSourceOf(store.state, doc) !== null;
}

/** Seite für „Unterschrift …“: die Seite mit dem Fokus, sonst die erste ausgewählte */
function signatureTarget(): string | null {
  const { focus, keys } = store.selection;
  const index = indexPages(store.state);
  if (focus && index.has(focus)) return focus;
  return [...keys].find((k) => index.has(k)) ?? null;
}

// ---------------------------------------------------------------------------------------------
// Aktionen, Dialoge, Export

const actions = createActions({
  store,
  announce,
  focusAfterRender: (doc) => {
    pendingFocus = { doc };
    // Befehle ohne Änderung zeichnen nicht neu: dann gleich
    queueMicrotask(applyFocus);
  },
  focusDocName,
  openFilePicker: () => pickFiles(),
  openMoveDialog: (keys) => moveDialog.open(store.state, keys),
  openShortcuts: () => shortcutsDialog.open(),
});

const moveDialog = new MoveDialog((keys, choice) => actions.moveTo(keys, choice.doc, choice.index));
const mergeDialog = new MergeDialog((docs) => actions.join(docs));
const askDialog = new AskDialog();

const exporter = new Exporter(store, client, {
  status: (text) => (status.textContent = text),
  busy: () => render(),
  done: (message) => {
    showToast(message);
    announce(message);
  },
  failed: (error) => showToast(messageFor(error)),
});

// ---------------------------------------------------------------------------------------------
// Befehle

const single = new SingleView(store, files, pdfjs, (key) => {
  store.select(selectOnly(key));
  render();
});

function setMode(mode: ViewMode): void {
  if (mode === 'single' && !store.selection.focus) {
    const first = activeDoc()?.pages[0] ?? store.state.docs.find((d) => d.pages.length)?.pages[0];
    if (!first) return;
    store.select(selectOnly(first.key));
  }
  if (view.mode === mode) return;
  view.mode = mode;
  if (mode === 'grid') single.close();
  announce(mode === 'single' ? t.VIEW_SINGLE_ON : t.VIEW_GRID_ON);
  pendingFocus = { doc: undefined };
  render();
}

function setZoom(zoom: number): void {
  const z = clampZoom(zoom);
  if (view.mode === 'single') view.singleZoom = z;
  else {
    // Die Stelle oben links bleibt ungefähr, wo sie war
    const ratio = scroller.scrollTop / Math.max(1, scroller.scrollHeight);
    view.zoom = z;
    render();
    scroller.scrollTop = ratio * scroller.scrollHeight;
    return;
  }
  render();
}

const currentZoom = () => (view.mode === 'single' ? view.singleZoom : view.zoom);

const app: App = {
  store,
  actions,
  mode: () => view.mode,
  setMode,
  tool: () => view.tool,
  setTool: (tool) => {
    view.tool = tool;
    announce(tool === 'scissors' ? t.TOOL_SCISSORS_ON : t.TOOL_SELECT_ON);
    if (tool === 'scissors' && view.mode === 'single') setMode('grid');
    render();
  },
  zoom: currentZoom,
  zoomBy: (direction) => setZoom(stepZoom(currentZoom(), direction)),
  zoomReset: () => setZoom(ZOOM_DEFAULT),
  zoomFit: () => {
    if (view.mode === 'single') {
      setZoom(ZOOM_DEFAULT);
      return;
    }
    // So groß, dass etwa sechs Seiten nebeneinander passen
    const width = scroller.clientWidth - 48;
    setZoom(((width / 6 - 28) / TILE_WIDTH) * 100);
  },
  panel: (side) => (side === 'left' ? view.left : view.right),
  togglePanel: (side) => {
    if (side === 'left') view.left = !view.left;
    else view.right = !view.right;
    render();
  },
  folded: (doc) => view.collapsed.has(doc),
  fold: (doc, folded) => {
    if (folded) view.collapsed.add(doc);
    else view.collapsed.delete(doc);
    const name = findDoc(store.state, doc)?.name ?? '';
    announce(folded ? t.folded(name) : t.unfolded(name));
    render();
  },
  foldAll: (folded) => {
    view.collapsed = new Set(folded ? store.state.docs.map((d) => d.id) : []);
    render();
  },
  activeDoc,
  openFiles: (target) => pickFiles(target),
  saveDoc: (id) => {
    const doc = findDoc(store.state, id);
    if (doc) saveChecked(unredactedPages(store.state, [doc]), () => void exporter.doc(id));
  },
  saveSelection: () => {
    const keys = actions.targets();
    saveChecked(unredactedPages(store.state, store.state.docs, new Set(keys)), () => {
      void exporter.selection(keys);
    });
  },
  saveAll: () => saveChecked(unredactedPages(store.state), () => void exporter.all()),
  canSave: () => !exporter.busy,
  strip: () => !!exporter.options.strip,
  setStrip: (strip) => {
    exporter.options = { strip };
    render();
  },
  pageNumbers: (doc) => toolPanel.pageNumbers(doc, opener()),
  stamp: (doc) => toolPanel.stamp(doc, opener()),
  signature: () => {
    const page = signatureTarget();
    if (page) toolPanel.signature(page, opener());
  },
  canSign: () => signatureTarget() !== null,
  redact: (doc) => toolPanel.redact(doc, opener()),
  form: (doc) => toolPanel.form(doc, opener()),
  hasForm,
  openMerge: (preselect) => mergeDialog.open(store.state, preselect),
  openMove: actions.moveDialog,
  openShortcuts: () => shortcutsDialog.open(),
  goToPage: () => {
    const doc = activeDoc();
    if (!doc || doc.pages.length === 0) return;
    askDialog.open({
      title: t.GOTO_TITLE,
      sub: t.gotoSub(doc.name, doc.pages.length),
      label: t.GOTO_LABEL,
      ok: t.GOTO_OK,
      inputMode: 'numeric',
      submit: (value) => {
        const n = Number(value);
        const page = Number.isInteger(n) ? doc.pages[n - 1] : undefined;
        if (!page) return t.AFTER_PAGE_INVALID(doc.pages.length);
        store.select(selectOnly(page.key));
        pendingFocus = { doc: doc.id };
        view.collapsed.delete(doc.id);
        render();
        return null;
      },
    });
  },
  selectRange: () => {
    const doc = activeDoc();
    if (!doc || doc.pages.length === 0) return;
    askDialog.open({
      title: t.RANGE_TITLE,
      sub: t.gotoSub(doc.name, doc.pages.length),
      label: t.RANGE_LABEL,
      ok: t.RANGE_OK,
      submit: (value) => {
        const result = parsePageRanges(value, doc.pages.length);
        if (!result.ok) return t.rangeError(doc.pages.length);
        actions.selectNumbers(
          doc.id,
          result.ranges.flatMap(pageIndices).map((i) => i + 1),
        );
        pendingFocus = { doc: doc.id };
        render();
        return null;
      },
    });
  },
  cutsEvery: () => {
    const doc = activeDoc();
    if (!doc || doc.pages.length < 2) return;
    askDialog.open({
      title: t.CUTS_EVERY_TITLE,
      sub: t.cutsEverySub(doc.name, doc.pages.length),
      label: t.CUTS_EVERY_LABEL,
      ok: t.CUTS_EVERY_OK,
      inputMode: 'numeric',
      value: '1',
      submit: (value) => {
        const n = Number(value);
        if (!Number.isInteger(n) || n < 1 || n >= doc.pages.length) {
          return t.cutsEveryError(doc.pages.length);
        }
        actions.cutsEvery(doc.id, n);
        return null;
      },
    });
  },
  showGuide: () => {
    const target = document.getElementById('ws-explain');
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    target?.setAttribute('tabindex', '-1');
    target?.focus({ preventScroll: true });
  },
  openSingle: (key) => {
    if (key) store.select(moveFocus(store.selection, key));
    setMode('single');
  },
};

const cmds = createCommands(app);
const menuCtx: MenuContext = { cmds, app };
const shortcutsDialog = new ShortcutsDialog(SHORTCUT_GROUPS, () => cmds.values());
const run = (id: string) => {
  const cmd = cmds.get(id);
  if (cmd && (!cmd.enabled || cmd.enabled())) cmd.run();
};

// ---------------------------------------------------------------------------------------------
// Menüleiste und Werkzeugleiste

const menuBar = new MenuBar($('#ws-menubar'), menubar(menuCtx));
const toolbar = $('#ws-toolbar');

function toolButton(id: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'ws-tb';
  b.dataset.cmd = id;
  b.tabIndex = -1;
  if (id === 'blank') {
    b.setAttribute('aria-label', t.C.blankMenu);
    b.dataset.tip = t.C.blankMenu;
    b.setAttribute('aria-haspopup', 'menu');
    b.setAttribute('aria-expanded', 'false');
    b.innerHTML = '<svg width="18" height="18" aria-hidden="true"><use href="#i-blank" /></svg>';
    return b;
  }
  const cmd = cmds.get(id);
  if (!cmd) throw new Error(`Befehl ${id} fehlt`);
  const label = labelOf(cmd);
  const key = cmd.keys?.[0];
  b.setAttribute('aria-label', label);
  b.dataset.tip = key ? `${label}\u0000${shortcutLabel(key)}` : label;
  if (cmd.keys) b.setAttribute('aria-keyshortcuts', ariaShortcut(cmd.keys));
  // Festes Markup ohne Nutzerdaten; der HTML-Parser setzt den SVG-Namensraum selbst.
  b.innerHTML = `<svg width="18" height="18" aria-hidden="true"><use href="#${cmd.icon ?? 'i-tools'}" /></svg>`;
  return b;
}

toolbar.replaceChildren(
  ...TOOLBAR.flatMap((group, i) => {
    const g = document.createElement('div');
    g.className = 'ws-tb-group';
    g.setAttribute('role', 'group');
    g.append(...group.map(toolButton));
    if (i === 0) {
      const first = g.querySelector('button');
      if (first) first.tabIndex = 0;
    }
    return [g];
  }),
);
toolbar.addEventListener('click', (event) => {
  const button = (event.target as Element).closest<HTMLButtonElement>('button[data-cmd]');
  if (!button || button.disabled) return;
  if (button.dataset.cmd === 'blank') {
    openMenuAt(
      button,
      [
        { label: t.C.blankNeighbour, run: () => actions.insertBlank('neighbour') },
        { label: t.BLANK_A4_PORTRAIT, run: () => actions.insertBlank('a4') },
        { label: t.BLANK_A4_LANDSCAPE, run: () => actions.insertBlank('a4-landscape') },
      ],
      t.C.blankMenu,
    );
    return;
  }
  run(button.dataset.cmd ?? '');
});
// Werkzeugleiste: ein Tabstopp, Pfeiltasten wechseln (WAI-ARIA Toolbar)
toolbar.addEventListener('keydown', (event) => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  const buttons = [...toolbar.querySelectorAll<HTMLButtonElement>('button')].filter(
    (b) => !b.disabled,
  );
  const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
  const next =
    event.key === 'Home'
      ? buttons[0]
      : event.key === 'End'
        ? buttons[buttons.length - 1]
        : buttons[(i + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length];
  if (!next) return;
  for (const b of toolbar.querySelectorAll('button')) b.tabIndex = -1;
  next.tabIndex = 0;
  next.focus();
  event.preventDefault();
});
setupTooltips(app$, $('#ws-tooltip'));

// Statusleiste: Zoom
const zoomInput = $<HTMLInputElement>('#ws-zoom');
zoomInput.addEventListener('input', () => setZoom(Number(zoomInput.value)));
$('#ws-statusbar').addEventListener('click', (event) => {
  const button = (event.target as Element).closest<HTMLButtonElement>('button[data-cmd]');
  if (button) run(button.dataset.cmd ?? '');
});
scroller.addEventListener(
  'wheel',
  (event) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    setZoom(wheelZoom(view.zoom, event.deltaY));
  },
  { passive: false },
);
$('#ws-single-stage').addEventListener(
  'wheel',
  (event) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    setZoom(wheelZoom(view.singleZoom, event.deltaY));
  },
  { passive: false },
);

const panels = new Panels(store, run, (strip) => app.setStrip(strip));

// ---------------------------------------------------------------------------------------------
// Zeichnen

const phone = window.matchMedia('(max-width: 640px)');

const mobile = setupMobile({
  store,
  actions,
  board: boardEl,
  phone,
  openPreview: (key) => app.openSingle(key),
  announceSelection,
  moreItems: () =>
    menubar(menuCtx).map((m): MenuEntry => ({ kind: 'submenu', label: m.label, items: m.items })),
});

let rendering = false;
function render(change?: Change): void {
  if (rendering) return;
  rendering = true;
  try {
    draw(change);
  } finally {
    rendering = false;
  }
}

function draw(change?: Change): void {
  const hadFocus = boardEl.contains(document.activeElement);
  const { state, selection } = store;
  // Das aktive Dokument folgt dem Fokus
  if (selection.focus !== view.lastFocus) {
    view.lastFocus = selection.focus;
    const doc = selection.focus ? indexPages(state).get(selection.focus)?.doc : undefined;
    if (doc) view.active = doc.id;
  }
  if (view.active && !findDoc(state, view.active)) view.active = null;
  for (const id of view.collapsed) if (!findDoc(state, id)) view.collapsed.delete(id);
  const active = activeDoc();

  const hasDocs = state.docs.length > 0;
  app$.classList.toggle('empty', !hasDocs);
  app$.classList.toggle('no-left', !view.left);
  app$.classList.toggle('no-right', !view.right);
  app$.classList.toggle('mode-single', view.mode === 'single');
  app$.classList.toggle('tool-scissors', view.tool === 'scissors');
  $('#ws-drop').hidden = hasDocs;
  showUnsupported({ unsupported, fileLoaded: hasDocs });

  const animate = change?.kind === 'command' || change?.kind === 'undo' || change?.kind === 'redo';
  grid.render(state, selection, {
    zoom: view.zoom,
    active: active?.id ?? null,
    collapsed: view.collapsed,
    animate,
  });
  if (hadFocus && !boardEl.contains(document.activeElement) && !pendingFocus) {
    pendingFocus = { doc: undefined };
  }
  docList.render(state, active?.id ?? null, selection);
  $('#ws-docs').textContent = hasDocs ? String(state.docs.length) : '';
  rail.render(state, active?.id ?? null, selection, selection.focus);
  $('#ws-rail-title').textContent = active ? t.railTitle(active.name) : t.RAIL_TITLE;
  $('#ws-rail-count').textContent = active ? String(active.pages.length) : '';

  // Einzelseite
  const singleEl = $('#ws-single');
  if (view.mode === 'single' && hasDocs) {
    const focusKey = selection.focus ?? active?.pages[0]?.key ?? null;
    singleEl.hidden = false;
    scroller.hidden = true;
    single.show(focusKey, view.singleZoom);
    if (focusKey) rail.reveal(focusKey);
  } else {
    if (view.mode === 'single') view.mode = 'grid';
    singleEl.hidden = true;
    scroller.hidden = false;
  }
  applyFocus();

  // Werkzeugleiste
  for (const button of toolbar.querySelectorAll<HTMLButtonElement>('button[data-cmd]')) {
    const id = button.dataset.cmd ?? '';
    if (id === 'blank') {
      button.disabled = !hasDocs;
      continue;
    }
    const cmd = cmds.get(id);
    if (!cmd) continue;
    button.disabled = cmd.enabled ? !cmd.enabled() : false;
    if (cmd.checked) button.setAttribute('aria-pressed', String(cmd.checked()));
    const label = labelOf(cmd);
    if (button.getAttribute('aria-label') !== label) {
      button.setAttribute('aria-label', label);
      const key = cmd.keys?.[0];
      button.dataset.tip = key ? `${label}\u0000${shortcutLabel(key)}` : label;
    }
  }
  const zoom = currentZoom();
  zoomInput.value = String(zoom);
  zoomInput.setAttribute('aria-valuetext', t.zoomValue(zoom));
  $('#ws-zoom-value').textContent = t.zoomValue(zoom);
  $('#ws-zoom-value').setAttribute('aria-label', t.zoomResetLabel(zoom));

  panels.render({
    state,
    selection,
    doc: active,
    tool: view.tool,
    options: exporter.options,
    busy: exporter.busy,
    dirty: store.dirty,
  });
  renderUnredacted();
  mobile.render();
  toolPanel.refresh();
}

store.subscribe((change) => render(change));

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
  if (result.doc) {
    mobile.showDoc(result.doc);
    view.active = result.doc;
    render();
  }
  const targetDoc = target ? findDoc(store.state, target.doc) : undefined;
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

/** „Dateien öffnen“; mit Ziel werden sie am Ende dieses Dokuments angehängt */
let appendTarget: DocId | null = null;
function pickFiles(target?: DocId): void {
  appendTarget = target ?? null;
  input.click();
}
input.addEventListener('cancel', () => (appendTarget = null));

/** Übergabe aus Startseite und Einzelwerkzeugen (tool-switch.ts, workshop-switch.ts) */
export function openFiles(
  list: File[],
  layouts?: ReadonlyMap<File, readonly PagePick[]>,
  handover?: WorkshopHandover,
): void {
  // Jede Übergabe legt „Versteckte Angaben“ fest (M6): „Entfernen“ nur aus „PDF-Metadaten
  // entfernen“, sonst „Behalten“. Sichtbar und umstellbar wie immer.
  exporter.options = exportOptionsFor(handover);
  render();
  void addFiles(list, undefined, layouts);
}

// ---------------------------------------------------------------------------------------------
// Nicht geschwärzte Seiten aus einer geschwärzten Datei (Stufe 2.3)

/** Seiten auswählen, zur ersten springen (auf dem Handy deren Dokument zeigen) */
function showPages(keys: readonly string[]): void {
  const [first] = keys;
  if (!first) return;
  const doc = indexPages(store.state).get(first)?.doc;
  if (doc) {
    mobile.showDoc(doc.id);
    view.collapsed.delete(doc.id);
    view.active = doc.id;
  }
  if (view.mode === 'single') setMode('grid');
  store.select(selectKeys(keys));
  grid.focusTile(first);
}

/** Absätze mit je einem Satz und „Zu den Seiten“ */
function unredactedLines(found: readonly UnredactedPages[]): HTMLElement[] {
  return found.map((f) => {
    const p = document.createElement('p');
    const show = document.createElement('button');
    show.type = 'button';
    show.className = 'btn ghost sm';
    show.textContent = t.UNREDACTED_SHOW;
    show.addEventListener('click', () => showPages(f.keys));
    p.append(t.unredacted(f.keys.length, f.doc.name), document.createElement('br'), show);
    return p;
  });
}

let unredactedShown = '';
function renderUnredacted(): void {
  const found = unredactedPages(store.state);
  // Nur neu aufbauen, wenn sich etwas geändert hat (Fokus auf einem Knopf bleibt erhalten)
  const key = found.map((f) => `${f.doc.id}:${f.doc.name}:${f.keys.join(',')}`).join('|');
  if (key === unredactedShown) return;
  unredactedShown = key;
  $('#ws-unredacted').hidden = found.length === 0;
  $('#ws-unredacted-list').replaceChildren(...unredactedLines(found));
}

const unredactedDialog = $<HTMLDialogElement>('#ws-unredacted-dialog');
$('#ws-unredacted-title').textContent = t.UNREDACTED_TITLE;
$('#ws-unredacted-show').textContent = t.UNREDACTED_SHOW;
$('#ws-unredacted-save').textContent = t.UNREDACTED_SAVE;
let unredactedSave: (() => void) | null = null;
let unredactedKeys: string[] = [];
$('#ws-unredacted-cancel').addEventListener('click', () => unredactedDialog.close());
$('#ws-unredacted-show').addEventListener('click', () => {
  unredactedDialog.close();
  showPages(unredactedKeys);
});
$('#ws-unredacted-save').addEventListener('click', () => {
  const save = unredactedSave;
  unredactedDialog.close();
  save?.();
});
unredactedDialog.addEventListener('close', () => {
  unredactedSave = null;
});

/**
 * Speichern; enthalten die gespeicherten Dokumente Seiten aus einer geschwärzten Datei, die
 * nicht geschwärzt sind, erscheint der Hinweis vorher noch einmal (Leon, 27.09.2026).
 */
function saveChecked(found: readonly UnredactedPages[], save: () => void): void {
  if (found.length === 0) {
    save();
    return;
  }
  unredactedSave = save;
  unredactedKeys = found.flatMap((f) => f.keys);
  $('#ws-unredacted-dialog-list').replaceChildren(
    ...found.map((f) => {
      const p = document.createElement('p');
      p.textContent = t.unredacted(f.keys.length, f.doc.name);
      return p;
    }),
  );
  unredactedDialog.showModal();
  $('#ws-unredacted-cancel').focus();
}

// ---------------------------------------------------------------------------------------------
// Raster: Auswahl mit der Maus, Schere, Trennlinien, Menüs, Umbenennen

function openDocMenu(doc: DocId, at: { x: number; y: number }, returnFocus: HTMLElement): void {
  const target = findDoc(store.state, doc);
  if (!target) return;
  view.active = doc;
  render();
  openMenu(docMenu(menuCtx, target), at, {
    label: t.docMenuLabel(target.name),
    returnFocus,
    ...(returnFocus.matches('[aria-haspopup]') ? { opener: returnFocus } : {}),
  });
}

function openPageMenu(at: { x: number; y: number }, returnFocus: HTMLElement): void {
  openMenu(pageMenu(menuCtx), at, { label: t.PAGE_MENU, returnFocus });
}

/** Stelle einer Kachel im Dokument */
function tileAt(tile: HTMLElement): { doc: DocId; index: number } | null {
  const key = tile.dataset.key;
  const at = key ? indexPages(store.state).get(key) : undefined;
  return at ? { doc: at.doc.id, index: at.pageIndex } : null;
}

boardEl.addEventListener('click', (event) => {
  const target = event.target as Element;
  const gap = target.closest<HTMLElement>('.ws-gap');
  if (gap) {
    const at = tileAt(gap.closest<HTMLElement>('.ws-page') ?? gap);
    if (!at) return;
    if (view.tool === 'scissors') actions.splitAt(at.doc, at.index);
    else if (gap.dataset.key) actions.toggleCut([gap.dataset.key]);
    return;
  }
  const cutRemove = target.closest<HTMLElement>('.ws-cutline-x, .ws-cutline');
  if (cutRemove?.dataset.key) {
    if (view.tool === 'scissors') {
      const tile = grid.tile(cutRemove.dataset.key);
      const at = tile ? tileAt(tile) : null;
      if (at) actions.splitAt(at.doc, at.index);
    } else if (cutRemove.classList.contains('ws-cutline-x')) {
      actions.toggleCut([cutRemove.dataset.key]);
    }
    return;
  }
  const fold = target.closest<HTMLButtonElement>('.ws-sec-fold');
  if (fold?.dataset.doc) {
    app.fold(fold.dataset.doc, !view.collapsed.has(fold.dataset.doc));
    return;
  }
  const numbersButton = target.closest<HTMLButtonElement>('.ws-col-numbers');
  if (numbersButton?.dataset.doc) {
    toolPanel.pageNumbers(numbersButton.dataset.doc, numbersButton);
    return;
  }
  const cutsButton = target.closest<HTMLButtonElement>('.ws-sec-cuts');
  if (cutsButton?.dataset.doc) {
    actions.splitAtCuts(cutsButton.dataset.doc);
    return;
  }
  const menuButton = target.closest<HTMLButtonElement>('.ws-col-menu');
  if (menuButton?.dataset.doc) {
    const rect = menuButton.getBoundingClientRect();
    openDocMenu(menuButton.dataset.doc, { x: rect.left, y: rect.bottom + 4 }, menuButton);
    return;
  }
  const tile = target.closest<HTMLElement>('.ws-page');
  const key = tile?.dataset.key;
  if (!tile || !key) {
    const head = target.closest<HTMLElement>('.ws-sec-head');
    if (head?.dataset.doc && !target.closest('input, button')) {
      view.active = head.dataset.doc;
      render();
    }
    return;
  }
  if (view.tool === 'scissors') {
    // Linke Hälfte: vor der Seite teilen, rechte Hälfte: danach
    const at = tileAt(tile);
    if (!at) return;
    const r = tile.getBoundingClientRect();
    const after = (event as MouseEvent).clientX > r.left + r.width / 2;
    actions.splitAt(at.doc, at.index + (after ? 1 : 0));
    return;
  }
  const { state, selection } = store;
  const mod = event.ctrlKey || event.metaKey;
  if (event.shiftKey) store.select(selectRange(state, selection, key, mod));
  else if (mod) store.select(toggle(selection, key));
  else store.select(selectOnly(key));
});

// Schere: Linie an der Stelle zeigen, an der geschnitten würde
boardEl.addEventListener('pointermove', (event) => {
  if (view.tool !== 'scissors') return;
  const tile = (event.target as Element).closest<HTMLElement>('.ws-page');
  for (const el of boardEl.querySelectorAll('.snip-before, .snip-after')) {
    if (el !== tile) el.classList.remove('snip-before', 'snip-after');
  }
  if (!tile) return;
  const r = tile.getBoundingClientRect();
  const after = event.clientX > r.left + r.width / 2;
  tile.classList.toggle('snip-after', after);
  tile.classList.toggle('snip-before', !after);
});

// Klick auf freie Fläche hebt die Auswahl auf (Auswahlrechteck: band.ts)
scroller.addEventListener('click', (event) => {
  const target = event.target as Element;
  if (target.closest('.ws-page, .ws-sec-head, button, input, label, .ws-cutline, .ws-gap')) return;
  actions.clearSelection();
});

boardEl.addEventListener('focusin', (event) => {
  const key = (event.target as HTMLElement).closest<HTMLElement>('.ws-page')?.dataset.key;
  if (key && store.selection.focus !== key) store.select(moveFocus(store.selection, key));
});

boardEl.addEventListener('keydown', (event) => {
  handleGridKey(event, {
    store,
    tiles: () => grid.visibleTiles(),
    focusPage: (key) => grid.focusTile(key),
    openContextMenu: (_key, anchor) => {
      const rect = anchor.getBoundingClientRect();
      openPageMenu({ x: rect.left + 12, y: rect.top + 24 }, anchor);
    },
    openSingle: (key) => app.openSingle(key),
    announceSelection,
  });
});

boardEl.addEventListener('dblclick', (event) => {
  if (view.tool === 'scissors') return;
  const key = (event.target as Element).closest<HTMLElement>('.ws-page')?.dataset.key;
  if (key) app.openSingle(key);
});

scroller.addEventListener('contextmenu', (event) => {
  const target = event.target as Element;
  if (target.closest('input')) return;
  event.preventDefault();
  const at = { x: event.clientX, y: event.clientY };
  const gap = target.closest<HTMLElement>('.ws-gap, .ws-cutline');
  if (gap?.dataset.key) {
    const tile = grid.tile(gap.dataset.key);
    const where = tile ? tileAt(tile) : null;
    if (where) {
      openMenu(gapMenu(menuCtx, where.doc, where.index), at, {
        label: t.GAP_MENU,
        returnFocus: tile ?? null,
      });
    }
    return;
  }
  const tile = target.closest<HTMLElement>('.ws-page');
  const key = tile?.dataset.key;
  if (tile && key) {
    if (!store.selection.keys.has(key)) store.select(selectOnly(key));
    else store.select(moveFocus(store.selection, key));
    openPageMenu(at, tile);
    return;
  }
  const head = target.closest<HTMLElement>('.ws-sec-head');
  if (head?.dataset.doc) {
    openDocMenu(head.dataset.doc, at, grid.section(head.dataset.doc)?.menu ?? head);
    return;
  }
  // Leere Fläche einer Liste: am Ende dieses Dokuments einfügen
  const section = target.closest<HTMLElement>('.ws-sec');
  if (section?.dataset.doc) view.active = section.dataset.doc;
  openMenu(emptyMenu(menuCtx), at, { label: t.EMPTY_MENU, returnFocus: scroller });
});

// Umbenennen im Kopf des Dokuments: übernehmen beim Verlassen oder mit Eingabe, Esc stellt zurück
boardEl.addEventListener('change', (event) => {
  const field = event.target as HTMLInputElement;
  const id = field.dataset.doc;
  if (!field.classList.contains('ws-name') || !id) return;
  const before = store.state;
  store.run(renameDoc(id, field.value));
  const doc = findDoc(store.state, id);
  if (doc && store.state !== before) announce(t.renamed(doc.name));
  // Leerer Name oder ohne Änderung: den gültigen Namen wieder anzeigen
  if (doc) field.value = doc.name;
});
boardEl.addEventListener('keydown', (event) => {
  const field = event.target as HTMLInputElement;
  if (!field.classList.contains('ws-name')) return;
  if (event.key !== 'Enter' && event.key !== 'Escape') return;
  if (event.key === 'Escape') {
    field.value = findDoc(store.state, field.dataset.doc ?? '')?.name ?? field.value;
  }
  event.preventDefault();
  event.stopPropagation();
  // Zurück zu den Seiten: Die Änderung wird beim Verlassen übernommen (change).
  pendingFocus = { doc: field.dataset.doc };
  const focus = store.selection.focus;
  const inDoc = findDoc(store.state, field.dataset.doc ?? '')?.pages.some((p) => p.key === focus);
  if (!inDoc) store.select({ ...store.selection, focus: null });
  applyFocus();
});

// Dateien auf ein Dokument ziehen: dort anhängen; sonst neue Dokumente
function fileDrop(area: HTMLElement): void {
  area.addEventListener('dragover', (event) => {
    if (!event.dataTransfer?.types.includes('Files')) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  });
  area.addEventListener('drop', (event) => {
    const dropped = [...(event.dataTransfer?.files ?? [])];
    if (dropped.length === 0) return;
    event.preventDefault();
    const id = (event.target as Element).closest<HTMLElement>('.ws-sec, .ws-doc')?.dataset.doc;
    const doc = id ? findDoc(store.state, id) : undefined;
    void addFiles(dropped, doc ? { doc: doc.id, index: doc.pages.length } : undefined);
  });
}
fileDrop(scroller);
fileDrop(docListEl);

// ---------------------------------------------------------------------------------------------
// Linke Leiste: Dokumente und Miniaturen

function activate(doc: DocId, reveal = true): void {
  view.active = doc;
  view.collapsed.delete(doc);
  mobile.showDoc(doc);
  if (view.mode === 'single') {
    const first = findDoc(store.state, doc)?.pages[0];
    if (first) store.select(selectOnly(first.key));
  }
  render();
  if (reveal && view.mode === 'grid') grid.reveal(doc);
}

docListEl.addEventListener('click', (event) => {
  const item = (event.target as Element).closest<HTMLElement>('.ws-doc');
  if (item?.dataset.doc) activate(item.dataset.doc);
});
docListEl.addEventListener('dblclick', (event) => {
  const item = (event.target as Element).closest<HTMLElement>('.ws-doc');
  if (item?.dataset.doc) focusDocName(item.dataset.doc);
});
docListEl.addEventListener('contextmenu', (event) => {
  const item = (event.target as Element).closest<HTMLElement>('.ws-doc');
  event.preventDefault();
  if (item?.dataset.doc)
    openDocMenu(item.dataset.doc, { x: event.clientX, y: event.clientY }, item);
  else
    openMenu(
      emptyMenu(menuCtx),
      { x: event.clientX, y: event.clientY },
      { label: t.EMPTY_MENU, returnFocus: docListEl },
    );
});
docListEl.addEventListener('keydown', (event) => {
  const item = (event.target as Element).closest<HTMLElement>('.ws-doc');
  const id = item?.dataset.doc;
  if (!item || !id) return;
  const docs = store.state.docs;
  const i = docs.findIndex((d) => d.id === id);
  let handled = true;
  if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && !event.altKey) {
    const next = docs[i + (event.key === 'ArrowDown' ? 1 : -1)];
    if (next) {
      activate(next.id);
      docList.focus(next.id);
    }
  } else if (event.key === 'Home' || event.key === 'End') {
    const next = event.key === 'Home' ? docs[0] : docs[docs.length - 1];
    if (next) {
      activate(next.id);
      docList.focus(next.id);
    }
  } else if (event.key === 'Enter') {
    activate(id);
    pendingFocus = { doc: id };
    const doc = findDoc(store.state, id);
    if (doc?.pages[0]) store.select(moveFocus(store.selection, doc.pages[0].key));
    applyFocus();
  } else if (event.key === 'F2') {
    focusDocName(id);
  } else if (event.key === 'Delete') {
    actions.closeDoc(id);
    const next = store.state.docs[Math.min(i, store.state.docs.length - 1)];
    if (next) docList.focus(next.id);
  } else if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
    const r = item.getBoundingClientRect();
    openDocMenu(id, { x: r.left + 12, y: r.bottom - 4 }, item);
  } else {
    handled = false;
  }
  if (handled) {
    event.preventDefault();
    event.stopPropagation();
  }
});

railEl.addEventListener('click', (event) => {
  const item = (event.target as Element).closest<HTMLElement>('.ws-rail-item');
  const key = item?.dataset.key;
  if (!key) return;
  const mod = event.ctrlKey || event.metaKey;
  if (event.shiftKey) store.select(selectRange(store.state, store.selection, key, mod));
  else if (mod) store.select(toggle(store.selection, key));
  else store.select(selectOnly(key));
  if (view.mode === 'grid')
    grid.tile(key)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
});
railEl.addEventListener('dblclick', (event) => {
  const key = (event.target as Element).closest<HTMLElement>('.ws-rail-item')?.dataset.key;
  if (key) app.openSingle(key);
});
railEl.addEventListener('keydown', (event) => {
  const item = (event.target as Element).closest<HTMLElement>('.ws-rail-item');
  if (!item || (event.key !== 'ArrowDown' && event.key !== 'ArrowUp')) return;
  const next = (
    event.key === 'ArrowDown' ? item.nextElementSibling : item.previousElementSibling
  ) as HTMLElement | null;
  if (!next) return;
  for (const el of railEl.children) (el as HTMLElement).tabIndex = -1;
  next.tabIndex = 0;
  next.focus();
  event.preventDefault();
  event.stopPropagation();
});
railEl.addEventListener('contextmenu', (event) => {
  const key = (event.target as Element).closest<HTMLElement>('.ws-rail-item')?.dataset.key;
  if (!key) return;
  event.preventDefault();
  if (!store.selection.keys.has(key)) store.select(selectOnly(key));
  openPageMenu({ x: event.clientX, y: event.clientY }, rail.item(key) ?? railEl);
});

// Einzelseite: Esc zurück zum Raster, Kontextmenü der Seite
$('#ws-single').addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  event.preventDefault();
  event.stopPropagation();
  setMode('grid');
});
$('#ws-single-stage').addEventListener('contextmenu', (event) => {
  event.preventDefault();
  openPageMenu({ x: event.clientX, y: event.clientY }, $('#ws-single-stage'));
});
$('#ws-single-stage').addEventListener('dblclick', () => setMode('grid'));

// ---------------------------------------------------------------------------------------------
// Ziehen, Auswahlrechteck, Tastatur

setupDrag({
  store,
  actions,
  board: boardEl,
  scroller,
  rail: railEl,
  docList: docListEl,
  announce,
  disabled: () => phone.matches || view.tool === 'scissors',
  railDoc: () => rail.docId,
  activate: (doc) => activate(doc),
  toNewDoc: (_keys, copy) => (copy ? actions.extract() : actions.extractMove()),
});

setupBand({
  store,
  scroller,
  band: $('#ws-band'),
  tiles: () => grid.visibleTiles(),
  disabled: () => phone.matches || view.tool === 'scissors',
  done: announceSelection,
});

// Kürzel auch, wenn nach einem Klick auf freie Fläche niemand den Fokus hat (body)
document.addEventListener('keydown', (event) => {
  const target = event.target as Node;
  if (target !== document.body && !app$.contains(target)) return;
  if (!app$.isConnected) return;
  // F10: in die Menüleiste (Umschalt+F10 ist das Kontextmenü)
  if (event.key === 'F10' && !event.shiftKey && !typing(event.target)) {
    event.preventDefault();
    closeMenus();
    menuBar.focusBar();
    return;
  }
  // Esc: Schere beenden, sonst Auswahl aufheben (Befehl)
  if (event.key === 'Escape' && view.tool === 'scissors' && !typing(event.target)) {
    event.preventDefault();
    app.setTool('select');
    return;
  }
  handleShortcut(event, cmds);
});

window.addEventListener('beforeunload', (event) => {
  if (!store.dirty) return;
  event.preventDefault();
  // Ältere Browser zeigen die Warnung nur mit gesetztem returnValue (Text zeigen sie nicht).
  event.returnValue = t.LEAVE_WARNING;
});

preventAccidentalFileOpen();
wireDropzone($('#ws-drop'), input, (list) => {
  const doc = appendTarget ? findDoc(store.state, appendTarget) : undefined;
  appendTarget = null;
  void addFiles(list, doc ? { doc: doc.id, index: doc.pages.length } : undefined);
});
$('#ws-m-add').addEventListener('click', () => pickFiles());

render();
