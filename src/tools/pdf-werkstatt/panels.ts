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

function row(label: string, value: string): HTMLElement {
  const r = el('div', 'stat-row');
  r.append(el('span', '', label), el('b', '', value));
  return r;
}

/** Aufklappbarer Abschnitt; offen/zu bleibt über Neuaufbauten erhalten */
function details(
  id: string,
  title: string,
  open: ReadonlyMap<string, boolean>,
): HTMLDetailsElement {
  const d = el('details', 'ws-prop');
  d.dataset.section = id;
  d.open = open.get(id) ?? true;
  const s = el('summary', '', title);
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

    // Auswahl
    const sel = details('selection', t.P.selection, this.open);
    if (summary.pages > 0) {
      sel.append(row(t.P.selected, t.moveSubtitle(summary.pages, summary.docs)));
      const actions = el('div', 'ws-prop-actions');
      actions.append(
        cmdButton('rotate-left', t.C.rotateLeft, 'i-rotate-left'),
        cmdButton('rotate-right', t.C.rotateRight, 'i-rotate-right'),
        cmdButton('duplicate', t.C.duplicate, 'i-copy'),
        cmdButton('reverse', t.C.reverse, 'i-reverse'),
        cmdButton('extract', t.C.extract, 'i-pdf'),
        cmdButton('delete', t.C.delete, 'i-x'),
      );
      const reverse = actions.querySelector<HTMLButtonElement>('[data-cmd="reverse"]');
      if (reverse) reverse.disabled = summary.pages < 2;
      sel.append(actions);
      const save = cmdButton('save-selection', t.C.saveSelection, null, 'btn ghost wide mt-s');
      save.disabled = p.busy;
      sel.append(save);
    } else {
      sel.append(el('p', 'hint', t.P.noSelection));
    }
    parts.push(sel);

    // Seite
    if (at) {
      const page = details('page', t.P.page, this.open);
      const { page: ref, pageIndex } = at;
      page.append(row(t.P.position, t.pageOfDoc(pageIndex + 1, at.doc.pages.length, at.doc.name)));
      if (ref.kind === 'source') {
        const source = state.sources.get(ref.source);
        if (source) {
          page.append(
            row(
              t.P.source,
              source.kind === 'image' ? source.name : t.sourcePage(source.name, ref.index + 1),
            ),
          );
        }
      } else {
        page.append(row(t.P.source, t.P.blank));
      }
      const size = visiblePageSize(state, ref);
      page.append(row(t.P.size, t.sizeLabel(cm(size.width), cm(size.height))));
      page.append(row(t.P.rotation, t.degrees(ref.rotate)));
      const ops = [
        stampOf(ref) ? t.P.stamp : '',
        signaturesOf(ref).length ? t.signaturesCount(signaturesOf(ref).length) : '',
      ].filter(Boolean);
      if (ops.length > 0) page.append(row(t.P.ops, ops.join(', ')));
      const hasCut = (at.doc.cuts ?? []).includes(ref.key) && pageIndex > 0;
      page.append(row(t.P.cut, hasCut ? t.P.yes : t.P.no));
      const actions = el('div', 'ws-prop-actions');
      const cut = cmdButton('cut-toggle', hasCut ? t.C.cutRemoveHere : t.C.cutSetHere, null);
      cut.disabled = pageIndex === 0;
      const split = cmdButton('split-here', t.C.splitHere, null);
      split.disabled = pageIndex === 0;
      actions.append(cmdButton('open-single', t.C.openSingle, null), cut, split);
      page.append(actions);
      parts.push(page);
    }

    // Dokument
    const d = details('doc', t.P.doc, this.open);
    if (doc) {
      d.append(row(t.P.name, doc.name), row(t.P.pages, String(doc.pages.length)));
      const sources = new Set(doc.pages.flatMap((pg) => (pg.kind === 'source' ? [pg.source] : [])));
      const names = [...sources].flatMap((id) => state.sources.get(id)?.name ?? []);
      if (names.length > 0)
        d.append(
          row(t.P.files, names.length === 1 ? (names[0] ?? '') : t.filesCount(names.length)),
        );
      const numbers = pageNumbersOf(doc);
      d.append(row(t.PAGE_NUMBERS_TITLE, numbers ? t.P.yes : t.P.no));
      const cuts = cutIndices(doc).length;
      d.append(row(t.P.cuts, String(cuts)));
      const actions = el('div', 'ws-prop-actions');
      const split = cmdButton(
        'split-cuts',
        cuts > 0 ? t.splitAtCutsItem(cuts + 1) : t.C.splitCuts,
        null,
      );
      split.disabled = cuts === 0;
      actions.append(
        split,
        cmdButton('page-numbers', t.PAGE_NUMBERS_ITEM, null),
        cmdButton('rename', t.C.rename, null),
      );
      d.append(actions);
    } else {
      d.append(el('p', 'hint', t.P.noDoc));
    }
    parts.push(d);

    // Speichern
    const s = details('save', t.P.save, this.open);
    const field = el('div', 'field');
    const lbl = el('span', 'lbl', t.METADATA_LABEL);
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
    field.append(lbl, seg, el('p', 'hint', t.METADATA_HINT));
    s.append(field);
    const saveDoc = el('button', 'btn wide mt-m');
    saveDoc.type = 'button';
    saveDoc.dataset.cmd = 'save-doc';
    saveDoc.id = 'ws-export-doc';
    // Festes Markup ohne Nutzerdaten, der Name kommt als Text dazu
    saveDoc.innerHTML = icon('i-save', 18);
    saveDoc.append(el('span', '', t.exportDocLabel(doc?.name ?? t.C.docFallback)));
    saveDoc.disabled = p.busy || !doc || doc.pages.length === 0;
    const zip = cmdButton('save-all', t.C.saveAll, null, 'btn ghost wide mt-s');
    zip.id = 'ws-export-zip';
    zip.disabled = p.busy || !state.docs.some((x) => x.pages.length > 0);
    s.append(saveDoc, zip);
    if (kept.length > 0) s.append(note(t.metadataKeptNote(kept.map((x) => x.name))));
    if (loss.length > 0) s.append(note(t.lossNote(loss)));
    parts.push(s);

    // Werkzeug
    const w = details('tool', t.P.tool, this.open);
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
    w.append(tools, el('p', 'hint', p.tool === 'scissors' ? t.P.scissorsHint : t.P.selectHint));
    parts.push(w);

    this.props.replaceChildren(...parts);
    if (refocus) {
      const again = refocus.startsWith('meta-')
        ? this.props.querySelector<HTMLElement>(`[data-meta="${refocus.slice(5)}"]`)
        : this.props.querySelector<HTMLElement>(`[data-cmd="${refocus}"]`);
      again?.focus();
    }
  }

  private renderHistory(): void {
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
