/**
 * Befehle der PDF-Werkstatt, Stufe 1 (plan-phase3.md Abschnitt 2). Jeder Befehl ist eine reine
 * Funktion alter Zustand → neuer Zustand. Unveränderte Dokumente und Seiten werden mit dem alten
 * Zustand geteilt, damit 100 Verlaufsschritte auch bei vielen Seiten wenig Speicher brauchen.
 *
 * Ändert ein Befehl nichts (z. B. unbekannte Schlüssel, Verschieben an dieselbe Stelle), gibt
 * er denselben Zustand zurück; der Verlauf legt dann keinen Schritt an.
 *
 * Die Namen der Befehle (`label`) erscheinen in Ansagen und im Menü („Rückgängig: Drehen“).
 */

import { fitRect, turnRect, type NormRect } from '../geometry/norm-rect.ts';
import { samePageNumbers, type PageNumberOptions } from '../pdf/page-numbers.ts';
import { normalizeRotation } from '../pdf/stamp-geometry.ts';
import {
  cutIndices,
  docNameFromFile,
  findDoc,
  inPageOrder,
  pageNumbersOf,
  type Doc,
  type DocId,
  type IdSource,
  type PageBox,
  type PageKey,
  type PageOp,
  type PagePick,
  type PageRef,
  type PageTemplate,
  type Rotation,
  type SignatureImage,
  type Source,
  type SourceId,
  type SourceLayouts,
  type StampLook,
  type WorkshopState,
} from './model.ts';

export interface CommandResult {
  state: WorkshopState;
  /** Seiten, die danach ausgewählt sein sollen (z. B. neue Kopien) */
  select?: readonly PageKey[];
  /** Neu angelegtes Dokument, für Fokus und Ansage */
  doc?: DocId;
}

export interface Command {
  label: string;
  apply(state: WorkshopState, ids: IdSource): CommandResult;
}

/** Inhalt der internen Ablage (Strg/Cmd+X/C/V, W5): Seiten samt ihrer Quellen */
export interface Clipboard {
  pages: readonly PageTemplate[];
  sources: readonly Source[];
}

// ---------------------------------------------------------------------------------------------
// Hilfsfunktionen

const unchanged = (state: WorkshopState): CommandResult => ({ state });

function clamp(index: number, length: number): number {
  return Math.max(0, Math.min(Number.isFinite(index) ? Math.trunc(index) : length, length));
}

