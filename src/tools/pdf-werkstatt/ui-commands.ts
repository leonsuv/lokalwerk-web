/**
 * Alle Befehle der Werkstatt an einer Stelle (Umbau zum Editor): Name, Symbol, Tastenkürzel,
 * wann sie gehen und was sie tun. Menüleiste, Werkzeugleiste, Kontextmenüs, Tastatur und die
 * Übersicht der Tastenkürzel werden daraus gebaut, damit dieselbe Aktion überall gleich heißt
 * (AGENTS.md Abschnitt 7) und überall dasselbe tut.
 */

import {
  cutIndices,
  findDoc,
  indexPages,
  type Doc,
  type DocId,
  type PageKey,
} from '../../core/workshop/model.ts';
import type { Actions, BlankSize } from './actions.ts';
import { SEP, type MenuEntry } from './menu.ts';
import { ariaShortcut, shortcutLabel } from './shortcuts.ts';
import type { WorkshopStore } from './store.ts';
import * as t from './texts.ts';

export type ViewMode = 'grid' | 'single';
export type ToolMode = 'select' | 'scissors';

export interface Cmd {
  id: string;
  label: string | (() => string);
  /** Symbol für Werkzeugleiste (ohne „#“) */
  icon?: string;
  /** Tastenkürzel, das erste wird angezeigt */
  keys?: readonly string[];
  enabled?: () => boolean;
  /** Umschalter oder eine aus mehreren (radio) */
  checked?: () => boolean;
  radio?: boolean;
  run: () => void;
  /** Gruppe in der Übersicht der Tastenkürzel */
  group?: string;
}

export interface App {
  store: WorkshopStore;
  actions: Actions;
  mode: () => ViewMode;
  setMode: (mode: ViewMode) => void;
  tool: () => ToolMode;
  setTool: (tool: ToolMode) => void;
  zoom: () => number;
  zoomBy: (direction: 1 | -1) => void;
  zoomReset: () => void;
  zoomFit: () => void;
  panel: (side: 'left' | 'right') => boolean;
  togglePanel: (side: 'left' | 'right') => void;
  folded: (doc: DocId) => boolean;
  fold: (doc: DocId, folded: boolean) => void;
  foldAll: (folded: boolean) => void;
  activeDoc: () => Doc | undefined;
  openFiles: (target?: DocId) => void;
  saveDoc: (doc: DocId) => void;
  saveSelection: () => void;
  saveAll: () => void;
  canSave: () => boolean;
  strip: () => boolean;
  setStrip: (strip: boolean) => void;
  pageNumbers: (doc: DocId) => void;
  stamp: (doc: DocId) => void;
  signature: () => void;
  canSign: () => boolean;
  redact: (doc: DocId) => void;
  form: (doc: DocId) => void;
  hasForm: (doc: DocId | undefined) => boolean;
  openMerge: (preselect?: readonly DocId[]) => void;
  openMove: () => void;
  openShortcuts: () => void;
  goToPage: () => void;
  selectRange: () => void;
  showGuide: () => void;
  openSingle: (key?: PageKey) => void;
}

