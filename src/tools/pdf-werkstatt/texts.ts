/**
 * Texte der PDF-Werkstatt an einer Stelle (AGENTS.md Abschnitt 7). Freigegeben am 27.09.2026
 * (docs/texte-pdf-werkstatt.md), die der Stufe 2.1 unten ebenfalls (Abschnitt 10). Die
 * Befehlsnamen stehen in src/core/workshop/commands.ts.
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
  // „Versteckte Angaben entfernen“ (Text wie in „PDF-Metadaten entfernen“)
  'metadata-left':
    'In der neuen Datei wurden noch Angaben gefunden. Sie wird deshalb nicht angeboten.',
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
  /** Seiten-Operationen (Stufe 2.2) */
  stamp?: boolean;
  signatures?: number;
}

/** Beschriftung einer Seite für Screenreader (plan-phase3.md 6.4) */
export function pageLabel(d: PageDescription): string {
  const from = d.source
    ? d.source.page === null
      ? `aus ${d.source.name}`
      : `aus ${d.source.name} Seite ${d.source.page}`
    : 'leere Seite';
  const turned = d.rotate ? `, gedreht um ${d.rotate} Grad` : '';
  const ops = [
    d.stamp ? 'mit Stempel' : '',
    d.signatures === 1
      ? 'mit Unterschrift'
      : d.signatures
        ? `mit ${d.signatures} Unterschriften`
        : '',
  ]
    .filter(Boolean)
    .map((o) => `, ${o}`)
    .join('');
  return `Seite ${d.position} von ${d.count}, ${from}${turned}${ops}`;
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
export const docCreated = (name: string): string => `${name} angelegt`;
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
    ? 'Das Dokument hat noch keine Seiten. Wähle „Am Anfang“ oder „Am Ende“.'
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
export function exportDone(
  names: readonly string[],
  unchanged: number,
  zip: boolean,
  stripped = false,
): string {
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
  // Schritt 2.4, freigegeben von Leon am 27.09.2026
  const clean = stripped
    ? zip
      ? ' Die Dateien enthalten keine versteckten Angaben mehr.'
      : ' Die Datei enthält keine versteckten Angaben mehr.'
    : '';
  return `Fertig: ${what}${note}${clean}`;
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
  return `${parts.join(' ')}${more} Diese Angaben sind in neu zusammengesetzten PDFs nicht mehr enthalten.`;
}

// Handy-Ansicht (plan-phase3.md 5.4)
export const mobileDocOption = (name: string, count: number): string => `${name} (${count})`;
export const mobileStatus = (count: number): string =>
  count > 0 ? `${pages(count)} ausgewählt` : 'Tippe auf Seiten, um sie auszuwählen.';
export const MOBILE_HINT = 'Tippen öffnet die Vorschau. Für mehrere Seiten auf „Auswählen“ tippen.';

// Stufe 2: Werkzeuge in der Werkstatt (plan-phase3.md Abschnitt 7)
export const TOOLS_MENU = 'Werkzeuge';
export const PAGE_NUMBERS_ITEM = 'Seitenzahlen …';
export const PAGE_NUMBERS_TITLE = 'Seitenzahlen';
export const toolDoc = (name: string, count: number): string => `Für ${name}, ${pages(count)}`;
export const pageNumbersSet = (name: string): string =>
  `Seitenzahlen für ${name} übernommen. Sie werden beim Speichern gesetzt.`;
export const pageNumbersRemoved = (name: string): string => `Seitenzahlen von ${name} entfernt`;
export const PAGE_NUMBERS_BADGE = 'Mit Seitenzahlen';
export const pageNumbersEdit = (name: string): string => `Seitenzahlen von ${name} bearbeiten`;

// Stufe 2.2: Stempel und Unterschrift als Seiten-Operationen, freigegeben von Leon am 27.09.2026
export const STAMP_ITEM = 'Stempel …';
export const STAMP_TITLE = 'Stempel';
export const stampSet = (count: number, name: string): string =>
  `Stempel für ${pages(count)} von ${name} übernommen. Er wird beim Speichern gesetzt.`;
export const stampRemoved = (name: string): string => `Stempel von ${name} entfernt`;
export const SIGN_ITEM = 'Unterschrift …';
export const SIGN_TITLE = 'Unterschrift';
export const pageOf = (n: number, name: string): string => `Seite ${n} von ${name}`;
export const signDoc = (n: number, name: string): string => `Für Seite ${n} von ${name}`;
export const signPlace = (n: number): string => `Auf Seite ${n} setzen …`;
export const signRemove = (n: number): string => `Unterschriften von Seite ${n} entfernen`;
export const SIGN_NEEDED = 'Erstell zuerst deine Unterschrift: zeichnen oder ein Bild auswählen.';
export const SIGN_HINT =
  'Die Unterschrift gehört zur Seite und wandert mit, wenn du sie verschiebst oder drehst. Gesetzt wird sie beim Speichern.';
export const signDialogTitle = (n: number, name: string): string =>
  `Unterschrift auf Seite ${n} von ${name}`;
export const signatureRectLabel = (i: number, page: string): string =>
  `Unterschrift ${i} auf ${page}`;
export const signSet = (n: number, name: string): string =>
  `Unterschrift auf Seite ${n} von ${name} übernommen. Sie wird beim Speichern gesetzt.`;
export const signRemoved = (n: number, name: string): string =>
  `Unterschriften von Seite ${n} von ${name} entfernt`;

// Stufe 2.3: Schwärzen und Formular ausfüllen („Einbacken“), freigegeben von Leon am 27.09.2026
export const REDACT_ITEM = 'Schwärzen …';
/** Name der neuen Quelle, z. B. in der Seitenbeschriftung „aus Vertrag (geschwärzt).pdf Seite 2“ */
export const redactedName = (doc: string): string => `${doc} (geschwärzt).pdf`;
export const filledName = (file: string): string =>
  `${file.replace(/\.pdf$/i, '')} (ausgefüllt).pdf`;
export const REDACT_TITLE = 'Schwärzen';
export const REDACT_HINT =
  'Geschwärzt wird das ganze Dokument: Jede Seite wird zum Bild, auch Seiten ohne Bereich. Stempel und Unterschriften bleiben änderbar.';
export const REDACT_AREAS = 'Bereiche festlegen …';
export const REDACT_APPLY = 'Dokument schwärzen';
export const redactProgress = (n: number, total: number): string => `Seite ${n} von ${total} …`;
export const REDACT_BUILDING = 'PDF wird erstellt …';
export const redactDone = (name: string): string =>
  `${name} ist geschwärzt. Prüf das Ergebnis, bevor du es weitergibst.`;
export const REDACT_CHANGED =
  'Das Dokument hat sich während des Schwärzens geändert. Schwärze es noch einmal.';
export const REDACT_FAILED =
  'Die geschwärzte PDF konnte nicht erzeugt werden. Wähle eine geringere Auflösung und versuch es noch einmal.';
export const redactDialogTitle = (name: string): string => `Bereiche schwärzen in ${name}`;
export const redactPageLabel = (n: number, total: number): string => `Seite ${n} von ${total}`;
export const redactRectLabel = (i: number, page: number): string =>
  `Bereich ${i} auf Seite ${page}`;

/** Seiten aus derselben Datei, nicht geschwärzt (Hinweis nach dem Schwärzen und beim Speichern) */
export const unredacted = (count: number, name: string): string =>
  count === 1
    ? `1 Seite in ‚${name}‘ stammt aus derselben Datei und ist nicht geschwärzt.`
    : `${count} Seiten in ‚${name}‘ stammen aus derselben Datei und sind nicht geschwärzt.`;
export const UNREDACTED_SHOW = 'Zu den Seiten';
export const UNREDACTED_TITLE = 'Nicht geschwärzte Seiten';
export const UNREDACTED_SAVE = 'Trotzdem speichern';

export const FORM_ITEM = 'Formular ausfüllen …';
export const FORM_TITLE = 'Formular ausfüllen';
export const formDoc = (file: string, doc: string): string => `Für ${doc}, Formular aus ${file}`;
export const FORM_LOADING = 'Formular wird gelesen …';
export const formHint = (file: string): string =>
  `Die ausgefüllten Seiten ersetzen in diesem Dokument die Seiten aus ${file}.`;
export const FORM_APPLY = 'Formular übernehmen';
export const FORM_BUSY = 'Wird ausgefüllt …';
export const formApplied = (name: string): string => `Formular in ${name} übernommen`;
export const FORM_CHANGED =
  'Das Dokument hat sich während des Ausfüllens geändert. Übernimm das Formular noch einmal.';

// Stufe 2.4: versteckte Angaben (Metadaten) beim Speichern, freigegeben von Leon am 27.09.2026
export const METADATA_LABEL = 'Versteckte Angaben';
export const METADATA_KEEP = 'Behalten';
export const METADATA_STRIP = 'Entfernen';
export const METADATA_HINT =
  'Angaben wie Autor, Titel, Programm und Datum. Beim Entfernen wird jedes Dokument neu zusammengesetzt und vor dem Speichern geprüft.';
export const metadataKeptNote = (names: readonly string[]): string =>
  names.length === 1
    ? `${names[0] ?? ''} enthält versteckte Angaben wie Autor, Programm oder Datum. Sie bleiben beim Speichern erhalten.`
    : `${names.length} Dokumente enthalten versteckte Angaben wie Autor, Programm oder Datum: ${names.join(', ')}. Sie bleiben beim Speichern erhalten.`;

// ---------------------------------------------------------------------------------------------
// Umbau zum Editor (27.09.2026), zur Durchsicht: docs/texte-pdf-werkstatt.md, Abschnitt
// „Umbau, zur Durchsicht“

/** Menüleiste */
export const M = {
  file: 'Datei',
  edit: 'Bearbeiten',
  page: 'Seite',
  doc: 'Dokument',
  tools: 'Werkzeuge',
  view: 'Ansicht',
  help: 'Hilfe',
} as const;

/** Namen der Befehle in Menüs, Werkzeugleiste und Kontextmenüs */
export const C = {
  open: 'Dateien öffnen …',
  newDoc: 'Neues Dokument',
  newDocEntry: 'Neues Dokument',
  append: 'Dateien anhängen …',
  docFallback: 'Dokument',
  saveSelection: 'Auswahl als neue PDF speichern',
  saveAll: 'Alle als ZIP speichern',
  metaKeep: 'Behalten',
  metaStrip: 'Entfernen',
  closeDoc: 'Dokument schließen',
  undo: 'Rückgängig',
  redo: 'Wiederholen',
  cut: 'Ausschneiden',
  copy: 'Kopieren',
  paste: 'Einfügen',
  pasteBefore: 'Davor einfügen',
  pasteAfter: 'Danach einfügen',
  pasteHere: 'Hier einfügen',
  pasteStart: 'Am Anfang einfügen',
  pasteEnd: 'Am Ende einfügen',
  duplicate: 'Duplizieren',
  delete: 'Löschen',
  selectAll: 'Alle Seiten des Dokuments auswählen',
  selectEverything: 'Alle Seiten aller Dokumente auswählen',
  selectNone: 'Auswahl aufheben',
  invert: 'Auswahl umkehren',
  selectMore: 'Seiten auswählen',
  selectOdd: 'Ungerade Seiten',
  selectEven: 'Gerade Seiten',
  selectRange: 'Seitenbereich …',
  selectGroup: 'Auswahl',
  goTo: 'Gehe zu Seite …',
  rotate: 'Drehen',
  rotateRight: 'Rechts drehen',
  rotateLeft: 'Links drehen',
  rotate180: 'Um 180 Grad drehen',
  shiftUp: 'Eine Stelle nach vorne',
  shiftDown: 'Eine Stelle nach hinten',
  reverse: 'Reihenfolge umkehren',
  move: 'Verschieben nach …',
  moveToDoc: 'Zu Dokument verschieben',
  copyToDoc: 'In Dokument kopieren',
  extract: 'In neues Dokument',
  extractCopy: 'Als Kopie in neues Dokument',
  blankMenu: 'Leere Seite einfügen',
  blankBefore: 'Leere Seite davor',
  blankAfter: 'Leere Seite danach',
  blankHere: 'Leere Seite hier',
  blankNeighbour: 'Wie die Nachbarseite',
  cutToggle: 'Trennlinie setzen oder entfernen',
  cutSetHere: 'Trennlinie davor setzen',
  cutRemoveHere: 'Trennlinie davor entfernen',
  splitHere: 'Dokument hier teilen',
  splitCuts: 'An Trennlinien teilen',
  cutsEvery: 'Trennlinien alle … Seiten',
  portrait: 'Querformat hochkant drehen',
  clearCuts: 'Alle Trennlinien entfernen',
  openSingle: 'Seite groß zeigen',
  rename: 'Umbenennen',
  duplicateDoc: 'Dokument duplizieren',
  merge: 'Dokumente zusammenführen …',
  mergeWith: 'Zusammenführen mit',
  mergeDialog: 'Mehrere, mit Reihenfolge …',
  docUp: 'Dokument nach oben',
  docDown: 'Dokument nach unten',
  fold: 'Seiten einklappen',
  unfold: 'Seiten ausklappen',
  foldAll: 'Alle Dokumente einklappen',
  unfoldAll: 'Alle Dokumente ausklappen',
  toolSelect: 'Auswahlwerkzeug',
  toolScissors: 'Schere',
  viewGrid: 'Seitenraster',
  viewSingle: 'Einzelseite',
  zoomIn: 'Vergrößern',
  zoomOut: 'Verkleinern',
  zoomReset: 'Zoom 100 %',
  zoomFit: 'Einpassen',
  panelLeft: 'Dokumente und Seiten links',
  panelRight: 'Eigenschaften und Verlauf rechts',
  shortcuts: 'Tastenkürzel',
  guide: 'So funktioniert die Werkstatt',
} as const;

/** Eigenschaften rechts */
export const P = {
  selection: 'Auswahl',
  selected: 'Ausgewählt',
  noSelection: `Keine Seite ausgewählt. Klick auf eine Seite, zieh einen Rahmen auf oder drück ${combo('mod', 'A')}.`,
  page: 'Seite',
  position: 'Stelle',
  source: 'Herkunft',
  blank: 'Leere Seite',
  size: 'Größe',
  rotation: 'Gedreht',
  ops: 'Beim Speichern',
  stamp: 'Stempel',
  cut: 'Trennlinie davor',
  yes: 'ja',
  no: 'nein',
  doc: 'Dokument',
  noDoc: 'Noch kein Dokument. Öffne PDFs oder Bilder.',
  name: 'Name',
  pages: 'Seiten',
  files: 'Aus',
  cuts: 'Trennlinien',
  save: 'Speichern',
  tool: 'Werkzeug',
  selectHint:
    'Klick wählt eine Seite, Umschalt einen Bereich, Strg einzelne dazu. Ein Klick in den Zwischenraum zweier Seiten setzt eine Trennlinie.',
  scissorsHint:
    'Klick auf eine Seite teilt das Dokument davor (linke Hälfte) oder danach (rechte Hälfte), sofort. Esc beendet die Schere.',
} as const;

export const undoItem = (label: string): string => `Rückgängig: ${label}`;
export const redoItem = (label: string): string => `Wiederholen: ${label}`;
export const docWithCount = (name: string, count: number): string => `${name} (${pages(count)})`;
export const pasteEndOf = (name: string): string => `Am Ende von ${name} einfügen`;
export const PAGE_MENU = 'Seite';
export const GAP_MENU = 'Zwischenraum';
export const EMPTY_MENU = 'Arbeitsfläche';

// Raster
export const foldDoc = (name: string): string => `Seiten von ${name} einklappen`;
export const unfoldDoc = (name: string): string => `Seiten von ${name} ausklappen`;
export const folded = (name: string): string => `${name} eingeklappt`;
export const unfolded = (name: string): string => `${name} ausgeklappt`;
export const partsLabel = (n: number): string => `${n} Teile`;
export const splitAtCutsLabel = (name: string, parts: number): string =>
  `${name} an den Trennlinien in ${parts} Dokumente teilen`;
export const splitAtCutsItem = (parts: number): string => `An Trennlinien teilen (${parts} Teile)`;
export const cutlineLabel = (page: number): string => `Neues Dokument ab Seite ${page}`;
export const CUT_REMOVE = 'Trennlinie entfernen';
export const GAP_TITLE = 'Trennlinie setzen';
export const CUT_BEFORE_SUFFIX = ', Trennlinie davor';
export const BLANK_BADGE = 'leer';

// Trennlinien, Schere, Teilen
export const partNameN = (name: string, n: number): string => `${name} (Teil ${n})`;
export const cutSet = (count: number, index: number): string =>
  count === 1 ? `Trennlinie vor Seite ${index + 1} gesetzt` : `${count} Trennlinien gesetzt`;
export const cutRemoved = (count: number): string =>
  count === 1 ? 'Trennlinie entfernt' : `${count} Trennlinien entfernt`;
export const CUT_FIRST_PAGE = 'Vor der ersten Seite gibt es keine Trennlinie.';
export const NO_CUTS =
  'Das Dokument hat keine Trennlinien. Klick zwischen zwei Seiten, um eine zu setzen.';
export const splitAtCutsDone = (name: string, parts: number): string =>
  `${name} in ${parts} Dokumente geteilt`;
export const cutsCleared = (name: string): string => `Trennlinien von ${name} entfernt`;
export const SPLIT_EDGE = 'Am Anfang oder Ende eines Dokuments gibt es nichts zu teilen.';

// Weitere Seitenbefehle
export const rotatedHalf = (n: number): string => `${pages(n)} um 180 Grad gedreht`;
export const reversed = (n: number): string => `Reihenfolge von ${pages(n)} umgekehrt`;
export const REVERSE_NEEDS_TWO = 'Wähle mindestens zwei Seiten eines Dokuments.';
export const movedToNew = (n: number, name: string): string =>
  `${pages(n)} nach ${name} verschoben`;
export const docMoved = (name: string, position: number, count: number): string =>
  `${name} steht jetzt an Stelle ${position} von ${count}`;

// Linke Leiste
export const RAIL_TITLE = 'Seiten';
export const railTitle = (name: string): string => `Seiten von ${name}`;
export const railLabel = (n: number, count: number, selected: boolean): string =>
  `Seite ${n} von ${count}${selected ? ', ausgewählt' : ''}`;
export const docMetaSelected = (count: number, selected: number): string =>
  `${pages(count)}, ${selected} ausgewählt`;
export const FLAG_NUMBERS = 'Seitenzahlen';
export const FLAG_REDACTED = 'geschwärzt';
export const docItemLabel = (name: string, count: number, flags: readonly string[]): string =>
  [name, pages(count), ...flags].join(', ');

// Ziehen
export const dragStart = (n: number): string =>
  `${pages(n)} aufgenommen. Zum Ablegen loslassen, Esc bricht ab, Alt kopiert.`;
export const dragDocStart = (name: string): string =>
  `${name} aufgenommen. Zwischen zwei Dokumente ziehen ordnet um, auf ein Dokument führt zusammen.`;
export const dragMerge = (name: string): string => `Ziel: mit ${name} zusammenführen`;
export const dragOrder = (position: number): string => `Ziel: an Stelle ${position} der Liste`;
export const DROP_NEW_DOC = 'Hier ablegen für ein neues Dokument';

// Eigenschaften und Verlauf
export const pageOfDoc = (n: number, count: number, name: string): string =>
  `${n} von ${count} in ${name}`;
export const sourcePage = (name: string, page: number): string => `${name}, Seite ${page}`;
export const sizeLabel = (w: string, h: string): string => `${w} × ${h} cm`;
export const degrees = (d: number): string => (d === 0 ? 'nein' : `${d} Grad`);
export const signaturesCount = (n: number): string =>
  n === 1 ? '1 Unterschrift' : `${n} Unterschriften`;
export const filesCount = (n: number): string => `${n} Dateien`;
export const HISTORY_START = 'Beginn';
export const HISTORY_TRUNCATED = 'Ältere Schritte sind nicht mehr gespeichert (höchstens 100).';
export const historyStepLabel = (label: string, current: boolean, undone: boolean): string =>
  `${label}${current ? ', aktueller Stand' : undone ? ', zurückgenommen' : ''}`;

// Statusleiste
export const statusPages = (count: number, docs: number): string =>
  `${pages(count)} in ${docs === 1 ? '1 Dokument' : `${docs} Dokumenten`}`;
export const STATUS_EMPTY = 'Keine Dokumente geöffnet';
export const STATUS_DIRTY = 'Nicht gespeichert';
export const STATUS_SAVED = 'Gespeichert';
export const memoryShort = (size: string): string => `${size} geöffnet`;
export const zoomValue = (zoom: number): string => `${zoom} %`;
export const zoomResetLabel = (zoom: number): string => `Zoom ${zoom} %, auf 100 % zurücksetzen`;

// Ansicht und Werkzeuge
export const VIEW_SINGLE_ON = 'Einzelseite. Pfeiltasten blättern, Esc zeigt wieder alle Seiten.';
export const VIEW_GRID_ON = 'Seitenraster';
export const TOOL_SCISSORS_ON =
  'Schere: Klick vor oder nach einer Seite teilt das Dokument. Esc beendet die Schere.';
export const TOOL_SELECT_ON = 'Auswahlwerkzeug';

// Dialoge
export const GOTO_TITLE = 'Gehe zu Seite';
export const gotoSub = (name: string, count: number): string => `${name}, ${pages(count)}`;
export const GOTO_LABEL = 'Seite';
export const GOTO_OK = 'Zur Seite';
export const RANGE_TITLE = 'Seiten auswählen';
export const RANGE_LABEL = 'Seiten, z. B. 1-3, 7, 10-12';
export const RANGE_OK = 'Auswählen';
export const rangeError = (count: number): string =>
  `Gib Seiten von 1 bis ${count} ein, einzeln mit Komma getrennt oder als Bereich mit Bindestrich.`;
export const orderUp = (name: string): string => `${name} nach oben`;
export const orderDown = (name: string): string => `${name} nach unten`;
export const mergeOrderMoved = (name: string, position: number): string =>
  `${name} an Stelle ${position}`;
export const SHORTCUTS_SUB =
  'Gelten überall in der Werkstatt, außer beim Schreiben in einem Eingabefeld. Alle Befehle stehen auch in den Menüs.';
export const GRID_KEYS_TITLE = 'Im Seitenraster';
export const GRID_KEYS: readonly (readonly [string, string])[] = [
  ['Pfeiltasten', 'Zur nächsten Seite, auch ins nächste Dokument'],
  [combo('shift', 'Pfeiltasten'), 'Auswahl erweitern'],
  ['Leertaste', 'Seite auswählen oder abwählen'],
  ['Pos1 / Ende', 'Erste oder letzte Seite des Dokuments'],
  ['Eingabe', 'Seite groß zeigen'],
  [combo('shift', 'F10'), 'Menü der Seite'],
  ['F10', 'Menüleiste'],
];

// Teilen nach Seitenzahl, Querformat hochkant
export const CUTS_EVERY_TITLE = 'Trennlinien alle … Seiten';
export const CUTS_EVERY_LABEL = 'Seiten je Teil';
export const CUTS_EVERY_OK = 'Trennlinien setzen';
export const cutsEverySub = (name: string, count: number): string =>
  `${name}, ${pages(count)}. Vorhandene Trennlinien werden ersetzt; geteilt wird erst mit „An Trennlinien teilen“.`;
export const cutsEveryError = (count: number): string =>
  `Gib eine Zahl von 1 bis ${Math.max(1, count - 1)} ein.`;
export const cutsEveryDone = (parts: number, name: string): string =>
  `Trennlinien gesetzt: ${name} ergibt ${parts} Teile. Mit „An Trennlinien teilen“ entstehen die Dokumente.`;
export const CUTS_EVERY_NONE =
  'Das Dokument ist nicht länger als ein Teil. Es wurde keine Trennlinie gesetzt.';
export const portraitDone = (n: number): string => `${pages(n)} im Querformat hochkant gedreht`;
export const PORTRAIT_NONE = 'Keine der Seiten steht im Querformat.';
