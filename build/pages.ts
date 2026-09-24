/**
 * Seitenregister: jede ausgelieferte HTML-Seite mit URL, Titel und Meta-Beschreibung.
 * Titel laut plan.md Abschnitt 3. Die Meta-Beschreibungen sind Entwürfe und werden
 * in Schritt 10 gesammelt zur Freigabe vorgelegt.
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
    title: 'Lokalwerk – Dateien bearbeiten, ohne Upload',
    description:
      'PDFs zusammenfügen, Fotos verkleinern und SEPA-Überweisungsdateien erstellen, direkt im Browser. Deine Dateien verlassen nie dein Gerät.',
    index: true,
    nav: 'werkzeuge',
  },
  {
    file: 'pdf-zusammenfuegen/index.html',
    url: '/pdf-zusammenfuegen/',
    title: 'PDFs zusammenfügen, ohne Upload – Lokalwerk',
    description:
      'Mehrere PDFs zu einer Datei zusammenfügen, Reihenfolge frei wählbar. Läuft vollständig in deinem Browser, ohne Upload und ohne Anmeldung.',
    index: true,
    nav: 'werkzeuge',
  },
  {
    file: 'fotos-verkleinern/index.html',
    url: '/fotos-verkleinern/',
    title: 'Fotos verkleinern und Metadaten entfernen – Lokalwerk',
    description:
      'Fotos für E-Mail und Website verkleinern und dabei GPS-Position und Kameradaten entfernen. Direkt im Browser, ohne Upload.',
    index: true,
    nav: 'werkzeuge',
  },
  {
    file: 'sepa-sammelueberweisung/index.html',
    url: '/sepa-sammelueberweisung/',
    title: 'SEPA-Sammelüberweisung aus Excel oder CSV – Lokalwerk',
    description:
      'Aus einer Excel- oder CSV-Liste eine SEPA-Überweisungsdatei für deutsche Banken erstellen. Direkt im Browser, ohne Upload.',
    index: true,
    nav: 'werkzeuge',
  },
  {
    file: 'pro/index.html',
    url: '/pro/',
    title: 'Lokalwerk Pro',
    description:
      'Lokalwerk Pro für regelmäßige Arbeit mit Überweisungen, Fotos und PDFs. Läuft wie alle Werkzeuge vollständig lokal.',
    index: true,
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
    file: '404.html',
    url: '/404.html',
    title: 'Seite nicht gefunden – Lokalwerk',
    description: 'Diese Seite gibt es nicht.',
    index: false,
    nav: null,
  },
];