export function createCommands(app: App): Map<string, Cmd> {
  const { store, actions } = app;
  const hasPages = () => actions.targets().length > 0;
  const hasFocus = () =>
    !!store.selection.focus && indexPages(store.state).has(store.selection.focus);
  const doc = () => app.activeDoc();
  const docWithPages = () => (doc()?.pages.length ?? 0) > 0;
  const withDoc = (run: (d: DocId) => void) => () => {
    const d = doc();
    if (d) run(d.id);
  };
  const focusAt = () =>
    store.selection.focus ? indexPages(store.state).get(store.selection.focus) : undefined;
  const hasDocs = () => store.state.docs.length > 0;

  const list: Cmd[] = [
    // Datei
    {
      id: 'open',
      label: t.C.open,
      icon: 'i-folder',
      keys: ['mod+o'],
      run: () => app.openFiles(),
      group: 'file',
    },
    {
      id: 'new-doc',
      label: t.C.newDoc,
      icon: 'i-plus',
      keys: ['shift+n'],
      run: actions.newDoc,
      group: 'file',
    },
    {
      id: 'append',
      label: t.C.append,
      enabled: () => !!doc(),
      run: withDoc((d) => app.openFiles(d)),
      group: 'file',
    },
    {
      id: 'save-doc',
      label: () => t.exportDocLabel(doc()?.name ?? t.C.docFallback),
      icon: 'i-save',
      keys: ['mod+s'],
      enabled: () => app.canSave() && docWithPages(),
      run: withDoc(app.saveDoc),
      group: 'file',
    },
    {
      id: 'save-selection',
      label: t.C.saveSelection,
      keys: ['mod+alt+s'],
      enabled: () => app.canSave() && store.selection.keys.size > 0,
      run: app.saveSelection,
      group: 'file',
    },
    {
      id: 'save-all',
      label: t.C.saveAll,
      keys: ['mod+shift+s'],
      enabled: () => app.canSave() && store.state.docs.some((d) => d.pages.length > 0),
      run: app.saveAll,
      group: 'file',
    },
    {
      id: 'meta-keep',
      label: t.C.metaKeep,
      radio: true,
      checked: () => !app.strip(),
      run: () => app.setStrip(false),
    },
    {
      id: 'meta-strip',
      label: t.C.metaStrip,
      radio: true,
      checked: () => app.strip(),
      run: () => app.setStrip(true),
    },
    {
      id: 'close-doc',
      label: t.C.closeDoc,
      enabled: () => !!doc(),
      run: withDoc(actions.closeDoc),
      group: 'file',
    },

    // Bearbeiten
    {
      id: 'undo',
      label: () => (store.undoLabel ? t.undoItem(store.undoLabel) : t.C.undo),
      icon: 'i-undo',
      keys: ['mod+z'],
      enabled: () => store.canUndo,
      run: actions.undo,
      group: 'edit',
    },
    {
      id: 'redo',
      label: () => (store.redoLabel ? t.redoItem(store.redoLabel) : t.C.redo),
      icon: 'i-redo',
      keys: ['mod+shift+z', 'mod+y'],
      enabled: () => store.canRedo,
      run: actions.redo,
      group: 'edit',
    },
    {
      id: 'cut',
      label: t.C.cut,
      keys: ['mod+x'],
      enabled: hasPages,
      run: actions.cut,
      group: 'edit',
    },
    {
      id: 'copy',
      label: t.C.copy,
      keys: ['mod+c'],
      enabled: hasPages,
      run: actions.copy,
      group: 'edit',
    },
    {
      id: 'paste',
      label: t.C.paste,
      keys: ['mod+v'],
      enabled: () => !!store.clipboard && hasDocs(),
      run: () => actions.paste(doc()?.id),
      group: 'edit',
    },
    {
      id: 'paste-after',
      label: t.C.pasteAfter,
      keys: ['mod+shift+v'],
      enabled: () => !!store.clipboard && hasFocus(),
      run: actions.pasteAfter,
      group: 'edit',
    },
    {
      id: 'duplicate',
      label: t.C.duplicate,
      icon: 'i-copy',
      keys: ['d'],
      enabled: hasPages,
      run: actions.duplicate,
      group: 'edit',
    },
    {
      id: 'delete',
      label: t.C.delete,
      icon: 'i-x',
      keys: ['delete', 'backspace'],
      enabled: hasPages,
      run: actions.remove,
      group: 'edit',
    },
    {
      id: 'select-all',
      label: t.C.selectAll,
      keys: ['mod+a'],
      enabled: docWithPages,
      run: withDoc(actions.selectAll),
      group: 'select',
    },
    {
      id: 'select-everything',
      label: t.C.selectEverything,
      keys: ['mod+shift+a'],
      enabled: () => store.state.docs.some((d) => d.pages.length > 0),
      run: actions.selectEverything,
      group: 'select',
    },
    {
      id: 'select-none',
      label: t.C.selectNone,
      keys: ['escape'],
      enabled: () => store.selection.keys.size > 0,
      run: actions.clearSelection,
      group: 'select',
    },
    {
      id: 'invert',
      label: t.C.invert,
      keys: ['mod+i'],
      enabled: docWithPages,
      run: () => actions.invert(doc()?.id ?? null),
      group: 'select',
    },
    {
      id: 'select-odd',
      label: t.C.selectOdd,
      enabled: docWithPages,
      run: withDoc((d) => actions.selectParity(d, true)),
    },
    {
      id: 'select-even',
      label: t.C.selectEven,
      enabled: docWithPages,
      run: withDoc((d) => actions.selectParity(d, false)),
    },
    {
      id: 'select-range',
      label: t.C.selectRange,
      enabled: docWithPages,
      run: app.selectRange,
      group: 'select',
    },
    {
      id: 'go-to',
      label: t.C.goTo,
      keys: ['mod+g'],
      enabled: docWithPages,
      run: app.goToPage,
      group: 'select',
    },

    // Seite
    {
      id: 'rotate-right',
      label: t.C.rotateRight,
      icon: 'i-rotate-right',
      keys: ['r'],
      enabled: hasPages,
      run: () => actions.rotate(90),
      group: 'page',
    },
    {
      id: 'rotate-left',
      label: t.C.rotateLeft,
      icon: 'i-rotate-left',
      keys: ['shift+r'],
      enabled: hasPages,
      run: () => actions.rotate(-90),
      group: 'page',
    },
    {
      id: 'rotate-180',
      label: t.C.rotate180,
      icon: 'i-rotate-180',
      keys: ['alt+r'],
      enabled: hasPages,
      run: actions.rotateHalf,
      group: 'page',
    },
    {
      id: 'shift-up',
      label: t.C.shiftUp,
      keys: ['alt+arrowup'],
      enabled: hasPages,
      run: () => actions.shift(-1),
      group: 'page',
    },
    {
      id: 'shift-down',
      label: t.C.shiftDown,
      keys: ['alt+arrowdown'],
      enabled: hasPages,
      run: () => actions.shift(1),
      group: 'page',
    },
    {
      id: 'reverse',
      label: t.C.reverse,
      icon: 'i-reverse',
      enabled: () => actions.targets().length > 1,
      run: actions.reverse,
    },
    {
      id: 'move',
      label: t.C.move,
      keys: ['m'],
      enabled: () => hasPages() && hasDocs(),
      run: app.openMove,
      group: 'page',
    },
    {
      id: 'extract',
      label: t.C.extract,
      keys: ['e'],
      enabled: hasPages,
      run: actions.extractMove,
      group: 'page',
    },
    { id: 'extract-copy', label: t.C.extractCopy, enabled: hasPages, run: actions.extract },
    {
      id: 'cut-toggle',
      label: t.C.cutToggle,
      icon: 'i-cutline',
      keys: ['t'],
      enabled: () =>
        actions.targets().some((k) => (indexPages(store.state).get(k)?.pageIndex ?? 0) > 0),
      run: () => actions.toggleCut(),
      group: 'page',
    },
    {
      id: 'split-here',
      label: t.C.splitHere,
      keys: ['shift+t'],
      enabled: () => (focusAt()?.pageIndex ?? 0) > 0,
      run: actions.split,
      group: 'page',
    },
    {
      id: 'open-single',
      label: t.C.openSingle,
      keys: ['enter'],
      enabled: hasFocus,
      run: () => app.openSingle(),
      group: 'view',
    },

    // Dokument
    {
      id: 'rename',
      label: t.C.rename,
      keys: ['f2'],
      enabled: () => !!doc(),
      run: withDoc(actions.renameDoc),
      group: 'doc',
    },
    {
      id: 'duplicate-doc',
      label: t.C.duplicateDoc,
      enabled: () => !!doc(),
      run: withDoc(actions.duplicateDoc),
    },
    {
      id: 'split-cuts',
      label: () => {
        const d = doc();
        const n = d ? cutIndices(d).length : 0;
        return n > 0 ? t.splitAtCutsItem(n + 1) : t.C.splitCuts;
      },
      icon: 'i-split-parts',
      keys: ['alt+t'],
      enabled: () => {
        const d = doc();
        return !!d && cutIndices(d).length > 0;
      },
      run: withDoc(actions.splitAtCuts),
      group: 'doc',
    },
    {
      id: 'clear-cuts',
      label: t.C.clearCuts,
      enabled: () => {
        const d = doc();
        return !!d && cutIndices(d).length > 0;
      },
      run: withDoc(actions.clearCuts),
    },
    {
      id: 'merge',
      label: t.C.merge,
      icon: 'i-merge',
      enabled: () => store.state.docs.length > 1,
      run: () => app.openMerge(),
    },
    {
      id: 'doc-up',
      label: t.C.docUp,
      keys: ['alt+shift+arrowup'],
      enabled: () => store.state.docs.findIndex((d) => d.id === doc()?.id) > 0,
      run: withDoc((d) => actions.moveDoc(d, store.state.docs.findIndex((x) => x.id === d) - 1)),
      group: 'doc',
    },
    {
      id: 'doc-down',
      label: t.C.docDown,
      keys: ['alt+shift+arrowdown'],
      enabled: () => {
        const i = store.state.docs.findIndex((d) => d.id === doc()?.id);
        return i >= 0 && i < store.state.docs.length - 1;
      },
      run: withDoc((d) => actions.moveDoc(d, store.state.docs.findIndex((x) => x.id === d) + 2)),
      group: 'doc',
    },

    // Werkzeuge
    {
      id: 'tool-select',
      label: t.C.toolSelect,
      icon: 'i-pointer',
      keys: ['v'],
      radio: true,
      checked: () => app.tool() === 'select',
      run: () => app.setTool('select'),
      group: 'tools',
    },
    {
      id: 'tool-scissors',
      label: t.C.toolScissors,
      icon: 'i-scissors',
      keys: ['s'],
      radio: true,
      checked: () => app.tool() === 'scissors',
      enabled: hasDocs,
      run: () => app.setTool('scissors'),
      group: 'tools',
    },
    {
      id: 'page-numbers',
      label: t.PAGE_NUMBERS_ITEM,
      icon: 'i-page-number',
      enabled: docWithPages,
      run: withDoc(app.pageNumbers),
    },
    {
      id: 'stamp',
      label: t.STAMP_ITEM,
      icon: 'i-stamp',
      enabled: docWithPages,
      run: withDoc(app.stamp),
    },
    {
      id: 'signature',
      label: t.SIGN_ITEM,
      icon: 'i-sign',
      enabled: app.canSign,
      run: app.signature,
    },
    {
      id: 'redact',
      label: t.REDACT_ITEM,
      icon: 'i-redact',
      enabled: docWithPages,
      run: withDoc(app.redact),
    },
    {
      id: 'form',
      label: t.FORM_ITEM,
      icon: 'i-form',
      enabled: () => app.hasForm(doc()?.id),
      run: withDoc(app.form),
    },

    // Ansicht
    {
      id: 'view-grid',
      label: t.C.viewGrid,
      icon: 'i-grid',
      keys: ['g'],
      radio: true,
      checked: () => app.mode() === 'grid',
      run: () => app.setMode('grid'),
      group: 'view',
    },
    {
      id: 'view-single',
      label: t.C.viewSingle,
      icon: 'i-single',
      keys: ['shift+g'],
      radio: true,
      checked: () => app.mode() === 'single',
      enabled: () => store.state.docs.some((d) => d.pages.length > 0),
      run: () => app.setMode('single'),
      group: 'view',
    },
    {
      id: 'zoom-in',
      label: t.C.zoomIn,
      icon: 'i-zoom-in',
      keys: ['mod+plus'],
      run: () => app.zoomBy(1),
      group: 'view',
    },
    {
      id: 'zoom-out',
      label: t.C.zoomOut,
      icon: 'i-zoom-out',
      keys: ['mod+minus'],
      run: () => app.zoomBy(-1),
      group: 'view',
    },
    { id: 'zoom-reset', label: t.C.zoomReset, keys: ['mod+0'], run: app.zoomReset, group: 'view' },
    { id: 'zoom-fit', label: t.C.zoomFit, icon: 'i-fit', run: app.zoomFit },
    { id: 'fold-all', label: t.C.foldAll, enabled: hasDocs, run: () => app.foldAll(true) },
    { id: 'unfold-all', label: t.C.unfoldAll, enabled: hasDocs, run: () => app.foldAll(false) },
    {
      id: 'panel-left',
      label: t.C.panelLeft,
      icon: 'i-panel-left',
      checked: () => app.panel('left'),
      run: () => app.togglePanel('left'),
    },
    {
      id: 'panel-right',
      label: t.C.panelRight,
      icon: 'i-panel-right',
      checked: () => app.panel('right'),
      run: () => app.togglePanel('right'),
    },

    // Hilfe
    {
      id: 'shortcuts',
      label: t.C.shortcuts,
      icon: 'i-keyboard',
      keys: ['?'],
      run: app.openShortcuts,
      group: 'help',
    },
    { id: 'guide', label: t.C.guide, keys: ['f1'], run: app.showGuide, group: 'help' },
  ];
  return new Map(list.map((c) => [c.id, c]));
}

