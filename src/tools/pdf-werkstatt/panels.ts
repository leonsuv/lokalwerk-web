/**
 * Rechte Leiste und Statusleiste der PDF-Werkstatt (Umbau zum Editor):
 * - Eigenschaften in aufklappbaren Abschnitten: Auswahl, Seite, Dokument (samt Speichern und
 *   versteckten Angaben), aktives Werkzeug. Knöpfe mit `data-cmd` führen Befehle aus
 *   (ui-commands.ts).
 * - Verlauf: jeder Schritt ein Knopf, Klick springt dorthin (store.jump).
 * Neu aufgebaut wird nur, wenn sich der Inhalt ändert, damit der Fokus auf einem Knopf bleibt.
 */

import { formatBytes } from '../../core/format/bytes.ts';
import { metadataKept, type ExportOptions } from '../../core/workshop/export-plan.ts';
import {
  cutIndices,
  indexPages,
  MEMORY_HINT_BYTES,
  pageNumbersOf,
  signaturesOf,
  stampOf,
  totalSourceSize,
  visiblePageSize,
  type Doc,
  type WorkshopState,
} from '../../core/workshop/model.ts';
import { selectionSummary, type Selection } from '../../core/workshop/selection.ts';
import { $ } from '../../ui/dom.ts';
import { lossSources } from './export.ts';
import type { WorkshopStore } from './store.ts';
import * as t from './texts.ts';
import type { ToolMode } from './ui-commands.ts';

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = '',
  text = '',
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text) e.textContent = text;
  return e;
}

function icon(id: string, size = 16): string {
  return `<svg width="${size}" height="${size}" aria-hidden="true"><use href="#${id}" /></svg>`;
}

/** Knopf, der einen Befehl ausführt; nur Symbol, wenn `iconOnly` */
function cmdButton(
  cmd: string,
  label: string,
  iconId: string | null,
  className = 'btn ghost sm',
): HTMLButtonElement {
  const b = el('button', className);
  b.type = 'button';
  b.dataset.cmd = cmd;
  if (iconId) {
    // Festes Markup ohne Nutzerdaten
    b.innerHTML = icon(iconId);
    b.setAttribute('aria-label', label);
    b.dataset.tip = label;
  } else {
    b.textContent = label;
  }
  return b;
}

/** Symbolknopf in einer Reihe (wie in der Werkzeugleiste) */
function iconButton(
  cmd: string,
  label: string,
  iconId: string,
  disabled = false,
): HTMLButtonElement {
  const b = cmdButton(cmd, label, iconId, 'ws-tb');
  b.disabled = disabled;
  return b;
}

/** Bezeichnung und Wert, kompakt untereinander */
function facts(rows: readonly (readonly [string, string])[]): HTMLElement {
  const dl = el('dl', 'ws-kv');
  for (const [label, value] of rows) dl.append(el('dt', '', label), el('dd', '', value));
  return dl;
}

/** Aufklappbarer Abschnitt mit Titel und kurzer Angabe rechts; offen/zu bleibt erhalten */
function details(
  id: string,
  title: string,
  open: ReadonlyMap<string, boolean>,
  meta = '',
): HTMLDetailsElement {
  const d = el('details', 'ws-prop');
  d.dataset.section = id;
  d.open = open.get(id) ?? true;
  const s = el('summary');
  s.append(el('span', 'ws-prop-title', title));
  if (meta) s.append(el('span', 'ws-prop-meta', meta));
  d.append(s);
  return d;
}

const cm = (pt: number): string => ((pt / 72) * 2.54).toFixed(1).replace('.', ',');

export interface PanelState {
  state: WorkshopState;
  selection: Selection;
  doc: Doc | undefined;
  tool: ToolMode;
  options: ExportOptions;
  busy: boolean;
  dirty: boolean;
}

export class Panels {
  private readonly props = $('#ws-overview');
  private readonly history = $('#ws-history');
  private shownProps = '';
  private shownHistory = '';
  private readonly open = new Map<string, boolean>();

