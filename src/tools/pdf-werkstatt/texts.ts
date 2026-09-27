/**
 * Texte der PDF-Werkstatt an einer Stelle (AGENTS.md Abschnitt 7). Entwurf zur Freigabe bei
 * Anhaltepunkt B (plan-phase3.md); die Befehlsnamen stehen in src/core/workshop/commands.ts.
 */

import { formatBytes } from '../../core/format/bytes.ts';

export const pages = (n: number): string => `${n} ${n === 1 ? 'Seite' : 'Seiten'}`;

export const ERRORS: Record<string, string> = {
  empty: 'Die Datei ist leer.',
  encrypted:
    'Die PDF ist verschlüsselt (Passwort- oder Kopierschutz). Entferne den Schutz und füge sie erneut hinzu.',
  damaged:
    'Die Datei ist beschädigt oder keine gültige PDF. Speichere sie im Ursprungsprogramm erneut als PDF.',
  'no-pages': 'Die PDF enthält keine Seiten.',
  'out-of-memory':
    'Zu wenig Arbeitsspeicher für diese Datei. Schließe andere Dokumente oder lade die Seite neu.',
  unreadable:
    'Die Datei konnte nicht gelesen werden. Prüfe, ob sie noch am selben Ort liegt, und füge sie erneut hinzu.',
  'worker-failed': 'Die Werkstatt konnte nicht starten. Lade die Seite neu.',
  // Bilder (Texte wie in „Bilder zu PDF“)
  decode:
    'Dieses Bildformat kann dein Browser nicht öffnen. Speichere das Bild als JPEG und füge es erneut hinzu.',
  encode: 'Das Bild konnte nicht neu gespeichert werden. Verkleinere es und füge es erneut hinzu.',
  metadata:
    'Im neu gespeicherten Bild wurden noch Metadaten gefunden. Das Bild wird deshalb nicht übernommen.',
};

export const FALLBACK_ERROR =
  'Die Datei konnte nicht verarbeitet werden. Lade die Seite neu und versuch es noch einmal.';

export const fileError = (name: string, message: string): string => `${name}: ${message}`;

export const NOT_SUPPORTED = (names: string[]): string =>
  names.length === 1
    ? `${names[0] ?? ''} wurde nicht übernommen: Die Werkstatt öffnet PDFs und Bilder.`
    : `${names.length} Dateien wurden nicht übernommen: Die Werkstatt öffnet PDFs und Bilder.`;

export const loading = (done: number, total: number): string =>
  total === 1 ? 'Datei wird geöffnet …' : `Dateien werden geöffnet: ${done} von ${total} …`;

export const NO_PREVIEW = 'Keine Vorschau möglich';

export const memoryHint = (bytes: number): string =>
  `Die geöffneten Dateien sind zusammen ${formatBytes(bytes)} groß. Bei so viel Daten kann der Arbeitsspeicher des Browsers knapp werden; schließe Dokumente, die du nicht mehr brauchst.`;

export interface PageDescription {
  position: number;
  count: number;
  /** Dateiname und Seite der Quelle, oder null für eine leere Seite */
  source: { name: string; page: number | null } | null;
  rotate: number;
}

/** Beschriftung einer Seite für Screenreader (plan-phase3.md 6.4) */
export function pageLabel(d: PageDescription): string {
  const from = d.source
    ? d.source.page === null
      ? `aus ${d.source.name}`
      : `aus ${d.source.name} Seite ${d.source.page}`
    : 'leere Seite';
  const turned = d.rotate ? `, gedreht um ${d.rotate} Grad` : '';
  return `Seite ${d.position} von ${d.count}, ${from}${turned}`;
}

export const docPagesLabel = (name: string): string => `Seiten von ${name}`;
export const DOC_NAME_LABEL = 'Name des Dokuments';
export const LEAVE_WARNING = 'Die Werkstatt hat Änderungen, die noch nicht gespeichert sind.';