export function labelOf(cmd: Cmd): string {
  return typeof cmd.label === 'function' ? cmd.label() : cmd.label;
}

/** Menüeintrag aus einem Befehl */
export function entry(cmds: Map<string, Cmd>, id: string, label?: string): MenuEntry {
  const cmd = cmds.get(id);
  if (!cmd) throw new Error(`Befehl ${id} fehlt`);
  const e: MenuEntry = {
    label: label ?? labelOf(cmd),
    disabled: cmd.enabled ? !cmd.enabled() : false,
    run: cmd.run,
  };
  if (cmd.keys?.[0]) {
    e.shortcut = shortcutLabel(cmd.keys[0]);
    e.keys = ariaShortcut(cmd.keys);
  }
  if (cmd.checked) {
    e.checked = cmd.checked();
    if (cmd.radio) e.radio = true;
  }
  return e;
}

export interface MenuContext {
  cmds: Map<string, Cmd>;
  app: App;
}

function blankItems(run: (size: BlankSize) => void, neighbour: string): MenuEntry[] {
  return [
    { label: neighbour, run: () => run('neighbour') },
    { label: t.BLANK_A4_PORTRAIT, run: () => run('a4') },
    { label: t.BLANK_A4_LANDSCAPE, run: () => run('a4-landscape') },
  ];
}