  constructor(
    private readonly store: WorkshopStore,
    run: (cmd: string) => void,
    meta: (strip: boolean) => void,
  ) {
    this.props.addEventListener('click', (event) => {
      const target = event.target as Element;
      const button = target.closest<HTMLButtonElement>('button[data-cmd]');
      if (button && !button.disabled) run(button.dataset.cmd ?? '');
      const metaButton = target.closest<HTMLButtonElement>('button[data-meta]');
      if (metaButton) meta(metaButton.dataset.meta === 'strip');
    });
    this.props.addEventListener(
      'toggle',
      (event) => {
        const d = event.target as HTMLDetailsElement;
        if (d.dataset.section) this.open.set(d.dataset.section, d.open);
      },
      true,
    );
    this.history.parentElement?.addEventListener('click', (event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>(
        '.ws-panel-head [data-cmd]',
      );
      if (button && !button.disabled) run(button.dataset.cmd ?? '');
    });
    this.history.addEventListener('click', (event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>('button[data-index]');
      if (button) this.store.jump(Number(button.dataset.index));
    });
  }

  render(p: PanelState): void {
    this.renderProps(p);
    this.renderHistory();
    this.renderStatus(p);
  }

  private renderProps(p: PanelState): void {
    const { state, selection, doc } = p;
    const summary = selectionSummary(state, selection);
    const at = selection.focus ? indexPages(state).get(selection.focus) : undefined;
    const kept = metadataKept(state, state.docs, p.options);
    const loss = lossSources(state, state.docs, p.options);
    // Nur neu aufbauen, wenn sich etwas Sichtbares geändert hat
    const key = JSON.stringify([
      summary,
      at ? [at.page, at.pageIndex, at.doc.pages.length, at.doc.name, at.doc.cuts] : null,
      doc ? [doc.id, doc.name, doc.pages.length, doc.ops, doc.cuts, doc.redacted] : null,
      p.tool,
      !!p.options.strip,
      p.busy,
      kept.map((d) => d.name),
      loss.map((s) => s.id),
      state.docs.length,
      !!this.store.clipboard,
    ]);
    if (key === this.shownProps) return;
    this.shownProps = key;
    const focusCmd = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>(
      '#ws-overview [data-cmd], #ws-overview [data-meta]',
    );
    const refocus =
      focusCmd?.dataset.cmd ?? (focusCmd?.dataset.meta ? `meta-${focusCmd.dataset.meta}` : null);

    const parts: HTMLElement[] = [];
    const hasDocs = state.docs.length > 0;

    // Auswahl
    const sel = details(
      'selection',
      t.P.selection,
      this.open,
      summary.pages > 0 ? t.moveSubtitle(summary.pages, summary.docs) : '',
    );
    if (summary.pages > 0) {
      const row = el('div', 'ws-prop-icons');
      row.setAttribute('role', 'group');
      row.setAttribute('aria-label', t.P.selectionActions);
      row.append(
        iconButton('rotate-left', t.C.rotateLeft, 'i-rotate-left'),
        iconButton('rotate-right', t.C.rotateRight, 'i-rotate-right'),
        iconButton('duplicate', t.C.duplicate, 'i-copy'),
        iconButton('reverse', t.C.reverse, 'i-reverse', summary.pages < 2),
        iconButton('extract', t.C.extract, 'i-pdf'),
        iconButton('delete', t.C.delete, 'i-x'),
      );
      const save = cmdButton('save-selection', t.C.saveSelection, null, 'btn ghost wide');
      save.disabled = p.busy;
      sel.append(row, save);
    } else {
      sel.append(el('p', 'ws-prop-hint', hasDocs ? t.P.noSelection : t.P.noDoc));
    }
    parts.push(sel);

    // Seite mit dem Fokus
    if (at) {
      const { page: ref, pageIndex } = at;
      const page = details(
        'page',
        t.P.page,
        this.open,
        t.pageOfDoc(pageIndex + 1, at.doc.pages.length, at.doc.name),
      );
      const source = ref.kind === 'source' ? state.sources.get(ref.source) : undefined;
      const size = visiblePageSize(state, ref);
      const ops = [
        stampOf(ref) ? t.P.stamp : '',
        signaturesOf(ref).length ? t.signaturesCount(signaturesOf(ref).length) : '',
      ].filter(Boolean);
      const hasCut = (at.doc.cuts ?? []).includes(ref.key) && pageIndex > 0;
      const rows: [string, string][] = [
        [
          t.P.source,
          ref.kind === 'blank'
            ? t.P.blank
            : source?.kind === 'image'
              ? source.name
              : t.sourcePage(source?.name ?? '', ref.kind === 'source' ? ref.index + 1 : 0),
        ],
        [t.P.size, t.sizeLabel(cm(size.width), cm(size.height))],
        [t.P.rotation, t.degrees(ref.rotate)],
      ];
      if (ops.length > 0) rows.push([t.P.ops, ops.join(', ')]);
      if (hasCut) rows.push([t.P.cut, t.P.yes]);
      page.append(facts(rows));
      const row = el('div', 'ws-prop-icons');
      row.setAttribute('role', 'group');
      row.setAttribute('aria-label', t.P.pageActions);
      const cut = iconButton(
        'cut-toggle',
        hasCut ? t.C.cutRemoveHere : t.C.cutSetHere,
        'i-cutline',
        pageIndex === 0,
      );
      cut.setAttribute('aria-pressed', String(hasCut));
      row.append(
        iconButton('open-single', t.C.openSingle, 'i-single'),
        cut,
        iconButton('split-here', t.C.splitHere, 'i-scissors', pageIndex === 0),
        iconButton('stamp', t.STAMP_ITEM, 'i-stamp'),
        iconButton('signature', t.SIGN_ITEM, 'i-sign'),
      );
      page.append(row);
      parts.push(page);
    }

    // Dokument, samt Speichern
    if (doc) {
      const cuts = cutIndices(doc).length;
      const d = details('doc', t.P.doc, this.open, doc.name);
      const sources = new Set(doc.pages.flatMap((pg) => (pg.kind === 'source' ? [pg.source] : [])));
      const names = [...sources].flatMap((id) => state.sources.get(id)?.name ?? []);
      const rows: [string, string][] = [[t.P.pages, String(doc.pages.length)]];
      if (names.length > 0) {
        rows.push([t.P.files, names.length === 1 ? (names[0] ?? '') : t.filesCount(names.length)]);
      }
      rows.push([t.PAGE_NUMBERS_TITLE, pageNumbersOf(doc) ? t.P.yes : t.P.no]);
      if (cuts > 0) rows.push([t.P.cuts, t.partsLabel(cuts + 1)]);
      d.append(facts(rows));
      const grid = el('div', 'ws-prop-buttons');
      grid.append(
        cmdButton('page-numbers', t.PAGE_NUMBERS_ITEM, null, 'btn ghost sm'),
        cmdButton('rename', t.C.rename, null, 'btn ghost sm'),
      );
      if (cuts > 0) {
        const split = cmdButton(
          'split-cuts',
          t.splitAtCutsItem(cuts + 1),
          null,
          'btn ghost sm span',
        );
        grid.append(split);
      }
      d.append(grid);
      const saveDoc = el('button', 'btn wide');
      saveDoc.type = 'button';
      saveDoc.dataset.cmd = 'save-doc';
      saveDoc.id = 'ws-export-doc';
      // Festes Markup ohne Nutzerdaten, der Name kommt als Text dazu
      saveDoc.innerHTML = icon('i-save', 18);
      saveDoc.append(el('span', '', t.exportDocLabel(doc.name)));
      saveDoc.disabled = p.busy || doc.pages.length === 0;
      d.append(saveDoc);
      parts.push(d);
    }

    // Speichern: Einstellung und Hinweise für alle Dokumente
    if (hasDocs) {
      const s = details('save', t.P.save, this.open);
      const zip = cmdButton('save-all', t.C.saveAll, null, 'btn ghost wide');
      zip.id = 'ws-export-zip';
      zip.disabled = p.busy || !state.docs.some((x) => x.pages.length > 0);
      const field = el('div', 'ws-prop-field');
      const lbl = el('span', 'ws-prop-label', t.METADATA_LABEL);
      lbl.id = 'ws-meta-label';
      const seg = el('div', 'seg');
      seg.setAttribute('role', 'group');
      seg.setAttribute('aria-labelledby', 'ws-meta-label');
      for (const [value, text] of [
        ['keep', t.METADATA_KEEP],
        ['strip', t.METADATA_STRIP],
      ] as const) {
        const b = el('button', '', text);
        b.type = 'button';
        b.dataset.meta = value;
        b.setAttribute('aria-pressed', String((value === 'strip') === !!p.options.strip));
        seg.append(b);
      }
      field.append(lbl, seg, el('p', 'ws-prop-hint', t.METADATA_HINT));
      s.append(zip, field);
      if (kept.length > 0) s.append(note(t.metadataKeptNote(kept.map((x) => x.name))));
      if (loss.length > 0) s.append(note(t.lossNote(loss)));
      parts.push(s);
    }

    // Werkzeug
    if (hasDocs) {
      const w = details(
        'tool',
        t.P.tool,
        this.open,
        p.tool === 'scissors' ? t.C.toolScissors : t.C.toolSelect,
      );
      const tools = el('div', 'seg');
      tools.setAttribute('role', 'group');
      tools.setAttribute('aria-label', t.P.tool);
      for (const [cmd, text] of [
        ['tool-select', t.C.toolSelect],
        ['tool-scissors', t.C.toolScissors],
      ] as const) {
        const b = el('button', '', text);
        b.type = 'button';
        b.dataset.cmd = cmd;
        b.setAttribute('aria-pressed', String(cmd === `tool-${p.tool}`));
        tools.append(b);
      }
      w.append(
        tools,
        el('p', 'ws-prop-hint', p.tool === 'scissors' ? t.P.scissorsHint : t.P.selectHint),
      );
      parts.push(w);
    }

    this.props.replaceChildren(...parts);
    if (refocus) {
      const again = refocus.startsWith('meta-')
        ? this.props.querySelector<HTMLElement>(`[data-meta="${refocus.slice(5)}"]`)
        : this.props.querySelector<HTMLElement>(`[data-cmd="${refocus}"]`);
      again?.focus();
    }
  }

