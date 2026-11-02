/**
 * Reine Anmerkungslogik ohne pdf-lib: Einordnung, Texte, Auswahl. Die Seite lädt dieses
 * Modul, damit pdf-lib nicht in den Hauptthread kommt (AGENTS.md Abschnitt 3).
 */

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
