/**
 * Eingebettete Werkzeuge in der PDF-Werkstatt (plan-phase3.md Stufe 2, Schritt 2.1). Das
 * Werkzeug erscheint in der rechten Spalte an Stelle der Übersicht und wirkt auf ein Dokument.
 * Schnittstelle: src/ui/tool-host.ts. Esc oder „Abbrechen“ schließt ohne Änderung; der Fokus
 * geht zurück an das Element, das das Werkzeug geöffnet hat.
 */

import { pageIndices, rangesFromPages } from '../../core/pdf/page-ranges.ts';
import {
  setPageNumbers,
  setSignatures,
  setStamp,
  turnedRect,
} from '../../core/workshop/commands.ts';
import {
  findDoc,
  indexPages,
  pageNumbersOf,
  signaturesOf,
  stampOf,
  type Doc,
  type DocId,
  type IdSource,
  type PageKey,
} from '../../core/workshop/model.ts';
import { $ } from '../../ui/dom.ts';
import type { EmbeddedTool, MountTool, ToolHost } from '../../ui/tool-host.ts';
import { mountPageNumbers } from '../pdf-seitenzahlen/embed.ts';
import { stampTool } from '../pdf-stempel/embed.ts';
import { signatureTool } from '../pdf-unterschreiben/embed.ts';
import type { SignDialog } from './sign-dialog.ts';
import type { WorkshopStore } from './store.ts';
import * as t from './texts.ts';

export class ToolPanel {
  private readonly overview = $('#ws-overview');
  private readonly section = $('#ws-tool');
  private readonly title = $('#ws-tool-title');
  private readonly docLine = $('#ws-tool-doc');
  private readonly body = $('#ws-tool-body');
  private doc: DocId | null = null;
  private returnFocus: HTMLElement | null = null;
  private tool: EmbeddedTool | null = null;
  /** Zeile unter der Überschrift; null, wenn das Ziel nicht mehr existiert (dann schließen) */
  private line: () => string | null = () => null;

