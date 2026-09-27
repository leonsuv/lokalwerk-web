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

import { normalizeRotation } from '../pdf/stamp-geometry.ts';
import {
  docNameFromFile,
  findDoc,
  inPageOrder,
  type Doc,
  type DocId,
  type IdSource,
  type PageBox,
  type PageKey,
  type PageRef,
  type PageTemplate,
  type Source,
  type SourceId,
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

/** Neuer Zustand aus neuen Dokumenten; derselbe Zustand, wenn sich nichts geändert hat */
function withDocs(
  state: WorkshopState,
  docs: readonly Doc[],
  sources: ReadonlyMap<SourceId, Source> = state.sources,
): WorkshopState {
  if (sameArray(state.docs, docs) && sources === state.sources) return state;
  return { docs, sources: prunedSources(sources, docs) };
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

function sourcePages(source: Source, ids: IdSource): PageRef[] {
  return source.pages.map((_, index) => ({
    key: ids('p'),
    kind: 'source',
    source: source.id,
    index,
    rotate: 0,
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
 */
export function addSources(
  sources: readonly Source[],
  target?: { doc: DocId; index: number },
): Command {
  return {
    label: 'Hinzufügen',
    apply(state, ids) {
      if (sources.length === 0) return unchanged(state);
      const all = addToSources(state.sources, sources);
      if (target) {
        const doc = findDoc(state, target.doc);
        if (!doc) return unchanged(state);
        const pages = sources.flatMap((s) => sourcePages(s, ids));
        const docs = replaceDoc(state.docs, insertAt(doc, target.index, pages));
        return { state: withDocs(state, docs, all), select: pages.map((p) => p.key) };
      }
      const created: Doc[] = [];
      let images: Doc | null = null;
      for (const source of sources) {
        const pages = sourcePages(source, ids);
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
      return { state: withDocs(state, replaceDoc(state.docs, { ...doc, name: clean })) };
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
      const copy: Doc = {
        id: ids('d'),
        name,
        pages: doc.pages.map((p) => withKey(template(p), ids('p'))),
      };
      const docs = [...state.docs.slice(0, at + 1), copy, ...state.docs.slice(at + 1)];
      return { state: withDocs(state, docs), doc: copy.id };
    },
  };
}

/** Ab Seite `index` (ab 0) in ein neues Dokument direkt rechts daneben */
export function splitDoc(id: DocId, index: number, name: string): Command {
  return {
    label: 'Teilen',
    apply(state, ids) {
      const at = state.docs.findIndex((d) => d.id === id);
      const doc = state.docs[at];
      if (!doc || index <= 0 || index >= doc.pages.length) return unchanged(state);
      const head: Doc = { ...doc, pages: doc.pages.slice(0, index) };
      const tail: Doc = { id: ids('d'), name, pages: doc.pages.slice(index) };
      const docs = [...state.docs.slice(0, at), head, tail, ...state.docs.slice(at + 1)];
      return { state: withDocs(state, docs), doc: tail.id };
    },
  };
}

/** Alle Dokumente in der Reihenfolge der Spalten in das erste von ihnen */
export function mergeDocs(docIds: Iterable<DocId>): Command {
  return {
    label: 'Zusammenführen',
    apply(state) {
      const wanted = new Set(docIds);
      const merged = state.docs.filter((d) => wanted.has(d.id));
      const [first] = merged;
      if (!first || merged.length < 2) return unchanged(state);
      const target: Doc = { ...first, pages: merged.flatMap((d) => d.pages) };
      const docs = state.docs.flatMap((d) =>
        d.id === first.id ? [target] : wanted.has(d.id) ? [] : [d],
      );
      return { state: withDocs(state, docs), doc: first.id };
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