// Tastenbezeichnungen: auf dem Mac Symbole wie in macOS, sonst die deutschen Tastennamen
const MAC = /Mac|iPhone|iPad/.test(globalThis.navigator?.platform ?? '');
export const KEY = {
  mod: MAC ? '⌘' : 'Strg',
  shift: MAC ? '⇧' : 'Umschalt',
  alt: MAC ? '⌥' : 'Alt',
  plus: MAC ? '' : '+',
};
/** Tastenkombination zur Anzeige, z. B. combo('mod', 'V') → „Strg+V“ oder „⌘V“ */
export function combo(...parts: string[]): string {
  return parts.map((p) => (p in KEY ? KEY[p as keyof typeof KEY] : p)).join(KEY.plus);
}

// Ansagen in der Live-Region (plan-phase3.md 6.4)
export function selected(count: number, docs: number): string {
  if (count === 0) return 'Auswahl aufgehoben';
  return docs > 1
    ? `${pages(count)} aus ${docs} Dokumenten ausgewählt`
    : `${pages(count)} ausgewählt`;
}
export const moved = (n: number, doc: string, position: number): string =>
  `${pages(n)} nach ${doc} an Position ${position} verschoben`;
export const copiedTo = (n: number, doc: string, position: number): string =>
  `${pages(n)} nach ${doc} an Position ${position} kopiert`;
export const shifted = (n: number, delta: number): string =>
  `${pages(n)} ${delta < 0 ? 'nach vorne' : 'nach hinten'} verschoben`;
export const rotated = (n: number, degrees: number): string =>
  `${pages(n)} nach ${degrees > 0 ? 'rechts' : 'links'} gedreht`;
export const deleted = (n: number): string => `${pages(n)} gelöscht`;
export const duplicated = (n: number): string => `${pages(n)} dupliziert`;
export const cut = (n: number): string =>
  `${pages(n)} ausgeschnitten. Mit ${combo('mod', 'V')} vor einer Seite einfügen.`;
export const copied = (n: number): string =>
  `${pages(n)} kopiert. Mit ${combo('mod', 'V')} vor einer Seite einfügen.`;
export const pasted = (n: number, doc: string, position: number): string =>
  `${pages(n)} in ${doc} an Position ${position} eingefügt`;
export const NOTHING_TO_PASTE = `Nichts zum Einfügen. Schneide Seiten zuerst mit ${combo('mod', 'X')} aus oder kopiere sie mit ${combo('mod', 'C')}.`;
export const undone = (label: string): string => `Rückgängig: ${label}`;
export const redone = (label: string): string => `Wiederholen: ${label}`;
export const NOTHING_TO_UNDO = 'Nichts zum Rückgängigmachen';
export const NOTHING_TO_REDO = 'Nichts zum Wiederholen';
export const HISTORY_LIMIT_HINT =
  'Ältere Schritte lassen sich nicht mehr rückgängig machen: Die Werkstatt merkt sich die letzten 100.';
export const renamed = (name: string): string => `Dokument umbenannt in ${name}`;
export const docCreated = (name: string): string => `Neues Dokument ${name} angelegt`;
export const docClosed = (name: string): string => `${name} geschlossen`;
export const docDuplicated = (name: string): string => `${name} angelegt`;
export const added = (docs: number, pageCount: number): string =>
  docs === 1
    ? `1 Dokument mit ${pages(pageCount)} hinzugefügt`
    : `${docs} Dokumente mit zusammen ${pages(pageCount)} hinzugefügt`;
export const addedInto = (n: number, doc: string): string => `${pages(n)} in ${doc} eingefügt`;
export const NO_PAGE = 'Wähle zuerst eine Seite aus.';

/** Vorgabename einer Kopie (Freigabe bei Anhaltepunkt B) */
export const copyName = (name: string): string => `${name} (Kopie)`;
export const newDocName = (n: number): string => `Dokument ${n}`;

// Menüs und Dialoge
export const docMenuLabel = (name: string): string => `Menü für ${name}`;
export const moveSubtitle = (n: number, docs: number): string =>
  docs > 1 ? `${pages(n)} aus ${docs} Dokumenten` : pages(n);
export const AFTER_PAGE_INVALID = (max: number): string =>
  max === 0
    ? 'Das Dokument hat noch keine Seiten. Wähle „Anfang“ oder „Ende“.'
    : `Gib eine Seite von 1 bis ${max} ein.`;

export const EMPTY_DOC = `Noch keine Seiten. Verschiebe Seiten hierher oder füge sie mit ${combo('mod', 'V')} ein.`;