  /**
   * `focusDoc` setzt den Fokus in die Spalte des Dokuments, wenn das Element, das das Werkzeug
   * geöffnet hat, danach nicht mehr sichtbar ist (z. B. der Knopf im Spaltenkopf nach
   * „Seitenzahlen entfernen“).
   */
  constructor(
    private readonly store: WorkshopStore,
    private readonly announce: (message: string) => void,
    private readonly focusDoc: (doc: DocId) => void,
    /** Zeichenvorrat der Stempelschrift aus dem Werkstatt-Worker */
    private readonly charset: Promise<ReadonlySet<number>>,
    private readonly signDialog: SignDialog,
    private readonly ids: IdSource,
    private readonly notify: (message: string) => void,
  ) {
    this.section.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      this.close();
    });
  }

  get open(): boolean {
    return this.doc !== null;
  }

  /** Seitenzahlen für das Dokument setzen, ändern oder entfernen */
  pageNumbers(doc: DocId, returnFocus: HTMLElement | null): void {
    this.show(doc, returnFocus, t.PAGE_NUMBERS_TITLE, mountPageNumbers, pageNumbersOf, (result) => {
      const name = findDoc(this.store.state, doc)?.name ?? '';
      const before = this.store.state;
      this.store.run(setPageNumbers(doc, result));
      if (this.store.state === before) return;
      this.announce(result ? t.pageNumbersSet(name) : t.pageNumbersRemoved(name));
    });
  }

  /**
   * Stempel für Seiten des Dokuments. Das Feld „Seiten“ ist mit den ausgewählten Seiten dieses
   * Dokuments vorbelegt, sonst leer (alle Seiten).
   */
  stamp(doc: DocId, returnFocus: HTMLElement | null): void {
    const target = findDoc(this.store.state, doc);
    if (!target) return;
    const selected = this.store.selection.keys;
    const pages = rangesFromPages(
      target.pages.flatMap((p, i) => (selected.has(p.key) ? [i + 1] : [])),
    );
    const existing = target.pages.map(stampOf).find((s) => s !== null) ?? null;
    this.show(
      doc,
      returnFocus,
      t.STAMP_TITLE,
      stampTool({ charset: this.charset, pages }),
      () => (existing ? { look: existing, ranges: [] } : null),
      (result) => {
        const current = findDoc(this.store.state, doc);
        if (!current) return;
        if (result === null) {
          const before = this.store.state;
          this.store.run(
            setStamp(
              current.pages.map((p) => p.key),
              null,
            ),
          );
          if (this.store.state !== before) this.announce(t.stampRemoved(current.name));
          return;
        }
        const indices =
          result.ranges.length === 0
            ? current.pages.map((_, i) => i)
            : [...new Set(result.ranges.flatMap(pageIndices))];
        const keys = indices.flatMap((i) => current.pages[i]?.key ?? []);
        const before = this.store.state;
        this.store.run(setStamp(keys, result.look));
        if (this.store.state !== before) this.announce(t.stampSet(keys.length, current.name));
      },
    );
  }

  /**
   * Unterschrift auf eine Seite: erstellen in der rechten Spalte, platzieren im Dialog. Eine
   * Seite je Durchgang; vorhandene Unterschriften der Seite lassen sich verschieben oder
   * entfernen.
   */
  signature(key: PageKey, returnFocus: HTMLElement | null): void {
    const at = indexPages(this.store.state).get(key);
    if (!at) return;
    const where = () => {
      const now = indexPages(this.store.state).get(key);
      return now ? { n: now.pageIndex + 1, name: now.doc.name, page: now.page } : null;
    };
    const n = at.pageIndex + 1;
    const existing = signaturesOf(at.page);
    this.show(
      at.doc.id,
      returnFocus,
      t.SIGN_TITLE,
      signatureTool({
        labels: {
          place: t.signPlace(n),
          remove: t.signRemove(n),
          needed: t.SIGN_NEEDED,
          hint: t.SIGN_HINT,
        },
        newId: () => this.ids('g'),
        place: (image, rects) => this.signDialog.open(key, image, rects),
        notify: this.notify,
      }),
      () => {
        const first = existing[0];
        return first
          ? {
              image: first.image,
              // So, wie die Seite jetzt angezeigt wird (sie kann seit dem Setzen gedreht sein)
              rects: existing.map((s) => turnedRect(s.rect, at.page.rotate - s.turn)),
            }
          : null;
      },
      (result) => {
        const now = where();
        if (!now) return;
        const before = this.store.state;
        this.store.run(setSignatures(key, result?.image ?? null, result?.rects ?? []));
        if (this.store.state === before) return;
        this.announce(
          result?.rects.length ? t.signSet(now.n, now.name) : t.signRemoved(now.n, now.name),
        );
      },
      () => {
        const now = where();
        return now ? t.signDoc(now.n, now.name) : null;
      },
    );
  }

  /** Nach jeder Änderung: Zeile aktuell halten, schließen, wenn das Ziel weg ist */
  refresh(): void {
    if (this.doc === null) return;
    const line = this.line();
    if (line === null) {
      this.close();
      return;
    }
    this.docLine.textContent = line;
  }

  close(): void {
    const doc = this.doc;
    if (doc === null) return;
    this.doc = null;
    this.tool?.dispose?.();
    this.tool = null;
    this.body.replaceChildren();
    this.section.hidden = true;
    this.overview.hidden = false;
    const target = this.returnFocus;
    this.returnFocus = null;
    if (target && target.getClientRects().length > 0) target.focus();
    else if (findDoc(this.store.state, doc)) this.focusDoc(doc);
  }

  private show<Result>(
    id: DocId,
    returnFocus: HTMLElement | null,
    title: string,
    mount: MountTool<Result>,
    current: (doc: Doc) => Result | null,
    apply: (result: Result | null) => void,
    line: () => string | null = () => {
      const now = findDoc(this.store.state, id);
      return now ? t.toolDoc(now.name, now.pages.length) : null;
    },
  ): void {
    const doc = findDoc(this.store.state, id);
    if (!doc) return;
    this.close();
    this.doc = id;
    this.line = line;
    this.returnFocus = returnFocus;
    const store = this.store;
    const host: ToolHost<Result> = {
      root: this.body,
      // Seitenzahl immer aktuell: Das Dokument kann sich ändern, solange das Werkzeug offen ist.
      target: {
        name: doc.name,
        get pages() {
          return findDoc(store.state, id)?.pages.length ?? 0;
        },
      },
      current: current(doc),
      // Erst übernehmen, dann schließen: Der Fokus geht an ein Element, das es danach noch gibt.
      apply: (result) => {
        apply(result);
        this.close();
      },
      cancel: () => this.close(),
    };
    this.title.textContent = title;
    this.docLine.textContent = line() ?? '';
    this.overview.hidden = true;
    this.section.hidden = false;
    const tool = mount(host);
    this.tool = tool;
    // Auf dem Handy steht die rechte Spalte unter den Seiten: dorthin scrollen, Überschrift
    // sichtbar unter der festen Kopfzeile (scroll-margin-top in components.css).
    const top = this.section.getBoundingClientRect().top;
    if (top < 0 || top > window.innerHeight / 2) this.section.scrollIntoView({ block: 'start' });
    tool.focus();
  }
}