  private renderHistory(): void {
    for (const b of document.querySelectorAll<HTMLButtonElement>('.ws-history [data-cmd]')) {
      b.disabled = b.dataset.cmd === 'undo' ? !this.store.canUndo : !this.store.canRedo;
    }
    const steps = this.store.timeline;
    const key = steps.map((s) => `${s.label}:${s.current ? 1 : 0}:${s.undone ? 1 : 0}`).join('|');
    if (key === this.shownHistory) return;
    this.shownHistory = key;
    const hadFocus = this.history.contains(document.activeElement);
    const items = steps.map((s) => {
      const li = el('li');
      const b = el('button', `ws-step${s.current ? ' current' : ''}${s.undone ? ' undone' : ''}`);
      b.type = 'button';
      b.dataset.index = String(s.index);
      b.textContent = s.label || t.HISTORY_START;
      if (s.current) b.setAttribute('aria-current', 'step');
      b.setAttribute(
        'aria-label',
        t.historyStepLabel(s.label || t.HISTORY_START, s.current, s.undone),
      );
      li.append(b);
      return li;
    });
    this.history.replaceChildren(...items);
    const current = this.history.querySelector<HTMLElement>('.current');
    // Nur die Liste scrollen, nicht die ganze Leiste
    if (current) {
      const list = this.history;
      const top = current.offsetTop - list.offsetTop;
      if (top < list.scrollTop || top + current.offsetHeight > list.scrollTop + list.clientHeight) {
        list.scrollTop = top - list.clientHeight / 2;
      }
    }
    if (hadFocus) current?.focus({ preventScroll: true });
    if (this.store.truncated) {
      const li = el('li', 'ws-step-note', t.HISTORY_TRUNCATED);
      this.history.prepend(li);
    }
  }

