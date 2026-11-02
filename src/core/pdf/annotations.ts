/**
 * Anmerkungen einer PDF auflisten und entfernen (Werkzeug „PDF-Kommentare entfernen“). Ohne DOM,
 * läuft im Worker.
 *
 * Anmerkungen stehen im Eintrag /Annots jeder Seite (ISO 32000-2, Abschnitt 12.5). Entfernt wird
 * der Verweis aus diesem Array; das Objekt selbst wird gelöscht. Beim Speichern schreibt pdf-lib
 * nur die noch erreichbaren Objekte, frühere Speicherstände fallen ebenfalls weg.
 *
 * Formularfelder (Untertyp Widget) werden nie entfernt: Sie gehören zum Formular. Popup-Fenster
 * werden mit ihrer Notiz oder Markierung entfernt und nicht einzeln angeboten.
 *
 * Anzeigetexte stehen nur in der Liste auf dem Bildschirm; sie verlassen das Gerät nie.
 */

import {
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFRef,
  PDFString,
  type PDFObject,
} from 'pdf-lib';
import { loadPdf } from './merge.ts';

export type AnnotationGroup = 'comment' | 'link' | 'form' | 'popup' | 'other';

export interface AnnotationKind {
  label: string;
  group: AnnotationGroup;
}

/** Deutsche Namen der Untertypen; Schlüssel wie in der PDF (ISO 32000-2, Tabelle 169) */
const KINDS: Readonly<Record<string, AnnotationKind>> = {
  Text: { label: 'Notiz', group: 'comment' },
  FreeText: { label: 'Textfeld', group: 'comment' },
  Highlight: { label: 'Markierung', group: 'comment' },
  Underline: { label: 'Unterstreichung', group: 'comment' },
  StrikeOut: { label: 'Durchstreichung', group: 'comment' },
  Squiggly: { label: 'Wellenlinie', group: 'comment' },
  Ink: { label: 'Freihandzeichnung', group: 'comment' },
  Line: { label: 'Linie', group: 'comment' },
  Square: { label: 'Rechteck', group: 'comment' },
  Circle: { label: 'Kreis', group: 'comment' },
  Polygon: { label: 'Vieleck', group: 'comment' },
  PolyLine: { label: 'Linienzug', group: 'comment' },
  Caret: { label: 'Einfügemarke', group: 'comment' },
  Stamp: { label: 'Stempel', group: 'comment' },
  FileAttachment: { label: 'Dateianhang-Anmerkung', group: 'comment' },
  Sound: { label: 'Tonaufnahme', group: 'comment' },
  Redact: { label: 'Schwärzungsmarkierung', group: 'comment' },
  Link: { label: 'Link', group: 'link' },
  Widget: { label: 'Formularfeld', group: 'form' },
  Popup: { label: 'Popup-Fenster', group: 'popup' },
};

/** Untertyp leer oder fehlend: „Unbekannte Art“. Andere, nicht aufgeführte Untertypen: sonstige. */
export function classifyAnnotation(subtype: string): AnnotationKind {
  if (subtype === '') return { label: 'Unbekannte Art', group: 'other' };
  return KINDS[subtype] ?? { label: `Sonstige (${subtype})`, group: 'other' };
}

/** Kürzt einen Anzeigetext auf eine Zeile; leere Texte ergeben null. */
export function shortText(raw: string | null, max = 80): string | null {
  const flat = (raw ?? '').replace(/\s+/g, ' ').trim();
  if (flat === '') return null;
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}

/** Eine Anmerkung eines Seiteneintrags /Annots, nur mit den Angaben, die die Auswahl braucht */
export interface AnnotEntry {
  /** Untertyp; leer, wenn die Anmerkung keinen hat */
  subtype: string;
  /** Schlüssel des Objekts („Nummer Generation“), null bei direkt eingebetteten Anmerkungen */
  ref: string | null;
  /** Schlüssel des zugehörigen Popup-Fensters, falls vorhanden */
  popup: string | null;
}

/**
 * Welche Positionen eines /Annots-Arrays entfallen, wenn die Untertypen in `selected` gewählt
 * sind. Formularfelder und Popup-Fenster fallen nie allein weg; ein Popup-Fenster fällt mit
 * seiner Anmerkung weg.
 */
export function planRemoval(
  entries: readonly AnnotEntry[],
  selected: ReadonlySet<string>,
): Set<number> {
  const drop = new Set<number>();
  entries.forEach((entry, i) => {
    const { group } = classifyAnnotation(entry.subtype);
    if (group === 'form' || group === 'popup') return;
    if (selected.has(entry.subtype)) drop.add(i);
  });
  for (const i of [...drop]) {
    const popup = entries[i]?.popup;
    if (!popup) continue;
    const j = entries.findIndex((e) => e.subtype === 'Popup' && e.ref === popup);
    if (j !== -1) drop.add(j);
  }
  return drop;
}

