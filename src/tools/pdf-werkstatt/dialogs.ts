/**
 * Dialoge der PDF-Werkstatt mit dem nativen <dialog> (modal: Fokus bleibt im Dialog, Esc
 * schließt, danach kehrt der Fokus zurück):
 * - „Verschieben nach …“ (Taste M, Kontextmenü, auf dem Handy statt Ziehen; W5, W10)
 * - Übersicht der Tastenkürzel („?“, W5)
 */

import type { DocId, PageKey, WorkshopState } from '../../core/workshop/model.ts';
import { selectionSummary, selectKeys } from '../../core/workshop/selection.ts';
import { $ } from '../../ui/dom.ts';
import { AFTER_PAGE_INVALID, combo, MERGE_TOO_FEW, moveSubtitle, pages } from './texts.ts';

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

/** Übersicht der Tastenkürzel; die Tasten passen sich dem Betriebssystem an (texts.ts KEY) */
export class ShortcutsDialog {
  private readonly dialog = $<HTMLDialogElement>('#ws-keys');

  constructor() {
    for (const kbd of this.dialog.querySelectorAll<HTMLElement>('kbd[data-combo]')) {
      kbd.textContent = combo(...(kbd.dataset.combo ?? '').split('|'));
    }
  }

  open(): void {
    this.dialog.showModal();
  }
}

/**
 * Zusammenführen: Dokumente ankreuzen (Vorgabe: alle); sie werden in der Reihenfolge der
 * Spalten an das erste angekreuzte angehängt.
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
  }

  open(state: WorkshopState, preselect?: readonly DocId[]): void {
    this.error.textContent = '';
    this.list.replaceChildren(
      ...state.docs.map((doc) => {
        const label = document.createElement('label');
        label.className = 'ws-radio';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.value = doc.id;
        input.checked = preselect ? preselect.includes(doc.id) : true;
        const name = document.createElement('span');
        name.textContent = doc.name;
        const count = document.createElement('span');
        count.className = 'ws-count';
        count.textContent = pages(doc.pages.length);
        label.append(input, name, count);
        return label;
      }),
    );
    this.dialog.showModal();
  }
}