/** Untermenü „Zu Dokument verschieben“: alle anderen Dokumente und ein neues */
function moveToDocItems(ctx: MenuContext, copy: boolean): MenuEntry[] {
  const { store, actions } = ctx.app;
  const keys = new Set(actions.targets());
  const docs = store.state.docs.filter(
    (d) => !d.pages.every((p) => keys.has(p.key)) || d.pages.length === 0,
  );
  const items: MenuEntry[] = docs.map((d) => ({
    label: t.docWithCount(d.name, d.pages.length),
    run: () => actions.moveToDoc(d.id, copy),
  }));
  if (items.length > 0) items.push(SEP);
  items.push({
    label: t.C.newDocEntry,
    run: copy ? actions.extract : actions.extractMove,
  });
  return items;
}

/** Menüleiste */
export function menubar(ctx: MenuContext): { label: string; items: () => MenuEntry[] }[] {
  const { cmds, app } = ctx;
  const e = (id: string) => entry(cmds, id);
  const d = () => app.activeDoc();
  return [
    {
      label: t.M.file,
      items: () => [
        e('open'),
        e('new-doc'),
        e('append'),
        SEP,
        e('save-doc'),
        e('save-selection'),
        e('save-all'),
        SEP,
        {
          kind: 'submenu',
          label: t.METADATA_LABEL,
          items: () => [e('meta-keep'), e('meta-strip')],
        },
        SEP,
        e('close-doc'),
      ],
    },
    {
      label: t.M.edit,
      items: () => [
        e('undo'),
        e('redo'),
        SEP,
        e('cut'),
        e('copy'),
        e('paste'),
        e('paste-after'),
        e('duplicate'),
        e('delete'),
        SEP,
        e('select-all'),
        e('select-everything'),
        e('select-none'),
        e('invert'),
        {
          kind: 'submenu',
          label: t.C.selectMore,
          disabled: !d()?.pages.length,
          items: () => [e('select-odd'), e('select-even'), e('select-range')],
        },
        SEP,
        e('go-to'),
      ],
    },
    {
      label: t.M.page,
      items: () => [
        e('rotate-right'),
        e('rotate-left'),
        e('rotate-180'),
        SEP,
        e('shift-up'),
        e('shift-down'),
        e('reverse'),
        e('move'),
        {
          kind: 'submenu',
          label: t.C.moveToDoc,
          disabled: app.actions.targets().length === 0,
          items: () => moveToDocItems(ctx, false),
        },
        {
          kind: 'submenu',
          label: t.C.copyToDoc,
          disabled: app.actions.targets().length === 0,
          items: () => moveToDocItems(ctx, true),
        },
        e('extract'),
        SEP,
        {
          kind: 'submenu',
          label: t.C.blankBefore,
          disabled: !app.store.selection.focus,
          items: () => blankItems((s) => app.actions.blankNear(0, s), t.C.blankNeighbour),
        },
        {
          kind: 'submenu',
          label: t.C.blankAfter,
          disabled: !app.store.selection.focus,
          items: () => blankItems((s) => app.actions.blankNear(1, s), t.C.blankNeighbour),
        },
        SEP,
        e('cut-toggle'),
        e('split-here'),
        SEP,
        e('open-single'),
      ],
    },
    {
      label: t.M.doc,
      items: () => [
        e('rename'),
        e('duplicate-doc'),
        SEP,
        e('split-cuts'),
        e('clear-cuts'),
        e('merge'),
        {
          kind: 'submenu',
          label: t.C.mergeWith,
          disabled: app.store.state.docs.length < 2 || !d(),
          items: () => mergeWithItems(ctx, d()?.id),
        },
        SEP,
        e('doc-up'),
        e('doc-down'),
        SEP,
        e('close-doc'),
      ],
    },
    {
      label: t.M.tools,
      items: () => [
        e('tool-select'),
        e('tool-scissors'),
        SEP,
        e('page-numbers'),
        e('stamp'),
        e('signature'),
        e('redact'),
        e('form'),
      ],
    },
    {
      label: t.M.view,
      items: () => [
        e('view-grid'),
        e('view-single'),
        SEP,
        e('zoom-in'),
        e('zoom-out'),
        e('zoom-reset'),
        e('zoom-fit'),
        SEP,
        e('fold-all'),
        e('unfold-all'),
        SEP,
        e('panel-left'),
        e('panel-right'),
      ],
    },
    { label: t.M.help, items: () => [e('shortcuts'), e('guide')] },
  ];
}

