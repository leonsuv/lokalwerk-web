/**
 * Datenmodell der PDF-Werkstatt (plan-phase3.md Abschnitt 2). Ohne DOM und ohne pdf-lib, läuft
 * im Hauptthread und in Tests.
 *
 * Ein Dokument ist eine Liste von Seitenverweisen (Quelle, Seite, Drehung), die geladenen
 * Dateien werden nie verändert. Der Zustand ist unveränderlich: Befehle (commands.ts) erzeugen
 * neue Objekte und teilen unveränderte Teile mit dem alten Zustand.
 */

import { A4 } from '../pdf/image-layout.ts';
import type { NormRect } from '../geometry/norm-rect.ts';
import type { PageNumberOptions } from '../pdf/page-numbers.ts';
import type { StampOptions } from '../pdf/stamp.ts';
import { normalizeRotation, visibleSize, type PageRotation } from '../pdf/stamp-geometry.ts';

export type SourceId = string;
export type DocId = string;
/** Stabile ID eines Seitenverweises, auch bei Duplikaten eindeutig (Auswahl, DOM, Ansagen) */
export type PageKey = string;
export type Rotation = PageRotation;

/** Seitengröße in pt, wie in der Datei (ohne die eigene /Rotate der Seite) */
export interface PageBox {
  width: number;
  height: number;
}

/** Was beim Neuzusammensetzen verloren geht, für die Hinweise vor dem Export (Abschnitt 9) */
export interface SourceFacts {
  form: boolean;
  xfa: boolean;
  outline: boolean;
  signed: boolean;
  /** Versteckte Angaben im Dokument (Info, XMP, frühere Speicherstände), Schritt 2.4 */
  metadata: boolean;
  /** Eigene Metadaten einzelner Seiten; wandern beim Neuzusammensetzen mit */
  pageMetadata: boolean;
}

export const NO_FACTS: SourceFacts = {
  form: false,
  xfa: false,
  outline: false,
  signed: false,
  metadata: false,
  pageMetadata: false,
};

/**
 * Herkunft einer Quelle, die die Werkstatt selbst erzeugt hat („Einbacken“, Stufe 2.3):
 * geschwärzt (Seiten gerastert) oder Formular ausgefüllt, jeweils aus den Quellen `from`.
 */
export interface SourceOrigin {
  kind: 'redacted' | 'filled';
  from: readonly SourceId[];
}

/** Eine geladene Datei. Die Bytes liegen nur im Worker und bei pdf.js, nicht im Zustand. */
export interface Source {
  id: SourceId;
  kind: 'pdf' | 'image';
  /** Dateiname, nur zur Anzeige */
  name: string;
  /** Dateigröße in Byte, für den Speicherhinweis (Abschnitt 8) */
  size: number;
  /** Je Seite: Größe und eigene Drehung der Seite in der Datei. Bilder: eine Seite. */
  pages: readonly { box: PageBox; rotate: Rotation }[];
  facts: SourceFacts;
  /** Nur bei Quellen aus „Einbacken“ */
  origin?: SourceOrigin;
}

/** Aussehen eines Stempels; auf welche Seiten, bestimmt, welche Seiten ihn tragen */
export type StampLook = Omit<StampOptions, 'pages'>;

/** Bild einer Unterschrift (PNG ohne Metadaten, aus src/ui/signature-pad.ts) */
export interface SignatureImage {
  /** Kennung, damit dasselbe Bild beim Export nur einmal eingebettet wird */
  id: string;
  png: Uint8Array;
  width: number;
  height: number;
}

/**
 * Operation auf einer Seite, erst beim Export angewendet (plan-phase3.md 7.2, Schritt 2.2).
 * Sie gehört zur Seite und wandert mit, wenn die Seite verschoben, kopiert oder dupliziert wird.
 * - Stempel: höchstens einer je Seite, gesetzt so, wie die Seite am Ende zu sehen ist.
 * - Unterschrift: `rect` in Anteilen der Seite, so wie sie beim Setzen angezeigt wurde, mit der
 *   zusätzlichen Drehung `turn` von damals. So steht die Unterschrift in dieser Ansicht aufrecht;
 *   wird die Seite danach gedreht, dreht sie sich mit dem Inhalt (am Inhalt verankert).
 */
export type PageOp =
  | { type: 'stamp'; stamp: StampLook }
  | { type: 'signature'; image: SignatureImage; rect: NormRect; turn: Rotation };

/** Eine Seite im Dokument. `rotate` ist die zusätzliche Drehung im Uhrzeigersinn. */
export type PageRef =
  | {
      key: PageKey;
      kind: 'source';
      source: SourceId;
      index: number;
      rotate: Rotation;
      ops?: readonly PageOp[];
    }
  | { key: PageKey; kind: 'blank'; box: PageBox; rotate: Rotation; ops?: readonly PageOp[] };

export function stampOf(page: PageRef): StampLook | null {
  return page.ops?.find((op) => op.type === 'stamp')?.stamp ?? null;
}