// Ziehen (plan-phase3.md 6.4: Textentsprechung der Einfügemarke)
export const dragTarget = (doc: string, before: number | null): string =>
  before === null ? `Ziel: Ende von ${doc}` : `Ziel: vor Seite ${before} von ${doc}`;
export const DRAG_NO_TARGET = 'Kein Ziel. Zum Ablegen über ein Dokument ziehen.';
export const DRAG_CANCELLED = 'Ziehen abgebrochen';
export const NOTHING_MOVED = 'Die Seiten stehen schon an dieser Stelle.';

// Große Vorschau
export const previewTitle = (doc: string, position: number, count: number): string =>
  `${doc}: Seite ${position} von ${count}`;

// Leere Seite (W14: Größe der Nachbarseite, DIN A4 hoch oder quer)
const cm = (pt: number): string => ((pt / 72) * 2.54).toFixed(1).replace('.', ',');
export const blankLikeNeighbour = (width: number, height: number): string =>
  `Wie die Nachbarseite (${cm(width)} × ${cm(height)} cm)`;
export const BLANK_A4_PORTRAIT = 'DIN A4 hoch';
export const BLANK_A4_LANDSCAPE = 'DIN A4 quer';
export const blankInserted = (doc: string, position: number): string =>
  `Leere Seite in ${doc} an Position ${position} eingefügt`;

// Teilen und Zusammenführen (Vorgabenamen: Freigabe bei Anhaltepunkt B)
export const partName = (name: string): string => `${name} (Teil 2)`;
export const splitDone = (doc: string, before: number): string =>
  `${doc} vor Seite ${before} geteilt`;
export const SPLIT_FIRST_PAGE =
  'Vor der ersten Seite lässt sich nicht teilen. Wähle die Seite, mit der das neue Dokument beginnen soll.';
export const merged = (count: number, doc: string): string =>
  `${count} Dokumente zu ${doc} zusammengeführt`;
export const MERGE_TOO_FEW = 'Wähle mindestens zwei Dokumente.';

// Export (plan-phase3.md Abschnitt 9)
export const exportDocLabel = (name: string): string => `${name} als PDF speichern`;
export const SELECTION_NAME = 'Auswahl';
export const ZIP_NAME = 'pdf-werkstatt.zip';
export const exporting = (done: number, total: number): string =>
  total > 0 ? `Wird gespeichert: ${done} von ${pages(total)} …` : 'Wird gespeichert …';
export function exportDone(names: readonly string[], unchanged: number, zip: boolean): string {
  const what = zip
    ? `${names.length} Dokumente sind als ZIP gespeichert.`
    : `${names[0] ?? ''} ist gespeichert.`;
  // W12: unverändert übernommene Dokumente kurz nennen
  const note =
    unchanged === 0
      ? ''
      : zip
        ? ` ${unchanged === 1 ? 'Eines davon war' : `${unchanged} davon waren`} unverändert und ${unchanged === 1 ? 'ist' : 'sind'} die Originaldatei.`
        : ' Es war unverändert: Gespeichert ist die Originaldatei.';
  return `Fertig: ${what}${note}`;
}

/** Hinweis vor dem Export: was beim Neuzusammensetzen verloren geht (wie im Zusammenfügen) */
export function lossNote(
  entries: readonly {
    name: string;
    facts: { form: boolean; xfa: boolean; outline: boolean; signed: boolean };
  }[],
): string {
  const parts = entries.slice(0, 3).map(({ name, facts }) => {
    const items = [
      facts.form || facts.xfa ? 'Formularfelder' : '',
      facts.outline ? 'Lesezeichen' : '',
      facts.signed ? 'eine digitale Signatur' : '',
    ].filter(Boolean);
    const list =
      items.length > 1
        ? `${items.slice(0, -1).join(', ')} und ${items[items.length - 1] ?? ''}`
        : (items[0] ?? '');
    return `${name} enthält ${list}.`;
  });
  const more = entries.length > 3 ? ` Weitere ${entries.length - 3} Dateien ebenso.` : '';
  return `${parts.join(' ')}${more} Beim Speichern als neu zusammengesetzte PDF sind sie nicht mehr enthalten, wie beim Zusammenfügen.`;
}
