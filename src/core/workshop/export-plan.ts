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
  signaturesOf,
  stampOf,
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

/** Zusatz im Dateinamen geschwärzter Dokumente (Text freigegeben von Leon am 27.09.2026) */
export const REDACTED_SUFFIX = ' (geschwärzt)';

/**
 * Dateiname beim Speichern: Name + .pdf; ein geschwärztes Dokument, das seitdem nicht umbenannt
 * wurde, als „<Name> (geschwärzt).pdf“, solange alle seine Seiten geschwärzt oder leer sind.
 */
export function docFileName(state: WorkshopState, doc: Doc): string {
  const redacted =
    doc.redacted === true &&
    doc.pages.every(
      (p) => p.kind === 'blank' || state.sources.get(p.source)?.origin?.kind === 'redacted',
    );
  return pdfFileName(
    redacted ? `${pdfFileName(doc.name).slice(0, -4)}${REDACTED_SUFFIX}` : doc.name,
  );
}

/** Seitengröße einer Bildquelle, gleich wie beim Export (DIN A4 nach Ausrichtung, 1 cm Rand) */
export function imagePageBox(imageWidth: number, imageHeight: number): PageBox {
  const { pageWidth, pageHeight } = imagePagePlacement(imageWidth, imageHeight);
  return { width: pageWidth, height: pageHeight };
}

function toAssemblePage(page: PageRef): AssemblePage {
  const base: AssemblePage =
    page.kind === 'source'
      ? { kind: 'source', source: page.source, index: page.index, rotate: page.rotate }
      : { kind: 'blank', width: page.box.width, height: page.box.height, rotate: page.rotate };
  const stamp = stampOf(page);
  if (stamp) base.stamp = stamp;
  const signatures = signaturesOf(page);
  if (signatures.length > 0) {
    base.signatures = signatures.map((s) => ({
      id: s.image.id,
      png: s.image.png,
      rect: s.rect,
      turn: s.turn,
    }));
  }
  return base;
}

/** Einstellungen beim Speichern (Schritt 2.4) */
export interface ExportOptions {
  /**
   * Versteckte Angaben entfernen: Jedes Dokument wird neu zusammengesetzt (auch ein
   * unverändertes, dessen Originaldatei Angaben und frühere Speicherstände enthalten kann),
   * die Seiten ohne eigene Metadaten.
   */
  strip?: boolean;
}

/** Was ein Einzelwerkzeug der Werkstatt bei der Übergabe mitgibt (workshop-link.ts) */
export interface WorkshopHandover {
  /** „PDF-Metadaten entfernen“: in der Werkstatt ist „Entfernen“ vorausgewählt */
  stripMetadata?: boolean;
}

/**
 * Einstellung beim Speichern nach einer Übergabe (M6, Leon 27.09.2026): „Entfernen“ nur aus
 * „PDF-Metadaten entfernen“, bei allen anderen Übergaben „Behalten“. Umstellbar bleibt sie.
 */
export function exportOptionsFor(handover: WorkshopHandover = {}): ExportOptions {
  return { strip: handover.stripMetadata === true };
}

/** Wird das Dokument als Originaldatei ausgegeben (W12)? Nicht, wenn Angaben entfernt werden. */
function originalOf(state: WorkshopState, doc: Doc, options: ExportOptions) {
  return options.strip ? null : unchangedSource(state, doc);
}

function planDoc(
  state: WorkshopState,
  doc: Doc,
  name: string,
  options: ExportOptions,
): AssembleDoc {
  const original = originalOf(state, doc, options);
  const plan: AssembleDoc = { name, pages: doc.pages.map(toAssemblePage) };
  const numbers = pageNumbersOf(doc);
  if (numbers) plan.numbers = numbers;
  if (options.strip) plan.strip = true;
  return original ? { ...plan, original: original.id } : plan;
}

/**
 * Dokumente in der Reihenfolge der Spalten. Gleiche Dateinamen werden mit „(2)“, „(3)“ usw.
 * unterschieden (W11). Leere Dokumente werden übersprungen.
 */
export function exportPlan(
  state: WorkshopState,
  docIds: Iterable<DocId>,
  options: ExportOptions = {},
): AssembleDoc[] {
  const wanted = new Set(docIds);
  const docs = state.docs.filter((d) => wanted.has(d.id) && d.pages.length > 0);
  const names = uniqueNames(docs.map((d) => docFileName(state, d)));
  return docs.map((doc, i) => planDoc(state, doc, names[i] ?? docFileName(state, doc), options));
}

/** „Auswahl als neue PDF“: ausgewählte Seiten in der Reihenfolge der Spalten */
export function selectionPlan(
  state: WorkshopState,
  keys: Iterable<PageKey>,
  name: string,
  options: ExportOptions = {},
): AssembleDoc | null {
  const pages = inPageOrder(state, keys);
  if (pages.length === 0) return null;
  return planDoc(state, { id: '', name, pages }, pdfFileName(name), options);
}

/**
 * Was beim Neuzusammensetzen verloren geht, zusammengefasst über die Quellen der Dokumente
 * (Hinweise vor dem Export). Unverändert ausgegebene Dokumente behalten alles und zählen nicht.
 */
export function lossFacts(
  state: WorkshopState,
  docIds: Iterable<DocId>,
  options: ExportOptions = {},
): Pick<SourceFacts, 'form' | 'xfa' | 'outline' | 'signed'> {
  const facts = { form: false, xfa: false, outline: false, signed: false };
  const wanted = new Set(docIds);
  for (const doc of state.docs) {
    if (!wanted.has(doc.id) || originalOf(state, doc, options)) continue;
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

/**
 * Dokumente, deren gespeicherte Datei versteckte Angaben behält (Hinweis, Schritt 2.4): als
 * Originaldatei ausgegeben mit Angaben im Dokument oder auf Seiten, neu zusammengesetzt mit
 * Seiten, die eigene Metadaten haben. Mit „Versteckte Angaben entfernen“ keines.
 */
export function metadataKept(
  state: WorkshopState,
  docs: readonly Doc[],
  options: ExportOptions = {},
): Doc[] {
  if (options.strip) return [];
  return docs.filter((doc) => {
    if (doc.pages.length === 0) return false;
    const original = originalOf(state, doc, options);
    if (original) return original.facts.metadata || original.facts.pageMetadata;
    return doc.pages.some(
      (p) => p.kind === 'source' && state.sources.get(p.source)?.facts.pageMetadata === true,
    );
  });
}
