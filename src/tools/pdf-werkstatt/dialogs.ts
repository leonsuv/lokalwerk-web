/**
 * Dialoge der PDF-Werkstatt mit dem nativen <dialog> (modal: Fokus bleibt im Dialog, Esc
 * schließt, danach kehrt der Fokus zurück):
 * - „Verschieben nach …“ (Taste M, Kontextmenü, auf dem Handy statt Ziehen; W5, W10)
 * - Übersicht der Tastenkürzel („?“, W5), Zusammenführen mit Reihenfolge, kleine Eingaben
 */

import type { DocId, PageKey, WorkshopState } from '../../core/workshop/model.ts';
import { selectionSummary, selectKeys } from '../../core/workshop/selection.ts';
import { $ } from '../../ui/dom.ts';
import { shortcutLabel } from './shortcuts.ts';
import {
  AFTER_PAGE_INVALID,
  GRID_KEYS,
  GRID_KEYS_TITLE,
  MERGE_TOO_FEW,
  mergeOrderMoved,
  moveSubtitle,
  orderDown,
  orderUp,
  pages,
  SHORTCUTS_SUB,
} from './texts.ts';
import type { Cmd } from './ui-commands.ts';

export interface MoveChoice {
  doc: DocId;
  index: number;
}

/**
 * „Verschieben nach …“: Zieldokument und Position (Anfang, Ende, nach Seite n). Ruft `onMove`
 * mit der Einfügestelle wie bei movePages auf.
 */
export class MoveDialog {
  private readonly dialog = $<HTMLDialogElement>('#ws-move');
  private readonly docs = $('#ws-move-docs');
  private readonly after = $<HTMLInputElement>('#ws-move-after-page');
  private readonly error = $('#ws-move-error');
  private keys: readonly PageKey[] = [];
  private state: WorkshopState | null = null;

  constructor(private readonly onMove: (keys: readonly PageKey[], choice: MoveChoice) => void) {
    this.dialog.addEventListener('submit', (event) => {
      const submitter = event.submitter as HTMLButtonElement | null;
      if (submitter?.value !== 'ok') return;
      const choice = this.choice();
      if (!choice) {
        event.preventDefault();
        return;
      }
      this.onMove(this.keys, choice);
    });
    // Abbrechen ist kein Absende-Knopf: Eingabe im Dialog löst immer „Verschieben“ aus.
    $('#ws-move-cancel').addEventListener('click', () => this.dialog.close());
    this.after.addEventListener('focus', () => {
      $<HTMLInputElement>('#ws-move-pos-after').checked = true;
    });
    // Eingabe auf einem Auswahlknopf sendet in Browsern nicht ab; hier schon, wie im Zahlenfeld
    this.dialog.addEventListener('keydown', (event) => {
      const target = event.target as HTMLInputElement;
      if (event.key !== 'Enter' || target.type !== 'radio') return;
      event.preventDefault();
      this.dialog.querySelector('form')?.requestSubmit($<HTMLButtonElement>('#ws-move-ok'));
    });
    this.dialog.addEventListener('change', (event) => {
      if ((event.target as HTMLInputElement).name === 'ws-move-doc') this.updateMax();
    });
  }

  open(state: WorkshopState, keys: readonly PageKey[]): void {
    this.state = state;
    this.keys = keys;
    const summary = selectionSummary(state, selectKeys(keys));
    $('#ws-move-sub').textContent = moveSubtitle(summary.pages, summary.docs);
    // Vorauswahl: das erste Dokument, das keine der Seiten enthält, sonst das erste
    const moving = new Set(keys);
    const other = state.docs.find((d) => !d.pages.some((p) => moving.has(p.key)));
    const preselect = (other ?? state.docs[0])?.id;
    this.docs.replaceChildren(
      ...state.docs.map((doc) => {
        const label = document.createElement('label');
        label.className = 'ws-radio';
        const input = document.createElement('input');
        input.type = 'radio';
        input.name = 'ws-move-doc';
        input.value = doc.id;
        input.checked = doc.id === preselect;
        const name = document.createElement('span');
        name.textContent = doc.name;
        const count = document.createElement('span');
        count.className = 'ws-count';
        count.textContent = pages(doc.pages.length);
        label.append(input, name, count);
        return label;
      }),
    );
    $<HTMLInputElement>('#ws-move-pos-end').checked = true;
    this.after.value = '';
    this.error.textContent = '';
    this.updateMax();
    this.dialog.showModal();
  }