/** Untermenü „Zusammenführen mit“: das Dokument bekommt die Seiten des gewählten angehängt */
function mergeWithItems(ctx: MenuContext, id: DocId | undefined): MenuEntry[] {
  const { store, actions } = ctx.app;
  if (!id) return [];
  const others = store.state.docs.filter((d) => d.id !== id);
  return [
    ...others.map((d) => ({
      label: t.docWithCount(d.name, d.pages.length),
      run: () => actions.join([id, d.id]),
    })),
    SEP,
    { label: t.C.mergeDialog, run: () => ctx.app.openMerge([id]) },
  ];
}

/** Kontextmenü einer Seite (Ziel: Auswahl, sonst die Seite) */
export function pageMenu(ctx: MenuContext): MenuEntry[] {
  const { cmds, app } = ctx;
  const e = (id: string, label?: string) => entry(cmds, id, label);
  const at = app.store.selection.focus
    ? indexPages(app.store.state).get(app.store.selection.focus)
    : undefined;
  const hasCut = !!at && (at.doc.cuts ?? []).includes(at.page.key);
  return [
    e('open-single'),
    SEP,
    e('rotate-right'),
    e('rotate-left'),
    e('rotate-180'),
    SEP,
    e('cut'),
    e('copy'),
    e('paste', t.C.pasteBefore),
    e('paste-after'),
    e('duplicate'),
    SEP,
    {
      kind: 'submenu',
      label: t.C.blankBefore,
      items: () => blankItems((s) => app.actions.blankNear(0, s), t.C.blankNeighbour),
    },
    {
      kind: 'submenu',
      label: t.C.blankAfter,
      items: () => blankItems((s) => app.actions.blankNear(1, s), t.C.blankNeighbour),
    },
    SEP,
    e('cut-toggle', hasCut ? t.C.cutRemoveHere : t.C.cutSetHere),
    e('split-here'),
    e('extract'),
    { kind: 'submenu', label: t.C.moveToDoc, items: () => moveToDocItems(ctx, false) },
    e('move'),
    SEP,
    e('stamp'),
    e('signature'),
    e('redact'),
    SEP,
    e('delete'),
  ];
}

