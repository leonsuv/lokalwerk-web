/**
 * Auswahl in der PDF-Werkstatt, wie im Dateimanager (plan-phase3.md 6.1 und 6.2): Klick wählt
 * eine Seite, Umschalt wählt einen Bereich, auch über Dokumentgrenzen in der Reihenfolge der
 * Spalten, Strg/Cmd schaltet einzelne Seiten dazu oder weg.
 *
 * Die Auswahl gehört nicht zum Verlauf: Rückgängig ändert sie nicht mit, sie wird nur um
 * Seiten bereinigt, die es nicht mehr gibt (pruneSelection).
 */

import {
  allPages,
  findDoc,
  indexPages,
  type DocId,
  type PageKey,
  type WorkshopState,
} from './model.ts';

export interface Selection {
  keys: ReadonlySet<PageKey>;
  /** Ausgangspunkt für Umschalt-Bereiche */
  anchor: PageKey | null;
  /** Seite mit dem Tastaturfokus */
  focus: PageKey | null;
}

export const EMPTY_SELECTION: Selection = { keys: new Set(), anchor: null, focus: null };

/** Klick: nur diese Seite */
export function selectOnly(key: PageKey): Selection {
  return { keys: new Set([key]), anchor: key, focus: key };
}

/** Mehrere Seiten, z. B. nach Duplizieren oder Einfügen; Anker und Fokus auf der ersten */
export function selectKeys(keys: readonly PageKey[]): Selection {
  const first = keys[0] ?? null;
  return { keys: new Set(keys), anchor: first, focus: first };
}

/** Strg/Cmd+Klick, Leertaste: Seite dazu oder weg */
export function toggle(selection: Selection, key: PageKey): Selection {
  const keys = new Set(selection.keys);
  if (!keys.delete(key)) keys.add(key);
  return { keys, anchor: key, focus: key };
}

/** Nur den Fokus bewegen (Pfeiltasten), Auswahl bleibt */
export function moveFocus(selection: Selection, key: PageKey): Selection {
  return { ...selection, focus: key };
}

/**
 * Umschalt+Klick, Umschalt+Pfeil: alle Seiten vom Anker bis `key`. Mit `additive`
 * (Strg/Cmd+Umschalt) bleibt die bisherige Auswahl dazu erhalten. Anker bleibt stehen.
 */
export function selectRange(
  state: WorkshopState,
  selection: Selection,
  key: PageKey,
  additive = false,
): Selection {
  const index = indexPages(state);
  const anchor = selection.anchor && index.has(selection.anchor) ? selection.anchor : key;
  if (!index.has(key)) return selection;
  const keys = new Set(additive ? selection.keys : []);
  let inside = false;
  for (const { page } of allPages(state)) {
    const edge = page.key === anchor || page.key === key;
    if (edge || inside) keys.add(page.key);
    if (edge && anchor !== key) inside = !inside;
  }
  return { keys, anchor, focus: key };
}

/** Strg/Cmd+A: alle Seiten des Dokuments */
export function selectDoc(state: WorkshopState, doc: DocId, focus: PageKey | null): Selection {
  const keys = findDoc(state, doc)?.pages.map((p) => p.key) ?? [];
  return { keys: new Set(keys), anchor: keys[0] ?? null, focus: focus ?? keys[0] ?? null };
}

/** Nach Rückgängig, Löschen usw.: nur Seiten behalten, die es noch gibt */
export function pruneSelection(state: WorkshopState, selection: Selection): Selection {
  const index = indexPages(state);
  const keys = new Set([...selection.keys].filter((k) => index.has(k)));
  const anchor = selection.anchor && index.has(selection.anchor) ? selection.anchor : null;
  const focus = selection.focus && index.has(selection.focus) ? selection.focus : null;
  if (
    keys.size === selection.keys.size &&
    anchor === selection.anchor &&
    focus === selection.focus
  ) {
    return selection;
  }
  return { keys, anchor, focus };
}

/** Für „3 Seiten aus 2 Dokumenten“ */
export function selectionSummary(
  state: WorkshopState,
  selection: Selection,
): { pages: number; docs: number } {
  let pages = 0;
  const docs = new Set<DocId>();
  for (const { doc, page } of allPages(state)) {
    if (!selection.keys.has(page.key)) continue;
    pages++;
    docs.add(doc.id);
  }
  return { pages, docs: docs.size };
}