  private selectedDoc(): DocId | null {
    return (
      this.dialog.querySelector<HTMLInputElement>('input[name="ws-move-doc"]:checked')?.value ??
      null
    );
  }

  private updateMax(): void {
    const id = this.selectedDoc();
    const doc = this.state?.docs.find((d) => d.id === id);
    this.after.max = String(doc?.pages.length ?? 0);
  }

  private choice(): MoveChoice | null {
    const id = this.selectedDoc();
    const doc = this.state?.docs.find((d) => d.id === id);
    if (!doc) return null;
    const position = this.dialog.querySelector<HTMLInputElement>(
      'input[name="ws-move-pos"]:checked',
    )?.value;
    if (position === 'start') return { doc: doc.id, index: 0 };
    if (position === 'after') {
      const n = Number(this.after.value);
      if (!Number.isInteger(n) || n < 1 || n > doc.pages.length) {
        this.error.textContent = AFTER_PAGE_INVALID(doc.pages.length);
        this.after.focus();
        return null;
      }
      return { doc: doc.id, index: n };
    }
    return { doc: doc.id, index: doc.pages.length };
  }
}

/** Übersicht der Tastenkürzel, aus der Befehlsliste gebaut (texts.ts KEY für Mac und Windows) */
export class ShortcutsDialog {
  private readonly dialog = $<HTMLDialogElement>('#ws-keys');

  constructor(
    private readonly groups: readonly { id: string; label: string }[],
    private readonly cmds: () => Iterable<Cmd>,
  ) {}

  open(): void {
    $('#ws-keys-sub').textContent = SHORTCUTS_SUB;
    const list = $('#ws-keys-list');
    const all = [...this.cmds()];
    const sections = [...this.groups, { id: 'grid', label: GRID_KEYS_TITLE }].map((group) => {
      const rows: [string, string][] =
        group.id === 'grid'
          ? GRID_KEYS.map(([keys, label]): [string, string] => [keys, label])
          : all
              .filter((c) => c.group === group.id && c.keys?.length)
              .map((c) => [
                (c.keys ?? []).map(shortcutLabel).join(' / '),
                typeof c.label === 'function' ? c.label() : c.label,
              ]);
      if (rows.length === 0) return null;
      const section = document.createElement('section');
      const h = document.createElement('h3');
      h.textContent = group.label;
      const table = document.createElement('table');
      table.className = 'ws-keys';
      const body = document.createElement('tbody');
      for (const [keys, label] of rows) {
        const tr = document.createElement('tr');
        const k = document.createElement('td');
        const kbd = document.createElement('kbd');
        kbd.textContent = keys;
        k.append(kbd);
        const l = document.createElement('td');
        l.textContent = label;
        tr.append(k, l);
        body.append(tr);
      }
      table.append(body);
      section.append(h, table);
      return section;
    });
    list.replaceChildren(...sections.filter((s): s is HTMLElement => s !== null));
    this.dialog.showModal();
  }
}

/**
 * Zusammenführen: Dokumente ankreuzen (Vorgabe: alle oder die vorgegebenen) und mit den Pfeilen
 * ordnen; zusammengeführt wird in dieser Reihenfolge in das erste angekreuzte.
 */
export class MergeDialog {
  private readonly dialog = $<HTMLDialogElement>('#ws-merge');
  private readonly list = $('#ws-merge-docs');
  private readonly error = $('#ws-merge-error');

  constructor(private readonly onMerge: (docs: DocId[]) => void) {
    $('#ws-merge-cancel').addEventListener('click', () => this.dialog.close());
    this.dialog.addEventListener('submit', (event) => {
      const docs = [
        ...this.list.querySelectorAll<HTMLInputElement>('input[type="checkbox"]:checked'),
      ].map((input) => input.value);
      if (docs.length < 2) {
        event.preventDefault();
        this.error.textContent = MERGE_TOO_FEW;
        return;
      }
      this.onMerge(docs);
    });
    this.list.addEventListener('click', (event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>('button[data-dir]');
      const row = button?.closest<HTMLElement>('.ws-order-row');
      if (!button || !row) return;
      const up = button.dataset.dir === 'up';
      const other = up ? row.previousElementSibling : row.nextElementSibling;
      if (!other) return;
      if (up) other.before(row);
      else other.after(row);
      this.updateButtons();
      button.focus();
      const name = row.querySelector('.ws-order-name')?.textContent ?? '';
      const position = [...this.list.children].indexOf(row) + 1;
      $('#ws-live').textContent = mergeOrderMoved(name, position);
    });
  }