export function signaturesOf(page: PageRef): Extract<PageOp, { type: 'signature' }>[] {
  return (page.ops ?? []).filter((op) => op.type === 'signature');
}

/**
 * Seite einer Quelle mit zusätzlicher Drehung, ab 0 gezählt. Damit übergibt „PDF-Seiten
 * bearbeiten“ Reihenfolge, Drehung und gelöschte Seiten an die Werkstatt.
 */
export interface PagePick {
  index: number;
  rotate: Rotation;
}

/** Seitenfolge je Quelle beim Hinzufügen; ohne Eintrag alle Seiten in Originalreihenfolge */
export type SourceLayouts = ReadonlyMap<SourceId, readonly PagePick[]>;

/**
 * Seitenfolge aus dem Plan von „PDF-Seiten bearbeiten“ (organize.ts: Seite ab 1, Drehung in
 * Grad) für die Übergabe an die Werkstatt.
 */
export function picksFromPlan(plan: readonly { source: number; rotate: number }[]): PagePick[] {
  return plan.map((p) => ({ index: p.source - 1, rotate: normalizeRotation(p.rotate) }));
}

/** Seitenverweis ohne Schlüssel, z. B. in der internen Ablage */
export type PageTemplate =
  | Omit<Extract<PageRef, { kind: 'source' }>, 'key'>
  | Omit<Extract<PageRef, { kind: 'blank' }>, 'key'>;

/**
 * Operation auf ein ganzes Dokument, erst beim Export angewendet (plan-phase3.md 7.2), weil sie
 * von der Endreihenfolge abhängt. Stufe 2.1: Seitenzahlen.
 */
export type DocOp = { type: 'page-numbers'; options: PageNumberOptions };

export interface Doc {
  id: DocId;
  /** Änderbar; Vorgabe: Dateiname ohne .pdf */
  name: string;
  pages: readonly PageRef[];
  /** Dokument-Operationen; fehlt, wenn es keine gibt. Höchstens eine je Art. */
  ops?: readonly DocOp[];
  /**
   * Geschwärzt (Stufe 2.3) und seitdem nicht umbenannt: gespeichert wird es als
   * „<Name> (geschwärzt).pdf“ (export-plan.ts), solange alle Seiten geschwärzt sind.
   */
  redacted?: true;
}

/** Seitenzahlen des Dokuments, falls gesetzt */
export function pageNumbersOf(doc: Doc): PageNumberOptions | null {
  return doc.ops?.find((op) => op.type === 'page-numbers')?.options ?? null;
}

export interface WorkshopState {
  /** Reihenfolge der Spalten */
  docs: readonly Doc[];
  /** Nur Quellen, auf die eine Seite verweist (commands.ts räumt auf) */
  sources: ReadonlyMap<SourceId, Source>;
}

export const EMPTY_STATE: WorkshopState = { docs: [], sources: new Map() };

/**
 * Liefert neue IDs. Der Zähler lebt außerhalb des Zustands und läuft nie zurück, damit eine
 * ID nach Rückgängig nicht für etwas anderes wiederverwendet wird (die Oberfläche hängt DOM
 * und Vorschaubilder an Schlüssel).
 */
export type IdSource = (prefix: 'd' | 'p' | 's' | 'g') => string;

export function counterIds(): IdSource {
  let n = 0;
  return (prefix) => `${prefix}${++n}`;
}

export interface PageLocation {
  doc: Doc;
  docIndex: number;
  pageIndex: number;
  page: PageRef;
}

/** Alle Seiten in der Reihenfolge der Spalten, mit Fundort */
export function* allPages(state: WorkshopState): Generator<PageLocation> {
  for (const [docIndex, doc] of state.docs.entries()) {
    for (const [pageIndex, page] of doc.pages.entries()) yield { doc, docIndex, pageIndex, page };
  }
}

/** Schlüssel → Fundort. Einmal aufbauen und mehrfach nachschlagen. */
export function indexPages(state: WorkshopState): Map<PageKey, PageLocation> {
  const index = new Map<PageKey, PageLocation>();
  for (const location of allPages(state)) index.set(location.page.key, location);
  return index;
}

export function findDoc(state: WorkshopState, id: DocId): Doc | undefined {
  return state.docs.find((d) => d.id === id);
}

/** Die angegebenen Schlüssel, die es gibt, in der Reihenfolge der Spalten und Seiten */
export function inPageOrder(state: WorkshopState, keys: Iterable<PageKey>): PageRef[] {
  const wanted = new Set(keys);
  const pages: PageRef[] = [];
  if (wanted.size === 0) return pages;
  for (const { page } of allPages(state)) if (wanted.has(page.key)) pages.push(page);
  return pages;
}

/** Drehung, wie der Leser die Seite sieht: eigene /Rotate der Datei plus zusätzliche */
export function totalRotation(state: WorkshopState, page: PageRef): Rotation {
  if (page.kind === 'blank') return page.rotate;
  const own = state.sources.get(page.source)?.pages[page.index]?.rotate ?? 0;
  return normalizeRotation(own + page.rotate);
}

