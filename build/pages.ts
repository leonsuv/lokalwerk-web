/**
 * Seitenregister: jede ausgelieferte HTML-Seite mit URL, Titel und Meta-Beschreibung.
 * Titel und Meta-Beschreibungen der Phase 1 von Leon freigegeben am 25.09.2026; neue und
 * geänderte Texte aus Phase 2 sind Entwürfe zur Freigabe (docs/texte-zur-freigabe.md).
 * /pro/ ist bis zur Verfügbarkeit von Pro noindex und nicht in der Sitemap.
 *
 * Werkzeugseiten tragen zusätzlich `tool` (plan-phase2.md Abschnitt 3.5). Daraus entstehen
 * beim Build die Übersicht /werkzeuge/, die Karten der Startseite, die Blöcke „Passt dazu“
 * und die Auswahl nach Dateiart auf der Startseite. build/registry.ts prüft die Angaben.
 *
 * Diese Datei wird auch im Browser geladen (Startseite): keine Node-Module importieren.
 */

import type { FileKind } from '../src/core/files/classify.ts';

export type { FileKind };

export const SITE_URL = 'https://lokalwerk.eu';

export type NavKey = 'werkzeuge' | 'pro';

/** Kategorie-Klasse aus src/styles/tokens.css (setzt --c, --cs, --ci). */
export type CategoryId = 'pdf' | 'img' | 'sepa' | 'tab' | 'util';

export interface Category {
  id: CategoryId;
  name: string;
  /** Sprungmarke auf /werkzeuge/ */
  anchor: string;
}

/** Reihenfolge = Reihenfolge auf /werkzeuge/. Farben: plan-phase2.md Abschnitt 4 und E15. */
export const CATEGORIES: readonly Category[] = [
  { id: 'pdf', name: 'PDF', anchor: 'pdf' },
  { id: 'img', name: 'Fotos und Bilder', anchor: 'fotos' },
  { id: 'tab', name: 'Tabellen und Listen', anchor: 'tabellen' },
  { id: 'sepa', name: 'Zahlungsverkehr und Verein', anchor: 'zahlungsverkehr' },
  { id: 'util', name: 'Alltag und Sicherheit', anchor: 'alltag' },
];

export interface ToolInfo {
  /** Kurzname für Verweise im Register, gleich dem URL-Pfad ohne Schrägstriche */
  id: string;
  /** Name auf Karten und in der Auswahl */
  name: string;
  /** Ein Satz für Karten */
  short: string;
  category: CategoryId;
  /** Symbol-ID aus src/partials/icons.svg */
  icon: string;
  /** Weitere Suchwörter für die Suche auf /werkzeuge/ (Synonyme, andere Schreibweisen) */
  keywords: readonly string[];
  /** IDs verwandter Werkzeuge für „Passt dazu“, in dieser Reihenfolge */
  related: readonly string[];
  /** Welche Dateien das Werkzeug von der Startseite übernehmen kann */
  accepts?: { kind: FileKind; multiple: boolean };
  /** Auf der Startseite zeigen, mit optionalem Schlagwort auf der Karte */
  home?: { tag?: string };
}

export interface PageDef {
  /** Pfad der HTML-Datei relativ zu `pages/`. */
  file: string;
  /** Öffentliche URL ab der Domain, mit abschließendem Schrägstrich. */
  url: string;
  title: string;
  description: string;
  /** false setzt `noindex` und lässt die Seite aus der Sitemap. */
  index: boolean;
  /** Welcher Hauptnavigationspunkt als aktuell markiert wird. */
  nav: NavKey | null;
  /** Nur Werkzeugseiten */
  tool?: ToolInfo;
}

export type ToolPage = PageDef & { tool: ToolInfo };

