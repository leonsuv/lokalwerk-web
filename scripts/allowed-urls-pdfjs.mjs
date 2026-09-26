/**
 * Freigegebene Adressen in pdf.js (pdfjs-dist 6.3.289), freigegeben von Leon am 25.09.2026:
 * P1 und P2 als Gruppen, P3 einzeln als tote Adressen. Übersicht: docs/pdfjs-adressen.md.
 * Gilt nur für Dateien im Build, die pdf.js (Paket pdfjs-dist) enthalten, nicht global
 * (plan-phase2.md E14). Fundstelle: Zeile in node_modules/pdfjs-dist/build/;
 * tests/scripts/check-dist.test.ts prüft, dass die Adresse dort wirklich steht.
 * Neue Einträge nur nach Rückfrage.
 */

const pkg = 'pdfjs-dist';
const library = 'pdf.js 6.3.289';
const MAIN = 'node_modules/pdfjs-dist/build/pdf.mjs';
const WORKER = 'node_modules/pdfjs-dist/build/pdf.worker.mjs';

const XFA =
  'XML-Namensraum; der XFA-Leser von pdf.js vergleicht ihn mit den Namensräumen eingebetteter Formulardaten, ruft ihn nie ab. XFA ist bei uns abgeschaltet (enableXfa: false).';
const NO_FILES =
  'tests/scripts/check-dist.test.ts: „pdf.js erzeugt bei uns keine Dateien (tote Adressen P2.16, P3)“';

/** @type {Array<[string, number]>} Gruppe P2, verglichene Namensräume */
const P2 = [
  ['http://www.xfa.org/schema/xci/', 42398],
  ['http://www.xfa.org/schema/xfa-connection-set/', 42402],
  ['http://www.xfa.org/schema/xfa-data/', 42406],
  ['http://www.xfa.org/schema/xfa-form/', 42410],
  ['http://www.xfa.org/schema/xfa-locale-set/', 42414],
  ['http://ns.adobe.com/xdp/pdf/', 42418],
  ['http://www.w3.org/2000/09/xmldsig#', 42422],
  ['http://www.xfa.org/schema/xfa-source-set/', 42426],
  ['http://www.w3.org/1999/XSL/Transform', 42430],
  ['http://www.xfa.org/schema/xfa-template/', 42434],
  ['http://www.xfa.org/schema/xdc/', 42438],
  ['http://ns.adobe.com/xdp/', 42442],
  ['http://ns.adobe.com/xfdf/', 42446],
  ['http://www.w3.org/1999/xhtml', 42450],
  ['http://ns.adobe.com/xmpmeta/', 42454],
];

/** @type {ReadonlyArray<{ url: string, library: string, package: string, category: string, reason: string, source: string, test?: string }>} */
export const PDFJS_URLS = [
  {
    url: 'http://www.w3.org/2000/svg',
    library,
    package: pkg,
    category: 'xml-namespace',
    reason:
      'SVG-Namensraum für document.createElementNS (SVG-Filter beim Zeichnen), im Worker nur für die abgeschaltete XFA-Darstellung. Wird nie abgerufen.',
    source: `${MAIN}, Zeile 36`,
  },
  ...P2.map(([url, line]) => ({
    url,
    library,
    package: pkg,
    category: 'xml-namespace',
    reason: XFA,
    source: `${WORKER}, Zeile ${line}`,
  })),
  {
    url: 'http://www.xfa.org/schema/xfa-data/1.0/',
    library,
    package: pkg,
    category: 'xml-namespace',
    reason:
      'Namensraum im Kopf von XFA-Formulardaten, die pdf.js nur beim Speichern über saveDocument schreibt. Wir speichern nie mit pdf.js. Wird nie abgerufen.',
    source: `${WORKER}, Zeile 50100`,
    test: NO_FILES,
  },
  {
    url: 'http://example.com',
    library,
    package: pkg,
    category: 'dead-address',
    reason:
      'Platzhalter-Basis für new URL in updateUrlHash (Sprungmarke an eine Adresse hängen). Reine Textverarbeitung, wird nie abgerufen.',
    source: `${MAIN}, Zeile 396`,
    test: NO_FILES,
  },
  {
    url: 'https://foo.bar',
    library,
    package: pkg,
    category: 'dead-address',
    reason:
      'Platzhalter-Basis für new URL in getPdfFilenameFromUrl (Dateinamen aus einer Adresse ableiten). Reine Textverarbeitung, wird nie abgerufen.',
    source: `${MAIN}, Zeile 1325`,
    test: NO_FILES,
  },
];