function sameArray<T>(a: readonly T[], b: readonly T[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

function withPages(doc: Doc, pages: readonly PageRef[]): Doc {
  return sameArray(doc.pages, pages) ? doc : { ...doc, pages };
}

function withKey(template: PageTemplate, key: PageKey): PageRef {
  return { ...template, key };
}

function template(page: PageRef): PageTemplate {
  const { key: _key, ...rest } = page;
  return rest;
}

/** Nur Quellen behalten, auf die eine Seite verweist; bei gleichem Inhalt dieselbe Map */
function prunedSources(
  sources: ReadonlyMap<SourceId, Source>,
  docs: readonly Doc[],
): ReadonlyMap<SourceId, Source> {
  const used = new Set<SourceId>();
  for (const doc of docs) for (const p of doc.pages) if (p.kind === 'source') used.add(p.source);
  if (used.size === sources.size && [...used].every((id) => sources.has(id))) return sources;
  const next = new Map<SourceId, Source>();
  for (const id of used) {
    const source = sources.get(id);
    if (source) next.set(id, source);
  }
  return next;
}

/**
 * Trennlinien nur vor Seiten, die im Dokument stehen und nicht die erste sind, jede einmal.
 * Unverändert dasselbe Objekt.
 */
function prunedCuts(doc: Doc): Doc {
  if (!doc.cuts) return doc;
  const inner = new Set(doc.pages.slice(1).map((p) => p.key));
  const cuts = [...new Set(doc.cuts)].filter((k) => inner.has(k));
  if (cuts.length === doc.cuts.length) return doc;
  const { cuts: _old, ...rest } = doc;
  return cuts.length > 0 ? { ...rest, cuts } : rest;
}

/** Neuer Zustand aus neuen Dokumenten; derselbe Zustand, wenn sich nichts geändert hat */
function withDocs(
  state: WorkshopState,
  docs: readonly Doc[],
  sources: ReadonlyMap<SourceId, Source> = state.sources,
): WorkshopState {
  if (sameArray(state.docs, docs) && sources === state.sources) return state;
  const cleaned = docs.map(prunedCuts);
  return { docs: cleaned, sources: prunedSources(sources, cleaned) };
}

function addToSources(
  sources: ReadonlyMap<SourceId, Source>,
  added: readonly Source[],
): ReadonlyMap<SourceId, Source> {
  if (added.length === 0) return sources;
  const next = new Map(sources);
  for (const source of added) next.set(source.id, source);
  return next;
}

/**
 * Seitenverweise einer neuen Quelle: alle Seiten in Originalreihenfolge oder, mit Seitenfolge,
 * genau diese. Seiten, die es in der Quelle nicht gibt, fallen weg; bleibt keine übrig, gelten
 * alle Seiten (ein leeres Dokument könnte die Quelle nicht mehr freigeben).
 */
function sourcePages(source: Source, ids: IdSource, layout?: readonly PagePick[]): PageRef[] {
  const picks = (layout ?? []).filter(
    (p) => Number.isInteger(p.index) && p.index >= 0 && p.index < source.pages.length,
  );
  const plan: readonly PagePick[] =
    picks.length > 0 ? picks : source.pages.map((_, index) => ({ index, rotate: 0 }));
  return plan.map(({ index, rotate }) => ({
    key: ids('p'),
    kind: 'source',
    source: source.id,
    index,
    rotate: normalizeRotation(rotate),
  }));
}

function insertAt(doc: Doc, index: number, pages: readonly PageRef[]): Doc {
  if (pages.length === 0) return doc;
  const at = clamp(index, doc.pages.length);
  return { ...doc, pages: [...doc.pages.slice(0, at), ...pages, ...doc.pages.slice(at)] };
}

function replaceDoc(docs: readonly Doc[], doc: Doc): Doc[] {
  return docs.map((d) => (d.id === doc.id ? doc : d));
}

function removeKeys(doc: Doc, keys: ReadonlySet<PageKey>): Doc {
  return withPages(
    doc,
    doc.pages.filter((p) => !keys.has(p.key)),
  );
}

function mapPages(
  state: WorkshopState,
  keys: Iterable<PageKey>,
  change: (page: PageRef) => PageRef,
): WorkshopState {
  const wanted = new Set(keys);
  if (wanted.size === 0) return state;
  const docs = state.docs.map((doc) =>
    withPages(
      doc,
      doc.pages.map((p) => (wanted.has(p.key) ? change(p) : p)),
    ),
  );
  return withDocs(state, docs);
}

// ---------------------------------------------------------------------------------------------
// Dokumente

/**
 * Neue Dateien aufnehmen. Ohne Ziel wird jede PDF ein eigenes Dokument; Bilder derselben
 * Ablage kommen zusammen in ein Dokument, benannt nach dem ersten Bild. Mit Ziel landen alle
 * Seiten an dieser Stelle im Dokument (Ablegen auf eine Spalte, „Bilder einfügen“).
 * `layouts` legt je Quelle Reihenfolge, Drehung und ausgelassene Seiten fest (Übergabe aus
 * „PDF-Seiten bearbeiten“).
 */
export function addSources(
  sources: readonly Source[],
  target?: { doc: DocId; index: number },
  layouts?: SourceLayouts,
): Command {
  return {
    label: 'Hinzufügen',
    apply(state, ids) {
      if (sources.length === 0) return unchanged(state);
      const all = addToSources(state.sources, sources);
      if (target) {
        const doc = findDoc(state, target.doc);
        if (!doc) return unchanged(state);
        const pages = sources.flatMap((s) => sourcePages(s, ids, layouts?.get(s.id)));
        const docs = replaceDoc(state.docs, insertAt(doc, target.index, pages));
        return { state: withDocs(state, docs, all), select: pages.map((p) => p.key) };
      }
      const created: Doc[] = [];
      let images: Doc | null = null;
      for (const source of sources) {
        const pages = sourcePages(source, ids, layouts?.get(source.id));
        if (source.kind === 'image' && images) {
          images.pages = [...images.pages, ...pages];
          continue;
        }
        const doc: Doc & { pages: PageRef[] } = {
          id: ids('d'),
          name: docNameFromFile(source.name),
          pages,
        };
        if (source.kind === 'image') images = doc;
        created.push(doc);
      }
      const next = withDocs(state, [...state.docs, ...created], all);
      return created[0] ? { state: next, doc: created[0].id } : { state: next };
    },
  };
}

export function newDoc(name: string): Command {
  return {
    label: 'Neues Dokument',
    apply(state, ids) {
      const doc: Doc = { id: ids('d'), name: name.trim() || name, pages: [] };
      return { state: withDocs(state, [...state.docs, doc]), doc: doc.id };
    },
  };
}

export function renameDoc(id: DocId, name: string): Command {
  return {
    label: 'Umbenennen',
    apply(state) {
      const doc = findDoc(state, id);
      const clean = name.trim();
      if (!doc || clean === '' || clean === doc.name) return unchanged(state);
      // Selbst umbenannt: kein Zusatz „(geschwärzt)“ mehr im Dateinamen
      const { redacted: _redacted, ...rest } = doc;
      return { state: withDocs(state, replaceDoc(state.docs, { ...rest, name: clean })) };
    },
  };
}

export function closeDoc(id: DocId): Command {
  return {
    label: 'Dokument schließen',
    apply(state) {
      return {
        state: withDocs(
          state,
          state.docs.filter((d) => d.id !== id),
        ),
      };
    },
  };
}

/** Kopie direkt rechts neben dem Dokument */
export function duplicateDoc(id: DocId, name: string): Command {
  return {
    label: 'Dokument duplizieren',
    apply(state, ids) {
      const at = state.docs.findIndex((d) => d.id === id);
      const doc = state.docs[at];
      if (!doc) return unchanged(state);
      const keys = new Map<PageKey, PageKey>();
      const copy: Doc = {
        id: ids('d'),
        name,
        pages: doc.pages.map((p) => {
          const page = withKey(template(p), ids('p'));
          keys.set(p.key, page.key);
          return page;
        }),
      };
      if (doc.ops) copy.ops = doc.ops;
      if (doc.redacted) copy.redacted = true;
      const cuts = (doc.cuts ?? []).flatMap((k) => keys.get(k) ?? []);
      if (cuts.length > 0) copy.cuts = cuts;
      const docs = [...state.docs.slice(0, at + 1), copy, ...state.docs.slice(at + 1)];
      return { state: withDocs(state, docs), doc: copy.id };
    },
  };
}

/**
 * Seitenzahlen für ein Dokument setzen, ändern oder mit `null` entfernen (Dokument-Operation,
 * plan-phase3.md 7.2). Gezeichnet wird erst beim Export, auf die dann gültige Seitenfolge.
 */
export function setPageNumbers(id: DocId, options: PageNumberOptions | null): Command {
  return {
    label: options ? 'Seitenzahlen' : 'Seitenzahlen entfernen',
    apply(state) {
      const doc = findDoc(state, id);
      if (!doc) return unchanged(state);
      const current = pageNumbersOf(doc);
      if (options === null ? current === null : current && samePageNumbers(current, options)) {
        return unchanged(state);
      }
      const others = (doc.ops ?? []).filter((op) => op.type !== 'page-numbers');
      const ops = options
        ? [...others, { type: 'page-numbers' as const, options: { ...options } }]
        : others;
      const { ops: _old, ...rest } = doc;
      const next: Doc = ops.length > 0 ? { ...rest, ops } : rest;
      return { state: withDocs(state, replaceDoc(state.docs, next)) };
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Seiten-Operationen (Stufe 2.2): Stempel und Unterschrift

function withOps(page: PageRef, ops: readonly PageOp[]): PageRef {
  const { ops: _old, ...rest } = page;
  return ops.length > 0 ? { ...rest, ops } : rest;
}

function sameStamp(a: StampLook, b: StampLook): boolean {
  return (
    a.text === b.text &&
    a.placement === b.placement &&
    a.color === b.color &&
    a.opacity === b.opacity
  );
}

/**
 * Stempel auf die Seiten setzen oder mit `null` entfernen. Je Seite gibt es höchstens einen
 * Stempel; ein neuer ersetzt den alten. Seiten, die schon genau diesen Stempel tragen, bleiben.
 */
export function setStamp(keys: Iterable<PageKey>, stamp: StampLook | null): Command {
  return {
    label: stamp ? 'Stempel' : 'Stempel entfernen',
    apply(state) {
      return {
        state: mapPages(state, keys, (page) => {
          const current = page.ops?.find((op) => op.type === 'stamp');
          if (stamp === null ? !current : current && sameStamp(current.stamp, stamp)) return page;
          const others = (page.ops ?? []).filter((op) => op.type !== 'stamp');
          return withOps(
            page,
            stamp ? [...others, { type: 'stamp', stamp: { ...stamp } }] : others,
          );
        }),
      };
    },
  };
}

/**
 * Rechteck einer Unterschrift, nachdem die Seite um `by` Grad weiter gedreht wurde (im
 * Uhrzeigersinn, Vielfache von 90). Für die Anzeige gesetzter Unterschriften auf einer Seite,
 * die seit dem Setzen gedreht wurde.
 */
export function turnedRect(rect: NormRect, by: number): NormRect {
  let r = rect;
  for (let turn = normalizeRotation(by); turn > 0; turn -= 90) r = turnRect(r, 90);
  return r;
}

/**
 * Unterschriften einer Seite festlegen: `rects` so, wie die Seite gerade angezeigt wird (mit
 * ihrer Drehung, die als `turn` mitgespeichert wird). Ersetzt alle Unterschriften der Seite;
 * alle bekommen das Bild `image`. Leere Liste entfernt sie.
 */
export function setSignatures(
  key: PageKey,
  image: SignatureImage | null,
  rects: readonly NormRect[],
): Command {
  return {
    label: rects.length > 0 ? 'Unterschrift' : 'Unterschrift entfernen',
    apply(state) {
      return {
        state: mapPages(state, [key], (page) => {
          const before = (page.ops ?? []).filter((op) => op.type === 'signature');
          if (rects.length === 0 && before.length === 0) return page;
          if (rects.length > 0 && !image) return page;
          const others = (page.ops ?? []).filter((op) => op.type !== 'signature');
          const signatures: PageOp[] =
            image === null
              ? []
              : rects.map((rect) => ({
                  type: 'signature',
                  image,
                  rect: fitRect(rect),
                  turn: page.rotate,
                }));
          return withOps(page, [...others, ...signatures]);
        }),
      };
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Einbacken (Stufe 2.3): Schwärzen und Formular ausfüllen

/** Eine Seite beim Einbacken: wie sie beim Start aussah und was an ihre Stelle kommt */
export interface BakedPage {
  key: PageKey;
  /** Seite beim Start des Werkzeugs; hat sie sich seitdem geändert, geschieht nichts */
  before: PageRef;
  /** Seite in der neuen Quelle (ab 0) und ihre zusätzliche Drehung */
  index: number;
  rotate: Rotation;
}

/** Gleiche Grundlage: dieselbe Seite derselben Quelle mit derselben Drehung (Operationen egal) */
export function sameBase(a: PageRef, b: PageRef): boolean {
  if (a.kind !== b.kind || a.rotate !== b.rotate) return false;
  if (a.kind === 'blank' && b.kind === 'blank') {
    return a.box.width === b.box.width && a.box.height === b.box.height;
  }
  return a.kind === 'source' && b.kind === 'source' && a.source === b.source && a.index === b.index;
}

/**
 * Seiten eines Dokuments durch Seiten einer neu erzeugten Quelle ersetzen (plan-phase3.md 7.2).
 * Die Seiten behalten ihre Schlüssel und Operationen (Stempel, Unterschriften); eine
 * Unterschrift bleibt dabei an derselben Stelle der angezeigten Seite. Rückgängig stellt die
 * alten Verweise wieder her; die alte Quelle bleibt, solange der Verlauf sie braucht.
 *
 * Nichts geschieht, wenn eine Seite fehlt oder sich ihre Grundlage seit dem Start geändert
 * hat, und mit `whole`, wenn das Dokument inzwischen andere Seiten enthält (Schwärzen gilt für
 * das ganze Dokument).
 */
export function bakePages(
  id: DocId,
  source: Source,
  pages: readonly BakedPage[],
  label: string,
  whole: boolean,
): Command {
  return {
    label,
    apply(state) {
      const doc = findDoc(state, id);
      if (!doc || pages.length === 0) return unchanged(state);
      const byKey = new Map(pages.map((p) => [p.key, p]));
      if (whole && (doc.pages.length !== byKey.size || doc.pages.some((p) => !byKey.has(p.key)))) {
        return unchanged(state);
      }
      const present = new Set(doc.pages.map((p) => p.key));
      if (pages.some((p) => !present.has(p.key))) return unchanged(state);
      if (
        !doc.pages.every((p) => {
          const b = byKey.get(p.key);
          return !b || sameBase(p, b.before);
        })
      ) {
        return unchanged(state);
      }
      const next = doc.pages.map((page): PageRef => {
        const baked = byKey.get(page.key);
        if (!baked) return page;
        const shift = baked.rotate - page.rotate;
        const ops = page.ops?.map((op) =>
          op.type === 'signature' ? { ...op, turn: normalizeRotation(op.turn + shift) } : op,
        );
        const ref: PageRef = {
          key: page.key,
          kind: 'source',
          source: source.id,
          index: baked.index,
          rotate: baked.rotate,
        };
        return ops?.length ? { ...ref, ops } : ref;
      });
      const baked: Doc = { ...doc, pages: next };
      if (source.origin?.kind === 'redacted') baked.redacted = true;
      const docs = replaceDoc(state.docs, baked);
      return { state: withDocs(state, docs, addToSources(state.sources, [source])) };
    },
  };
}

/**
 * Ab Seite `index` (ab 0) in ein neues Dokument direkt rechts daneben. Dokument-Operationen
 * (Seitenzahlen) gelten für beide Teile: Jeder Teil wird für sich nummeriert.
 */
export function splitDoc(id: DocId, index: number, name: string): Command {
  return {
    label: 'Teilen',
    apply(state, ids) {
      const at = state.docs.findIndex((d) => d.id === id);
      const doc = state.docs[at];
      if (!doc || index <= 0 || index >= doc.pages.length) return unchanged(state);
      const head: Doc = { ...doc, pages: doc.pages.slice(0, index) };
      const tail: Doc = { id: ids('d'), name, pages: doc.pages.slice(index) };
      if (doc.ops) tail.ops = doc.ops;
      if (doc.redacted) tail.redacted = true;
      // Trennlinien bleiben bei ihren Seiten; withDocs räumt die überzähligen auf
      if (doc.cuts) tail.cuts = doc.cuts;
      const docs = [...state.docs.slice(0, at), head, tail, ...state.docs.slice(at + 1)];
      return { state: withDocs(state, docs), doc: tail.id };
    },
  };
}

/**
 * Alle Dokumente in der Reihenfolge der Spalten in das erste von ihnen. Es behält seine
 * Dokument-Operationen, die der anderen entfallen.
 */
export function mergeDocs(docIds: Iterable<DocId>): Command {
  return {
    label: 'Zusammenführen',
    apply(state) {
      const wanted = new Set(docIds);
      const merged = state.docs.filter((d) => wanted.has(d.id));
      const [first] = merged;
      if (!first || merged.length < 2) return unchanged(state);
      const target = joined(first, merged);
      const docs = state.docs.flatMap((d) =>
        d.id === first.id ? [target] : wanted.has(d.id) ? [] : [d],
      );
      return { state: withDocs(state, docs), doc: first.id };
    },
  };
}

/** `first` mit den Seiten aller `docs` nacheinander; Trennlinien aller Teile bleiben */
function joined(first: Doc, docs: readonly Doc[]): Doc {
  const target: Doc = { ...first, pages: docs.flatMap((d) => d.pages) };
  const cuts = docs.flatMap((d) => d.cuts ?? []);
  if (cuts.length > 0) target.cuts = cuts;
  return target;
}

/**
 * Dokumente in der angegebenen Reihenfolge zusammenführen (Dialog mit Reihenfolge, Ziehen einer
 * Dokumentkarte auf eine andere). Ziel ist das erste Dokument der Liste: Es behält Namen,
 * Dokument-Operationen und seinen Platz in der Liste.
 */
export function joinDocs(order: readonly DocId[]): Command {
  return {
    label: 'Zusammenführen',
    apply(state) {
      const ids = [...new Set(order)];
      const docs = ids.flatMap((id) => findDoc(state, id) ?? []);
      const [first] = docs;
      if (!first || docs.length < 2) return unchanged(state);
      const target = joined(first, docs);
      const wanted = new Set(ids);
      const next = state.docs.flatMap((d) =>
        d.id === first.id ? [target] : wanted.has(d.id) ? [] : [d],
      );
      return { state: withDocs(state, next), doc: first.id };
    },
  };
}

/** Dokument an eine andere Stelle der Liste; `index` ist die Stelle vor dem Herausnehmen */
export function moveDoc(id: DocId, index: number): Command {
  return {
    label: 'Dokument verschieben',
    apply(state) {
      const from = state.docs.findIndex((d) => d.id === id);
      const doc = state.docs[from];
      if (!doc) return unchanged(state);
      const at = clamp(index, state.docs.length);
      const to = at > from ? at - 1 : at;
      if (to === from) return unchanged(state);
      const rest = state.docs.filter((d) => d.id !== id);
      return { state: withDocs(state, [...rest.slice(0, to), doc, ...rest.slice(to)]) };
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Trennlinien (Umbau zum Editor)

/**
 * Trennlinie vor den Seiten setzen (`on`) oder entfernen. Vor der ersten Seite eines Dokuments
 * gibt es keine. Mehrere Seiten auf einmal: z. B. „Trennlinie vor jeder ausgewählten Seite“.
 */
export function setCuts(keys: Iterable<PageKey>, on: boolean): Command {
  return {
    label: on ? 'Trennlinie setzen' : 'Trennlinie entfernen',
    apply(state) {
      const wanted = new Set(keys);
      if (wanted.size === 0) return unchanged(state);
      const docs = state.docs.map((doc) => {
        const inner = doc.pages.slice(1).filter((p) => wanted.has(p.key));
        if (inner.length === 0) return doc;
        const current = new Set(doc.cuts ?? []);
        const before = current.size;
        for (const p of inner) {
          if (on) current.add(p.key);
          else current.delete(p.key);
        }
        if (current.size === before) return doc;
        const { cuts: _old, ...rest } = doc;
        return current.size > 0 ? { ...rest, cuts: [...current] } : rest;
      });
      return { state: withDocs(state, docs) };
    },
  };
}

/** Trennlinien eines Dokuments durch genau diese ersetzen (Trennlinien alle n Seiten) */
export function replaceCuts(id: DocId, keys: readonly PageKey[]): Command {
  return {
    label: 'Trennlinien setzen',
    apply(state) {
      const doc = findDoc(state, id);
      if (!doc) return unchanged(state);
      const inner = new Set(doc.pages.slice(1).map((p) => p.key));
      const cuts = keys.filter((k) => inner.has(k));
      const before = doc.cuts ?? [];
      if (cuts.length === before.length && cuts.every((k) => before.includes(k))) {
        return unchanged(state);
      }
      const { cuts: _old, ...rest } = doc;
      const next: Doc = cuts.length > 0 ? { ...rest, cuts } : rest;
      return { state: withDocs(state, replaceDoc(state.docs, next)) };
    },
  };
}

/** Alle Trennlinien der Dokumente entfernen */
export function clearCuts(ids: Iterable<DocId>): Command {
  return {
    label: 'Trennlinien entfernen',
    apply(state) {
      const wanted = new Set(ids);
      const docs = state.docs.map((doc) => {
        if (!wanted.has(doc.id) || !doc.cuts) return doc;
        const { cuts: _old, ...rest } = doc;
        return rest;
      });
      return { state: withDocs(state, docs) };
    },
  };
}

/**
 * Dokument an allen Trennlinien teilen, in einem Schritt. Der erste Teil behält Namen und Platz,
 * die weiteren kommen direkt dahinter und heißen `name(2)`, `name(3)` … Dokument-Operationen
 * gelten für jeden Teil (jeder wird für sich nummeriert), wie beim Teilen an einer Stelle.
 */
export function splitAtCuts(id: DocId, name: (part: number) => string): Command {
  return {
    label: 'An Trennlinien teilen',
    apply(state, ids) {
      const at = state.docs.findIndex((d) => d.id === id);
      const doc = state.docs[at];
      if (!doc) return unchanged(state);
      const cuts = cutIndices(doc);
      if (cuts.length === 0) return unchanged(state);
      const bounds = [0, ...cuts, doc.pages.length];
      const { cuts: _old, ...base } = doc;
      const parts: Doc[] = [];
      for (let i = 0; i + 1 < bounds.length; i++) {
        const pages = doc.pages.slice(bounds[i], bounds[i + 1]);
        if (i === 0) {
          parts.push({ ...base, pages });
          continue;
        }
        const part: Doc = { id: ids('d'), name: name(i + 1), pages };
        if (doc.ops) part.ops = doc.ops;
        if (doc.redacted) part.redacted = true;
        parts.push(part);
      }
      const docs = [...state.docs.slice(0, at), ...parts, ...state.docs.slice(at + 1)];
      return { state: withDocs(state, docs), doc: parts[1]?.id ?? doc.id };
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Seiten

/**
 * Seiten verschieben. `index` ist die Einfügestelle im Zieldokument, wie sie die Einfügemarke
 * zeigt: vor der Seite, die jetzt an dieser Stelle steht. Die Seiten behalten ihre Schlüssel
 * und kommen in der Reihenfolge der Spalten und Seiten an.
 */
export function movePages(keys: Iterable<PageKey>, target: DocId, index: number): Command {
  return {
    label: 'Verschieben',
    apply(state) {
      const moving = inPageOrder(state, keys);
      const targetDoc = findDoc(state, target);
      if (moving.length === 0 || !targetDoc) return unchanged(state);
      const set = new Set(moving.map((p) => p.key));
      // Die erste nicht bewegte Seite ab der Einfügestelle bleibt der Anker.
      const anchor = targetDoc.pages
        .slice(clamp(index, targetDoc.pages.length))
        .find((p) => !set.has(p.key));
      const docs = state.docs.map((doc) => {
        const rest = removeKeys(doc, set);
        if (doc.id !== target) return rest;
        const at = anchor ? rest.pages.indexOf(anchor) : rest.pages.length;
        return withPages(doc, [...rest.pages.slice(0, at), ...moving, ...rest.pages.slice(at)]);
      });
      return { state: withDocs(state, docs), select: moving.map((p) => p.key) };
    },
  };
}

/** Wie movePages, aber mit neuen Schlüsseln; die Originale bleiben (Alt beim Loslassen) */
export function copyPages(keys: Iterable<PageKey>, target: DocId, index: number): Command {
  return {
    label: 'Kopieren',
    apply(state, ids) {
      const pages = inPageOrder(state, keys);
      const doc = findDoc(state, target);
      if (pages.length === 0 || !doc) return unchanged(state);
      const copies = pages.map((p) => withKey(template(p), ids('p')));
      const docs = replaceDoc(state.docs, insertAt(doc, index, copies));
      return { state: withDocs(state, docs), select: copies.map((p) => p.key) };
    },
  };
}

/**
 * Seiten um eine Stelle nach vorne (-1) oder hinten (+1) innerhalb ihres Dokuments
 * (Alt+Pfeil hoch/runter, „Nach vorne/Nach hinten“ auf dem Handy). Zusammenhängende Seiten
 * wandern gemeinsam; was schon am Rand steht, bleibt stehen.
 */
export function shiftPages(keys: Iterable<PageKey>, delta: -1 | 1): Command {
  return {
    label: delta < 0 ? 'Nach vorne' : 'Nach hinten',
    apply(state) {
      const set = new Set(keys);
      if (set.size === 0) return unchanged(state);
      const docs = state.docs.map((doc) => {
        const pages = [...doc.pages];
        const order = delta < 0 ? pages.keys() : [...pages.keys()].reverse();
        for (const i of order) {
          const j = i + delta;
          const page = pages[i];
          const other = pages[j];
          if (!page || !other || !set.has(page.key) || set.has(other.key)) continue;
          pages[j] = page;
          pages[i] = other;
        }
        return withPages(doc, pages);
      });
      return { state: withDocs(state, docs) };
    },
  };
}

/** Zusätzliche Drehung im Uhrzeigersinn, in Schritten von 90 Grad */
export function rotatePages(keys: Iterable<PageKey>, degrees: 90 | -90 | 180): Command {
  return {
    label: 'Drehen',
    apply(state) {
      return {
        state: mapPages(state, keys, (p) => ({
          ...p,
          rotate: normalizeRotation(p.rotate + degrees),
        })),
      };
    },
  };
}

export function deletePages(keys: Iterable<PageKey>, label = 'Löschen'): Command {
  return {
    label,
    apply(state) {
      const set = new Set(keys);
      if (set.size === 0) return unchanged(state);
      return {
        state: withDocs(
          state,
          state.docs.map((d) => removeKeys(d, set)),
        ),
      };
    },
  };
}

/** Jede Seite bekommt eine Kopie direkt dahinter; ausgewählt sind danach die Kopien */
export function duplicatePages(keys: Iterable<PageKey>): Command {
  return {
    label: 'Duplizieren',
    apply(state, ids) {
      const set = new Set(keys);
      if (set.size === 0) return unchanged(state);
      const copies: PageKey[] = [];
      const docs = state.docs.map((doc) =>
        withPages(
          doc,
          doc.pages.flatMap((p) => {
            if (!set.has(p.key)) return [p];
            const copy = withKey(template(p), ids('p'));
            copies.push(copy.key);
            return [p, copy];
          }),
        ),
      );
      return { state: withDocs(state, docs), select: copies };
    },
  };
}

export function insertBlank(doc: DocId, index: number, box: PageBox): Command {
  return {
    label: 'Leere Seite einfügen',
    apply(state, ids) {
      const target = findDoc(state, doc);
      if (!target || !(box.width > 0) || !(box.height > 0)) return unchanged(state);
      const page: PageRef = { key: ids('p'), kind: 'blank', box, rotate: 0 };
      const docs = replaceDoc(state.docs, insertAt(target, index, [page]));
      return { state: withDocs(state, docs), select: [page.key] };
    },
  };
}

/** Seiten in ein neues Dokument ganz rechts: verschieben oder kopieren */
export function extractToNewDoc(
  keys: Iterable<PageKey>,
  name: string,
  mode: 'move' | 'copy',
): Command {
  return {
    label: 'In neues Dokument',
    apply(state, ids) {
      const pages = inPageOrder(state, keys);
      if (pages.length === 0) return unchanged(state);
      const set = new Set(pages.map((p) => p.key));
      const moved = mode === 'move' ? pages : pages.map((p) => withKey(template(p), ids('p')));
      const doc: Doc = { id: ids('d'), name, pages: moved };
      const rest = mode === 'move' ? state.docs.map((d) => removeKeys(d, set)) : state.docs;
      return {
        state: withDocs(state, [...rest, doc]),
        select: moved.map((p) => p.key),
        doc: doc.id,
      };
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Interne Ablage

/** Seiten für die interne Ablage kopieren, mit den Quellen, auf die sie verweisen */
export function toClipboard(state: WorkshopState, keys: Iterable<PageKey>): Clipboard {
  const pages = inPageOrder(state, keys);
  const sources = new Map<SourceId, Source>();
  for (const p of pages) {
    const source = p.kind === 'source' ? state.sources.get(p.source) : undefined;
    if (source) sources.set(source.id, source);
  }
  return { pages: pages.map(template), sources: [...sources.values()] };
}

export function pastePages(clipboard: Clipboard, target: DocId, index: number): Command {
  return {
    label: 'Einfügen',
    apply(state, ids) {
      const doc = findDoc(state, target);
      if (!doc || clipboard.pages.length === 0) return unchanged(state);
      const pages = clipboard.pages.map((t) => withKey(t, ids('p')));
      const docs = replaceDoc(state.docs, insertAt(doc, index, pages));
      return {
        state: withDocs(state, docs, addToSources(state.sources, clipboard.sources)),
        select: pages.map((p) => p.key),
      };
    },
  };
}

/** Reihenfolge der Seiten umkehren, je Dokument unter den angegebenen Seiten */
export function reversePages(keys: Iterable<PageKey>): Command {
  return {
    label: 'Reihenfolge umkehren',
    apply(state) {
      const set = new Set(keys);
      if (set.size < 2) return unchanged(state);
      const docs = state.docs.map((doc) => {
        const picked = doc.pages.filter((p) => set.has(p.key)).reverse();
        if (picked.length < 2) return doc;
        let i = 0;
        return withPages(
          doc,
          doc.pages.map((p) => (set.has(p.key) ? (picked[i++] ?? p) : p)),
        );
      });
      return { state: withDocs(state, docs) };
    },
  };
}
