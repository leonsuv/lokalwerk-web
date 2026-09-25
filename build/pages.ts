/**
 * Seitenregister: jede ausgelieferte HTML-Seite mit URL, Titel und Meta-Beschreibung.
 * Titel und Meta-Beschreibungen von Leon freigegeben am 25.09.2026 (docs/texte-zur-freigabe.md).
 * /pro/ ist bis zur Verfügbarkeit von Pro noindex und nicht in der Sitemap.
 */

export const SITE_URL = 'https://lokalwerk.eu';

export type NavKey = 'werkzeuge' | 'pro';

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
}

export const PAGES: readonly PageDef[] = [
  {
    file: 'index.html',
    url: '/',
    title: 'Lokalwerk – PDF, Fotos und SEPA kostenlos im Browser bearbeiten',
    description:
      'PDF zusammenfügen, Fotos verkleinern und SEPA-Überweisungsdateien erstellen. Kostenlos, direkt im Browser, ohne Upload deiner Dateien.',
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
  },
  {
    file: 'fotos-verkleinern/index.html',
    url: '/fotos-verkleinern/',
    title: 'Fotos verkleinern und Metadaten entfernen – kostenlos | Lokalwerk',
    description:
      'Fotos kostenlos für E-Mail und Website verkleinern und dabei GPS-Position und Kameradaten entfernen. Direkt im Browser, ohne Upload.',
    index: true,
    nav: 'werkzeuge',
  },
  {
    file: 'sepa-sammelueberweisung/index.html',
    url: '/sepa-sammelueberweisung/',
    title: 'SEPA-XML aus Excel oder CSV erstellen – Sammelüberweisung | Lokalwerk',
    description:
      'Aus einer Excel- oder CSV-Liste kostenlos eine SEPA-XML-Datei für die Sammelüberweisung bei deutschen Banken erstellen. Ohne Upload.',
    index: true,
    nav: 'werkzeuge',
  },
  {
    file: 'pro/index.html',
    url: '/pro/',
    title: 'Lokalwerk Pro',
    description:
      'Lokalwerk Pro für regelmäßige Arbeit mit Überweisungen, Fotos und PDFs. Läuft wie alle Werkzeuge vollständig lokal.',
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