export const PAGES: readonly PageDef[] = [
  {
    file: 'index.html',
    url: '/',
    // Entwurf zur Freigabe (plan-phase2.md E16)
    title: 'Lokalwerk – PDF, Fotos, Tabellen und SEPA kostenlos im Browser bearbeiten',
    description:
      'PDFs zusammenfügen und teilen, Fotos verkleinern und umwandeln, SEPA-Dateien erstellen. Kostenlos, direkt im Browser, ohne Upload deiner Dateien.',
    index: true,
    nav: null,
  },
  {
    file: 'werkzeuge/index.html',
    url: '/werkzeuge/',
    title: 'Alle Werkzeuge – PDF, Fotos, Tabellen und SEPA ohne Upload | Lokalwerk',
    description:
      'Alle Werkzeuge von Lokalwerk auf einen Blick: PDF, Fotos, Tabellen und Zahlungsverkehr. Kostenlos, direkt im Browser, ohne Upload deiner Dateien.',
    index: true,
    nav: 'werkzeuge',
  },
  {
    file: 'pdf-zusammenfuegen/index.html',
    url: '/pdf-zusammenfuegen/',
    title: 'PDF zusammenfügen – kostenlos und ohne Upload | Lokalwerk',
    description:
      'Mehrere PDF-Dateien kostenlos zu einer zusammenfügen, Reihenfolge frei wählbar. Läuft komplett in deinem Browser, ohne Upload und ohne Anmeldung.',
    index: true,
    nav: 'werkzeuge',
    tool: {
      id: 'pdf-zusammenfuegen',
      name: 'PDFs zusammenfügen',
      short: 'Mehrere PDFs zu einer Datei verbinden. Reihenfolge frei wählbar.',
      category: 'pdf',
      icon: 'i-pdf',
      keywords: ['verbinden', 'zusammenführen', 'kombinieren', 'mergen', 'merge'],
      related: ['pdf-teilen', 'bilder-zu-pdf'],
      accepts: { kind: 'pdf', multiple: true },
      home: { tag: 'Beliebt' },
    },
  },
  {
    file: 'pdf-teilen/index.html',
    url: '/pdf-teilen/',
    title: 'PDF teilen und Seiten extrahieren – kostenlos, ohne Upload | Lokalwerk',
    description:
      'Seiten aus einer PDF kostenlos herausholen oder die PDF in mehrere Dateien aufteilen. Direkt im Browser, ohne Upload und ohne Anmeldung.',
    index: true,
    nav: 'werkzeuge',
    tool: {
      id: 'pdf-teilen',
      name: 'PDF teilen',
      short: 'Seiten aus einer PDF herausholen oder sie in mehrere Dateien aufteilen.',
      category: 'pdf',
      icon: 'i-scissors',
      keywords: [
        'trennen',
        'aufteilen',
        'splitten',
        'split',
        'seiten extrahieren',
        'seiten entnehmen',
        'auszug',
        'einzelne seiten',
      ],
      related: ['pdf-zusammenfuegen'],
      accepts: { kind: 'pdf', multiple: false },
      home: {},
    },
  },
  {
    file: 'pdf-seitenzahlen/index.html',
    url: '/pdf-seitenzahlen/',
    title: 'Seitenzahlen in PDF einfügen – kostenlos, ohne Upload | Lokalwerk',
    description:
      'Seitenzahlen wie „Seite 3 von 12“ kostenlos in eine PDF einfügen, Position und Startseite frei wählbar. Direkt im Browser, ohne Upload und ohne Anmeldung.',
    index: true,
    nav: 'werkzeuge',
    tool: {
      id: 'pdf-seitenzahlen',
      name: 'Seitenzahlen einfügen',
      short: 'Seitenzahlen wie „Seite 3 von 12“ in Kopf- oder Fußzeile einer PDF setzen.',
      category: 'pdf',
      icon: 'i-page-number',
      keywords: [
        'seitenzahl',
        'nummerieren',
        'paginieren',
        'seitennummer',
        'fußzeile',
        'kopfzeile',
        'anlagen',
      ],
      related: ['pdf-stempel', 'pdf-zusammenfuegen', 'pdf-teilen'],
      accepts: { kind: 'pdf', multiple: false },
    },
  },
  {
    file: 'pdf-stempel/index.html',
    url: '/pdf-stempel/',
    title: 'PDF-Wasserzeichen und Stempel einfügen – kostenlos, ohne Upload | Lokalwerk',
    description:
      'Text wie „Entwurf“ oder „Kopie“ kostenlos als Stempel oder Wasserzeichen auf die Seiten einer PDF setzen. Direkt im Browser, ohne Upload.',
    index: true,
    nav: 'werkzeuge',
    tool: {
      id: 'pdf-stempel',
      name: 'Stempel und Wasserzeichen',
      short: 'Text wie „Entwurf“ oder „Kopie“ quer über die Seiten einer PDF setzen.',
      category: 'pdf',
      icon: 'i-stamp',
      keywords: [
        'wasserzeichen',
        'stempel',
        'entwurf',
        'kopie',
        'vertraulich',
        'muster',
        'watermark',
        'kennzeichnen',
      ],
      related: ['pdf-seitenzahlen', 'pdf-metadaten-entfernen'],
      accepts: { kind: 'pdf', multiple: false },
    },
  },
  {
    file: 'pdf-metadaten-entfernen/index.html',
    url: '/pdf-metadaten-entfernen/',
    title: 'PDF-Metadaten anzeigen und entfernen – kostenlos, ohne Upload | Lokalwerk',
    description:
      'Kostenlos sehen, welche versteckten Angaben in einer PDF stecken, und Autor, Programm, Datum und frühere Fassungen entfernen. Direkt im Browser, ohne Upload.',
    index: true,
    nav: 'werkzeuge',
    tool: {
      id: 'pdf-metadaten-entfernen',
      name: 'PDF-Metadaten entfernen',
      short: 'Sehen, welche versteckten Angaben in einer PDF stecken, und sie entfernen.',
      category: 'pdf',
      icon: 'i-tag-off',
      keywords: [
        'autor',
        'titel',
        'ersteller',
        'eigenschaften',
        'dokumenteigenschaften',
        'xmp',
        'datenschutz',
        'anonymisieren',
        'bereinigen',
        'versteckte daten',
      ],
      related: ['fotos-verkleinern', 'pdf-teilen'],
      accepts: { kind: 'pdf', multiple: false },
    },
  },
  {
    file: 'bilder-zu-pdf/index.html',
    url: '/bilder-zu-pdf/',
    title: 'Bilder zu PDF: JPG und PNG in PDF umwandeln – kostenlos | Lokalwerk',
    description:
      'Fotos und Scans kostenlos zu einer PDF zusammenfassen, eine Seite je Bild, auf DIN A4. Metadaten werden entfernt. Direkt im Browser, ohne Upload.',
    index: true,
    nav: 'werkzeuge',
    tool: {
      id: 'bilder-zu-pdf',
      name: 'Bilder zu PDF',
      short: 'Fotos und Scans als JPEG oder PNG zu einer PDF zusammenfassen, eine Seite je Bild.',
      category: 'pdf',
      icon: 'i-images',
      keywords: [
        'jpg in pdf',
        'jpeg in pdf',
        'png in pdf',
        'foto in pdf',
        'bild in pdf',
        'umwandeln',
        'konvertieren',
        'scan',
        'belege',
        'a4',
      ],
      related: ['fotos-verkleinern', 'pdf-zusammenfuegen'],
      accepts: { kind: 'image', multiple: true },
      home: {},
    },
  },
  {
    file: 'fotos-verkleinern/index.html',
    url: '/fotos-verkleinern/',
    title: 'Fotos verkleinern und Metadaten entfernen – kostenlos | Lokalwerk',
    description:
      'Fotos kostenlos für E-Mail und Website verkleinern und dabei GPS-Position und Kameradaten entfernen. Direkt im Browser, ohne Upload.',
    index: true,
    nav: 'werkzeuge',
    tool: {
      id: 'fotos-verkleinern',
      name: 'Fotos verkleinern',
      short: 'Für E-Mail und Website verkleinern. GPS-Position und Kameradaten werden entfernt.',
      category: 'img',
      icon: 'i-img',
      keywords: [
        'bilder',
        'komprimieren',
        'verkleinern',
        'größe ändern',
        'jpg',
        'jpeg',
        'webp',
        'exif',
        'gps',
        'metadaten entfernen',
      ],
      related: ['bildformat-umwandeln', 'bilder-zu-pdf', 'pdf-metadaten-entfernen'],
      accepts: { kind: 'image', multiple: true },
      home: { tag: 'Datenschutz' },
    },
  },
  {
    file: 'bildformat-umwandeln/index.html',
    url: '/bildformat-umwandeln/',
    title: 'Bildformat umwandeln: WebP in JPG, PNG in JPG – kostenlos | Lokalwerk',
    description:
      'Bilder kostenlos zwischen JPEG, PNG und WebP umwandeln, zum Beispiel WebP in JPG. Metadaten werden entfernt. Direkt im Browser, ohne Upload.',
    index: true,
    nav: 'werkzeuge',
    tool: {
      id: 'bildformat-umwandeln',
      name: 'Bildformat umwandeln',
      short: 'Bilder zwischen JPEG, PNG und WebP umwandeln, zum Beispiel WebP in JPEG.',
      category: 'img',
      icon: 'i-convert',
      keywords: [
        'webp in jpg',
        'png in jpg',
        'jpg in png',
        'gif',
        'konvertieren',
        'konverter',
        'dateiformat',
        'jpeg',
      ],
      related: ['fotos-verkleinern', 'bilder-zu-pdf'],
      accepts: { kind: 'image', multiple: true },
    },
  },
  {
    file: 'sepa-sammelueberweisung/index.html',
    url: '/sepa-sammelueberweisung/',
    title: 'SEPA-XML aus Excel oder CSV erstellen – Sammelüberweisung | Lokalwerk',
    description:
      'Aus einer Excel- oder CSV-Liste kostenlos eine SEPA-XML-Datei für die Sammelüberweisung bei deutschen Banken erstellen. Ohne Upload.',
    index: true,
    nav: 'werkzeuge',
    tool: {
      id: 'sepa-sammelueberweisung',
      name: 'SEPA-Sammelüberweisung',
      short: 'Aus einer Excel- oder CSV-Liste eine Überweisungsdatei fürs Onlinebanking erstellen.',
      category: 'sepa',
      icon: 'i-bank',
      keywords: [
        'überweisung',
        'sammelüberweisung',
        'xml',
        'pain.001',
        'iban',
        'verein',
        'excel',
        'csv',
        'onlinebanking',
      ],
      related: ['excel-csv-umwandeln'],
      accepts: { kind: 'spreadsheet', multiple: false },
      home: { tag: 'Für Vereine' },
    },
  },
  {
    file: 'excel-csv-umwandeln/index.html',
    url: '/excel-csv-umwandeln/',
    title: 'Excel in CSV umwandeln und CSV in Excel – kostenlos, ohne Upload | Lokalwerk',
    description:
      'Excel- und ODS-Tabellen kostenlos als CSV speichern oder CSV in Excel umwandeln, mit Semikolon und richtigen Umlauten. Direkt im Browser, ohne Upload.',
    index: true,
    nav: 'werkzeuge',
    tool: {
      id: 'excel-csv-umwandeln',
      name: 'Excel und CSV umwandeln',
      short:
        'Excel-Tabellen als CSV speichern und CSV-Dateien als Excel-Datei. Mit richtigen Umlauten.',
      category: 'tab',
      icon: 'i-table',
      keywords: [
        'xlsx',
        'xls',
        'ods',
        'libreoffice',
        'calc',
        'konvertieren',
        'semikolon',
        'trennzeichen',
        'umlaute',
        'utf-8',
        'tabelle',
      ],
      related: ['sepa-sammelueberweisung'],
      accepts: { kind: 'spreadsheet', multiple: false },
      home: {},
    },
  },
  {
    file: 'csv-reparieren/index.html',
    url: '/csv-reparieren/',
    title: 'CSV reparieren: Umlaute und Trennzeichen korrigieren – kostenlos | Lokalwerk',
    description:
      'CSV-Dateien mit kaputten Umlauten wie „MÃ¼ller“ oder falschem Trennzeichen kostenlos reparieren, jede Änderung vorher sichtbar. Im Browser, ohne Upload.',
    index: true,
    nav: 'werkzeuge',
    tool: {
      id: 'csv-reparieren',
      name: 'CSV reparieren',
      short: 'Kaputte Umlaute, Trennzeichen und Kodierung einer CSV-Datei korrigieren.',
      category: 'tab',
      icon: 'i-repair',
      keywords: [
        'csv',
        'umlaute',
        'kaputt',
        'zeichensalat',
        'utf-8',
        'ansi',
        'windows-1252',
        'kodierung',
        'encoding',
        'trennzeichen',
        'semikolon',
      ],
      related: ['excel-csv-umwandeln', 'sepa-sammelueberweisung'],
    },
  },
  {
    file: 'passwort-generator/index.html',
    url: '/passwort-generator/',
    title: 'Passwort-Generator: sichere Passwörter nach BSI – ohne Server | Lokalwerk',
    description:
      'Sichere Passwörter kostenlos erzeugen, mit Länge und Zeichenarten nach den Beispielen des BSI. Direkt im Browser, nichts wird gesendet oder gespeichert.',
    index: true,
    nav: 'werkzeuge',
    tool: {
      id: 'passwort-generator',
      name: 'Passwort-Generator',
      short: 'Sichere Passwörter erzeugen, mit Länge und Zeichenarten nach den BSI-Beispielen.',
      category: 'util',
      icon: 'i-key',
      keywords: [
        'passwort',
        'kennwort',
        'generator',
        'zufall',
        'sicher',
        'bsi',
        'wlan',
        'wpa',
        'zugangsdaten',
      ],
      related: ['pruefsumme', 'pdf-metadaten-entfernen'],
    },
  },
  {
    file: 'pruefsumme/index.html',
    url: '/pruefsumme/',
    title: 'Prüfsumme berechnen: SHA-256 einer Datei prüfen – ohne Upload | Lokalwerk',
    description:
      'SHA-256 und SHA-1 einer Datei kostenlos berechnen und mit der angegebenen Prüfsumme vergleichen, auch bei sehr großen Dateien. Direkt im Browser, ohne Upload.',
    index: true,
    nav: 'werkzeuge',
    tool: {
      id: 'pruefsumme',
      name: 'Prüfsumme berechnen',
      short: 'SHA-256 einer Datei berechnen und mit der angegebenen Prüfsumme vergleichen.',
      category: 'util',
      icon: 'i-hash',
      keywords: [
        'sha256',
        'sha-256',
        'sha1',
        'hash',
        'hashwert',
        'checksum',
        'checksumme',
        'download prüfen',
        'integrität',
      ],
      related: ['passwort-generator'],
    },
  },
  {
    file: 'texte-vergleichen/index.html',
    url: '/texte-vergleichen/',
    title: 'Texte vergleichen: Unterschiede zwischen zwei Fassungen finden | Lokalwerk',
    description:
      'Zwei Texte kostenlos vergleichen, etwa Vertragsentwürfe oder Satzungen: geänderte Zeilen und Wörter werden markiert. Direkt im Browser, ohne Upload.',
    index: true,
    nav: 'werkzeuge',
    tool: {
      id: 'texte-vergleichen',
      name: 'Texte vergleichen',
      short: 'Zwei Fassungen eines Textes vergleichen, geänderte Zeilen und Wörter markiert.',
      category: 'util',
      icon: 'i-compare',
      keywords: [
        'diff',
        'unterschiede',
        'änderungen',
        'vergleich',
        'fassung',
        'vertrag',
        'satzung',
        'protokoll',
        'text',
      ],
      related: ['pruefsumme', 'excel-csv-umwandeln'],
    },
  },
  {
    file: 'kontrast-pruefen/index.html',
    url: '/kontrast-pruefen/',
    title: 'Kontrast prüfen nach WCAG 2.2 – Kontrastrechner für Farben | Lokalwerk',
    description:
      'Kontrastverhältnis zweier Farben kostenlos nach WCAG 2.2 berechnen und die Stufen AA und AAA prüfen, für Text, großen Text und Bedienelemente. Im Browser.',
    index: true,
    nav: 'werkzeuge',
    tool: {
      id: 'kontrast-pruefen',
      name: 'Kontrast prüfen',
      short: 'Kontrast von Text- und Hintergrundfarbe nach WCAG 2.2 prüfen, Stufe AA und AAA.',
      category: 'util',
      icon: 'i-contrast',
      keywords: [
        'kontrastrechner',
        'kontrastverhältnis',
        'wcag',
        'barrierefreiheit',
        'barrierefrei',
        'farben',
        'farbkontrast',
        'bfsg',
        'aa',
        'aaa',
      ],
      related: ['bildformat-umwandeln', 'texte-vergleichen'],
    },
  },
  {
    file: 'pro/index.html',
    url: '/pro/',
    title: 'Lokalwerk Pro',
    description:
      'Lokalwerk Pro für regelmäßige Arbeit mit Überweisungen und PDFs. Läuft wie alle Werkzeuge vollständig lokal.',
    index: false,
    nav: 'pro',
  },
  {
    file: 'impressum/index.html',
    url: '/impressum/',
    title: 'Impressum – Lokalwerk',
    description: 'Impressum von Lokalwerk.',
    index: false,
    nav: null,
  },
  {
    file: 'datenschutz/index.html',
    url: '/datenschutz/',
    title: 'Datenschutzerklärung – Lokalwerk',
    description: 'Datenschutzerklärung von Lokalwerk.',
    index: false,
    nav: null,
  },
  {
    file: 'lizenzen/index.html',
    url: '/lizenzen/',
    title: 'Lizenzen – Lokalwerk',
    description: 'Urheber und Lizenztexte der Bibliotheken und Schriften, die Lokalwerk verwendet.',
    index: false,
    nav: null,
  },
  {
    file: '404.html',
    url: '/404.html',
    title: 'Seite nicht gefunden – Lokalwerk',
    description: 'Diese Seite gibt es nicht.',
    index: false,
    nav: null,
  },
];

export const TOOL_PAGES: readonly ToolPage[] = PAGES.filter((p): p is ToolPage => !!p.tool);

export function toolById(id: string): ToolPage | undefined {
  return TOOL_PAGES.find((p) => p.tool.id === id);
}