  private updateButtons(): void {
    const rows = [...this.list.children];
    rows.forEach((row, i) => {
      const up = row.querySelector<HTMLButtonElement>('[data-dir="up"]');
      const down = row.querySelector<HTMLButtonElement>('[data-dir="down"]');
      if (up) up.disabled = i === 0;
      if (down) down.disabled = i === rows.length - 1;
      const n = row.querySelector('.ws-order-n');
      if (n) n.textContent = String(i + 1);
    });
  }

  open(state: WorkshopState, preselect?: readonly DocId[]): void {
    this.error.textContent = '';
    // Vorgegebene zuerst, in ihrer Reihenfolge
    const order = preselect?.length
      ? [
          ...preselect.flatMap((id) => state.docs.find((d) => d.id === id) ?? []),
          ...state.docs.filter((d) => !preselect.includes(d.id)),
        ]
      : state.docs;
    this.list.replaceChildren(
      ...order.map((doc) => {
        const row = document.createElement('div');
        row.className = 'ws-order-row';
        const n = document.createElement('span');
        n.className = 'ws-order-n';
        n.setAttribute('aria-hidden', 'true');
        const label = document.createElement('label');
        label.className = 'ws-radio';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.value = doc.id;
        input.checked = preselect && preselect.length > 1 ? preselect.includes(doc.id) : true;
        const name = document.createElement('span');
        name.className = 'ws-order-name';
        name.textContent = doc.name;
        const count = document.createElement('span');
        count.className = 'ws-count';
        count.textContent = pages(doc.pages.length);
        label.append(input, name, count);
        const up = document.createElement('button');
        up.type = 'button';
        up.className = 'btn icon';
        up.dataset.dir = 'up';
        up.setAttribute('aria-label', orderUp(doc.name));
        // Festes Markup ohne Nutzerdaten
        up.innerHTML = '<svg width="16" height="16" aria-hidden="true"><use href="#i-up" /></svg>';
        const down = document.createElement('button');
        down.type = 'button';
        down.className = 'btn icon';
        down.dataset.dir = 'down';
        down.setAttribute('aria-label', orderDown(doc.name));
        // Festes Markup ohne Nutzerdaten
        down.innerHTML =
          '<svg width="16" height="16" aria-hidden="true"><use href="#i-down" /></svg>';
        row.append(n, label, up, down);
        return row;
      }),
    );
    this.updateButtons();
    this.dialog.showModal();
  }
}

/**
 * Kleine Eingabe (Gehe zu Seite, Seiten auswählen): `check` liefert eine Fehlermeldung oder null.
 */
export class AskDialog {
  private readonly dialog = $<HTMLDialogElement>('#ws-ask');
  private readonly input = $<HTMLInputElement>('#ws-ask-input');
  private readonly error = $('#ws-ask-error');
  private submit: ((value: string) => string | null) | null = null;

  constructor() {
    $('#ws-ask-cancel').addEventListener('click', () => this.dialog.close());
    this.dialog.addEventListener('submit', (event) => {
      const message = this.submit?.(this.input.value.trim()) ?? null;
      if (message) {
        event.preventDefault();
        this.error.textContent = message;
        this.input.setAttribute('aria-invalid', 'true');
        this.input.focus();
      }
    });
  }

  open(options: {
    title: string;
    sub: string;
    label: string;
    ok: string;
    value?: string;
    inputMode?: 'numeric' | 'text';
    submit: (value: string) => string | null;
  }): void {
    $('#ws-ask-title').textContent = options.title;
    $('#ws-ask-sub').textContent = options.sub;
    $('#ws-ask-label').textContent = options.label;
    $('#ws-ask-ok').textContent = options.ok;
    this.input.value = options.value ?? '';
    this.input.inputMode = options.inputMode ?? 'text';
    this.input.removeAttribute('aria-invalid');
    this.error.textContent = '';
    this.submit = options.submit;
    this.dialog.showModal();
    this.input.select();
  }
}