/** Eine Zeile der Liste: eine Anmerkung auf einer Seite */
export interface AnnotationItem {
  /** Seite, von 1 an gezählt */
  page: number;
  subtype: string;
  label: string;
  group: AnnotationGroup;
  /** Kurzer Text aus /Contents, null wenn keiner da ist */
  text: string | null;
}

/** Ein Untertyp mit Anzahl, für die Auswahl */
export interface AnnotationType {
  subtype: string;
  label: string;
  group: AnnotationGroup;
  count: number;
}

export interface AnnotationListing {
  pages: number;
  items: AnnotationItem[];
  /** Formularfelder: bleiben in jedem Fall erhalten */
  formFields: number;
}

const refKey = (ref: PDFRef): string => `${ref.objectNumber} ${ref.generationNumber}`;

function textOf(value: PDFObject | undefined): string | null {
  if (value instanceof PDFString || value instanceof PDFHexString) return value.decodeText();
  return null;
}

/** Die Anmerkungen einer Seite in der Reihenfolge von /Annots; ein Eintrag je Position. */
function readPage(
  doc: PDFDocument,
  page: ReturnType<PDFDocument['getPages']>[number],
): { entry: AnnotEntry; text: string | null }[] {
  const annots = page.node.Annots();
  if (!annots) return [];
  const out: { entry: AnnotEntry; text: string | null }[] = [];
  for (let i = 0; i < annots.size(); i++) {
    const ref = annots.get(i);
    const annot = doc.context.lookup(ref);
    if (!(annot instanceof PDFDict)) {
      out.push({ entry: { subtype: '', ref: null, popup: null }, text: null });
      continue;
    }
    const subtype = annot.lookup(PDFName.of('Subtype'));
    const popup = annot.get(PDFName.of('Popup'));
    out.push({
      entry: {
        subtype: subtype instanceof PDFName ? subtype.decodeText() : '',
        ref: ref instanceof PDFRef ? refKey(ref) : null,
        popup: popup instanceof PDFRef ? refKey(popup) : null,
      },
      text: textOf(annot.lookup(PDFName.of('Contents'))),
    });
  }
  return out;
}

/** Listet alle Anmerkungen einer PDF. Popup-Fenster bleiben außen vor, Formularfelder zählen nur. */
export async function listAnnotations(bytes: Uint8Array): Promise<AnnotationListing> {
  const doc = await loadPdf(bytes);
  const pages = doc.getPages();
  const items: AnnotationItem[] = [];
  let formFields = 0;
  pages.forEach((page, p) => {
    for (const { entry, text } of readPage(doc, page)) {
      const kind = classifyAnnotation(entry.subtype);
      if (kind.group === 'form') formFields++;
      if (kind.group === 'form' || kind.group === 'popup') continue;
      items.push({
        page: p + 1,
        subtype: entry.subtype,
        label: kind.label,
        group: kind.group,
        text: shortText(text),
      });
    }
  });
  return { pages: pages.length, items, formFields };
}

const RANK: Record<AnnotationGroup, number> = { comment: 0, link: 1, other: 2, form: 3, popup: 4 };

/** Anzahl je Untertyp; Notizen zuerst, dann Links, dann sonstige, innerhalb nach Name. */
export function summarizeTypes(items: readonly AnnotationItem[]): AnnotationType[] {
  const byType = new Map<string, AnnotationType>();
  for (const item of items) {
    const found = byType.get(item.subtype);
    if (found) found.count++;
    else
      byType.set(item.subtype, {
        subtype: item.subtype,
        label: item.label,
        group: item.group,
        count: 1,
      });
  }
  return [...byType.values()].sort(
    (a, b) => RANK[a.group] - RANK[b.group] || a.label.localeCompare(b.label, 'de'),
  );
}

/** Vorauswahl: alle Notizen und Markierungen; Links und sonstige nicht. */
export function defaultSelection(types: readonly AnnotationType[]): Set<string> {
  return new Set(types.filter((t) => t.group === 'comment').map((t) => t.subtype));
}

/**
 * Entfernt die Anmerkungen der gewählten Untertypen aus allen Seiten und liefert die neue Datei
 * und die Zahl der entfernten Anmerkungen. Formularfelder bleiben immer erhalten. Wirft PdfError.
 */
export async function removeAnnotations(
  bytes: Uint8Array,
  selected: ReadonlySet<string>,
): Promise<{ bytes: Uint8Array; removed: number }> {
  const doc = await loadPdf(bytes);
  let removed = 0;
  for (const page of doc.getPages()) {
    const annots = page.node.Annots();
    if (!annots) continue;
    const drop = planRemoval(
      readPage(doc, page).map((e) => e.entry),
      selected,
    );
    for (let i = annots.size() - 1; i >= 0; i--) {
      if (!drop.has(i)) continue;
      const ref = annots.get(i);
      annots.remove(i);
      if (ref instanceof PDFRef) doc.context.delete(ref);
    }
    removed += drop.size;
  }
  return { bytes: await doc.save(), removed };
}