/** Kontextmenü eines Zwischenraums: Einfügestelle `index` im Dokument */
export function gapMenu(ctx: MenuContext, doc: DocId, index: number): MenuEntry[] {
  const { app } = ctx;
  const target = findDoc(app.store.state, doc);
  const page = target?.pages[index];
  const hasCut = !!page && (target?.cuts ?? []).includes(page.key);
  return [
    {
      label: t.C.pasteHere,
      disabled: !app.store.clipboard,
      shortcut: shortcutLabel('mod+v'),
      run: () => app.actions.pasteAt(doc, index),
    },
    {
      kind: 'submenu',
      label: t.C.blankHere,
      items: () => blankItems((s) => app.actions.blankAt(doc, index, s), t.C.blankNeighbour),
    },
    SEP,
    {
      label: hasCut ? t.C.cutRemoveHere : t.C.cutSetHere,
      shortcut: shortcutLabel('t'),
      disabled: !page || index === 0,
      run: () => page && app.actions.toggleCut([page.key]),
    },
    {
      label: t.C.splitHere,
      disabled: !page || index === 0,
      run: () => app.actions.splitAt(doc, index),
    },
  ];
}

/** Kontextmenü eines Dokuments (Liste links, Kopf des Abschnitts) */
export function docMenu(ctx: MenuContext, doc: Doc): MenuEntry[] {
  const { app } = ctx;
  const { actions } = app;
  const cuts = cutIndices(doc).length;
  return [
    {
      label: t.C.rename,
      shortcut: shortcutLabel('f2'),
      keys: 'F2',
      run: () => actions.renameDoc(doc.id),
    },
    { label: t.C.duplicateDoc, run: () => actions.duplicateDoc(doc.id) },
    {
      kind: 'submenu',
      label: t.C.mergeWith,
      disabled: app.store.state.docs.length < 2,
      items: () => mergeWithItems(ctx, doc.id),
    },
    {
      label: cuts > 0 ? t.splitAtCutsItem(cuts + 1) : t.C.splitCuts,
      disabled: cuts === 0,
      run: () => actions.splitAtCuts(doc.id),
    },
    { label: t.C.clearCuts, disabled: cuts === 0, run: () => actions.clearCuts(doc.id) },
    SEP,
    {
      label: t.C.selectAll,
      disabled: doc.pages.length === 0,
      run: () => actions.selectAll(doc.id),
    },
    {
      label: t.C.pasteStart,
      disabled: !app.store.clipboard,
      run: () => actions.pasteAt(doc.id, 0),
    },
    {
      label: t.C.pasteEnd,
      disabled: !app.store.clipboard,
      run: () => actions.pasteAt(doc.id, doc.pages.length),
    },
    { label: t.C.append, run: () => app.openFiles(doc.id) },
    SEP,
    {
      label: t.PAGE_NUMBERS_ITEM,
      disabled: doc.pages.length === 0,
      run: () => app.pageNumbers(doc.id),
    },
    { label: t.STAMP_ITEM, disabled: doc.pages.length === 0, run: () => app.stamp(doc.id) },
    { label: t.REDACT_ITEM, disabled: doc.pages.length === 0, run: () => app.redact(doc.id) },
    { label: t.FORM_ITEM, disabled: !app.hasForm(doc.id), run: () => app.form(doc.id) },
    SEP,
    {
      label: app.folded(doc.id) ? t.C.unfold : t.C.fold,
      run: () => app.fold(doc.id, !app.folded(doc.id)),
    },
    {
      label: t.exportDocLabel(doc.name),
      disabled: doc.pages.length === 0 || !app.canSave(),
      run: () => app.saveDoc(doc.id),
    },
    { label: t.C.closeDoc, run: () => actions.closeDoc(doc.id) },
  ];
}