  private renderStatus(p: PanelState): void {
    const { state, selection } = p;
    const pageCount = state.docs.reduce((n, d) => n + d.pages.length, 0);
    $('#ws-st-pages').textContent =
      state.docs.length > 0 ? t.statusPages(pageCount, state.docs.length) : t.STATUS_EMPTY;
    const summary = selectionSummary(state, selection);
    $('#ws-st-selection').textContent =
      summary.pages > 0 ? t.selected(summary.pages, summary.docs) : '';
    $('#ws-st-saved').textContent =
      state.docs.length === 0 ? '' : p.dirty ? t.STATUS_DIRTY : t.STATUS_SAVED;
    $('#ws-st-saved').classList.toggle('dirty', p.dirty);
    const size = totalSourceSize(state.sources.values());
    const memory = $('#ws-memory');
    memory.hidden = size < MEMORY_HINT_BYTES;
    memory.textContent = size >= MEMORY_HINT_BYTES ? t.memoryShort(formatBytes(size)) : '';
    memory.title = size >= MEMORY_HINT_BYTES ? t.memoryHint(size) : '';
  }
}

function note(text: string): HTMLElement {
  const p = el('p', 'ws-note');
  // Festes Markup ohne Nutzerdaten, der Hinweis kommt als Text dazu
  p.innerHTML = icon('i-info', 18);
  p.append(el('span', '', text));
  return p;
}