/** Größe der Seite, wie sie angezeigt wird (für Platzhalter mit richtigem Seitenverhältnis) */
export function visiblePageSize(state: WorkshopState, page: PageRef): PageBox {
  const box =
    page.kind === 'blank'
      ? page.box
      : (state.sources.get(page.source)?.pages[page.index]?.box ?? A4);
  return visibleSize({ x: 0, y: 0, ...box }, totalRotation(state, page));
}

export const A4_PORTRAIT: PageBox = { width: A4.width, height: A4.height };
export const A4_LANDSCAPE: PageBox = { width: A4.height, height: A4.width };

/**
 * Vorgabe für eine Leerseite an Position `index` (W14): so groß, wie die Nachbarseite
 * angezeigt wird (davor, sonst danach), in einem leeren Dokument DIN A4 hoch.
 */
export function blankBoxFor(state: WorkshopState, doc: Doc, index: number): PageBox {
  const neighbour = doc.pages[index - 1] ?? doc.pages[index];
  return neighbour ? visiblePageSize(state, neighbour) : A4_PORTRAIT;
}

/** Quellen, auf die das Dokument verweist */
export function docSources(doc: Doc): Set<SourceId> {
  const ids = new Set<SourceId>();
  for (const page of doc.pages) if (page.kind === 'source') ids.add(page.source);
  return ids;
}

/**
 * Ist das Dokument unverändert eine einzige PDF-Quelle (alle Seiten in Originalreihenfolge,
 * ohne zusätzliche Drehung, ohne Dokument-Operationen)? Dann gibt der Export die
 * Originaldatei aus (W12).
 */
export function unchangedSource(state: WorkshopState, doc: Doc): Source | null {
  if (doc.ops && doc.ops.length > 0) return null;
  const first = doc.pages[0];
  if (first?.kind !== 'source') return null;
  const source = state.sources.get(first.source);
  if (source?.kind !== 'pdf' || source.pages.length !== doc.pages.length) return null;
  const same = doc.pages.every(
    (p, i) =>
      p.kind === 'source' &&
      p.source === source.id &&
      p.index === i &&
      p.rotate === 0 &&
      !p.ops?.length,
  );
  return same ? source : null;
}

/** Summe der Dateigrößen aller Quellen, für den Hinweis ab 1 GB (W6) */
export function totalSourceSize(sources: Iterable<Source>): number {
  let sum = 0;
  for (const s of sources) sum += s.size;
  return sum;
}

export const MEMORY_HINT_BYTES = 1024 ** 3;

/** Dokumentname aus dem Dateinamen: ohne Endung von PDF oder Bild (W11) */
export function docNameFromFile(fileName: string): string {
  return (
    fileName.replace(/\.(pdf|jpe?g|png|webp|gif|bmp|heic|heif|tiff?)$/i, '').trim() || fileName
  );
}

/** Seiten eines Dokuments, die aus einer geschwärzten Datei stammen, aber nicht geschwärzt sind */
export interface UnredactedPages {
  doc: Doc;
  keys: PageKey[];
}

/**
 * Seiten, die auf eine Quelle verweisen, aus der im Arbeitsbereich schon eine geschwärzte
 * Fassung erzeugt wurde (Stufe 2.3), z. B. weil sie vor dem Schwärzen kopiert wurden. Gezählt
 * werden nur Quellen, deren geschwärzte Fassung noch im Arbeitsbereich ist. `docs` schränkt
 * auf diese Dokumente ein, `keys` auf diese Seiten (Export der Auswahl).
 */
export function unredactedPages(
  state: WorkshopState,
  docs: readonly Doc[] = state.docs,
  keys?: ReadonlySet<PageKey>,
): UnredactedPages[] {
  const redacted = new Set<SourceId>();
  for (const source of state.sources.values()) {
    if (source.origin?.kind === 'redacted') for (const id of source.origin.from) redacted.add(id);
  }
  if (redacted.size === 0) return [];
  const found: UnredactedPages[] = [];
  for (const doc of docs) {
    const hits = doc.pages.filter(
      (p) => p.kind === 'source' && redacted.has(p.source) && (!keys || keys.has(p.key)),
    );
    if (hits.length > 0) found.push({ doc, keys: hits.map((p) => p.key) });
  }
  return found;
}

/**
 * Quelle mit Formular für „Formular ausfüllen“ (Stufe 2.3): die der Seite `prefer`, wenn sie im
 * Dokument liegt und ein Formular hat, sonst die erste Formularquelle des Dokuments.
 */
export function formSourceOf(
  state: WorkshopState,
  doc: Doc,
  prefer?: PageKey | null,
): Source | null {
  const hasForm = (page: PageRef | undefined): Source | null => {
    const source = page?.kind === 'source' ? state.sources.get(page.source) : undefined;
    return source?.kind === 'pdf' && (source.facts.form || source.facts.xfa) ? source : null;
  };
  const preferred = hasForm(doc.pages.find((p) => p.key === prefer));
  if (preferred) return preferred;
  for (const page of doc.pages) {
    const source = hasForm(page);
    if (source) return source;
  }
  return null;
}