/** Kontextmenü der leeren Arbeitsfläche */
export function emptyMenu(ctx: MenuContext): MenuEntry[] {
  const { cmds, app } = ctx;
  const e = (id: string) => entry(cmds, id);
  const d = app.activeDoc();
  return [
    {
      label: d ? t.pasteEndOf(d.name) : t.C.paste,
      disabled: !app.store.clipboard || !d,
      run: () => d && app.actions.pasteAt(d.id, d.pages.length),
    },
    e('new-doc'),
    e('open'),
    SEP,
    e('select-everything'),
    e('select-none'),
    SEP,
    e('view-single'),
    e('zoom-fit'),
  ];
}

/** Gruppen der Werkzeugleiste */
export const TOOLBAR: readonly (readonly string[])[] = [
  ['open', 'save-doc'],
  ['undo', 'redo'],
  ['tool-select', 'tool-scissors'],
  ['rotate-left', 'rotate-right', 'duplicate', 'blank', 'delete'],
  ['cut-toggle', 'split-cuts', 'merge'],
  ['page-numbers', 'stamp', 'signature', 'redact', 'form'],
  ['view-grid', 'view-single'],
  ['panel-left', 'panel-right'],
];

/** Gruppen der Tastenkürzel-Übersicht */
export const SHORTCUT_GROUPS: readonly { id: string; label: string }[] = [
  { id: 'file', label: t.M.file },
  { id: 'edit', label: t.M.edit },
  { id: 'select', label: t.C.selectGroup },
  { id: 'page', label: t.M.page },
  { id: 'doc', label: t.M.doc },
  { id: 'tools', label: t.M.tools },
  { id: 'view', label: t.M.view },
  { id: 'help', label: t.M.help },
];
