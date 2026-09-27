/**
 * Export-Auftrag aus dem Zustand der PDF-Werkstatt (plan-phase3.md Abschnitt 9): nur Verweise,
 * keine Bytes. Der Worker setzt daraus mit assemble.ts die PDFs zusammen. Läuft im
 * Hauptthread; assemble.ts wird nur als Typ eingebunden, pdf-lib bleibt im Worker.
 */

import type { AssembleDoc, AssemblePage } from '../pdf/assemble.ts';
import { imagePagePlacement } from '../pdf/image-layout.ts';
import { uniqueNames } from '../zip/write.ts';
import {
  inPageOrder,
  pageNumbersOf,
  unchangedSource,
  type Doc,
  type DocId,
  type PageBox,
  type PageKey,
  type PageRef,
  type SourceFacts,
  type WorkshopState,
} from './model.ts';

/** Dateiname eines Dokuments: Name + .pdf, ohne doppelte Endung (W11) */
export function pdfFileName(name: string): string {
  const clean =
    name
      .trim()
      .replace(/\.pdf$/i, '')
      .trimEnd() || 'Dokument';
  return `${clean}.pdf`;
}

/** Seitengröße einer Bildquelle, gleich wie beim Export (DIN A4 nach Ausrichtung, 1 cm Rand) */
export function imagePageBox(imageWidth: number, imageHeight: number): PageBox {
  const { pageWidth, pageHeight } = imagePagePlacement(imageWidth, imageHeight);
  return { width: pageWidth, height: pageHeight };
}

function toAssemblePage(page: PageRef): AssemblePage {
  return page.kind === 'source'
    ? { kind: 'source', source: page.source, index: page.index, rotate: page.rotate }
    : { kind: 'blank', width: page.box.width, height: page.box.height, rotate: page.rotate };
}

function planDoc(state: WorkshopState, doc: Doc, name: string): AssembleDoc {
  const original = unchangedSource(state, doc);
  const plan: AssembleDoc = { name, pages: doc.pages.map(toAssemblePage) };
  const numbers = pageNumbersOf(doc);
  if (numbers) plan.numbers = numbers;
  return original ? { ...plan, original: original.id } : plan;
}

/**
 * Dokumente in der Reihenfolge der Spalten. Gleiche Dateinamen werden mit „(2)“, „(3)“ usw.
 * unterschieden (W11). Leere Dokumente werden übersprungen.
 */
export function exportPlan(state: WorkshopState, docIds: Iterable<DocId>): AssembleDoc[] {
  const wanted = new Set(docIds);
  const docs = state.docs.filter((d) => wanted.has(d.id) && d.pages.length > 0);
  const names = uniqueNames(docs.map((d) => pdfFileName(d.name)));
  return docs.map((doc, i) => planDoc(state, doc, names[i] ?? pdfFileName(doc.name)));
}

/** „Auswahl als neue PDF“: ausgewählte Seiten in der Reihenfolge der Spalten */
export function selectionPlan(
  state: WorkshopState,
  keys: Iterable<PageKey>,
  name: string,
): AssembleDoc | null {
  const pages = inPageOrder(state, keys);
  if (pages.length === 0) return null;
  return planDoc(state, { id: '', name, pages }, pdfFileName(name));
}

/**
 * Was beim Neuzusammensetzen verloren geht, zusammengefasst über die Quellen der Dokumente
 * (Hinweise vor dem Export). Unverändert ausgegebene Dokumente behalten alles und zählen nicht.
 */
export function lossFacts(state: WorkshopState, docIds: Iterable<DocId>): SourceFacts {
  const facts: SourceFacts = { form: false, xfa: false, outline: false, signed: false };
  const wanted = new Set(docIds);
  for (const doc of state.docs) {
    if (!wanted.has(doc.id) || unchangedSource(state, doc)) continue;
    for (const page of doc.pages) {
      const source = page.kind === 'source' ? state.sources.get(page.source) : undefined;
      if (!source) continue;
      facts.form ||= source.facts.form;
      facts.xfa ||= source.facts.xfa;
      facts.outline ||= source.facts.outline;
      facts.signed ||= source.facts.signed;
    }
  }
  return facts;
}
