/**
 * Freigegebene Adressen in pdf.js (pdfjs-dist 6.3.289), freigegeben von Leon am 25.09.2026:
 * P1 und P2 als Gruppen, P3 einzeln als tote Adressen. Übersicht: docs/pdfjs-adressen.md.
 * Dazu am 27.09.2026 die zwei Adressen aus dem Urheberrechtstext von core-js im Legacy-Build
 * (P4, tote Adressen, docs/pdfjs-kompatibilitaet.md Abschnitt 3.3).
 * Gilt nur für Dateien im Build, die pdf.js (Paket pdfjs-dist) enthalten, nicht global
 * (plan-phase2.md E14). Fundstelle: Zeile in node_modules/pdfjs-dist/build/;
 * tests/scripts/check-dist.test.ts prüft, dass die Adresse dort wirklich steht.
 * Neue Einträge nur nach Rückfrage.
 */

const pkg = 'pdfjs-dist';
const library = 'pdf.js 6.3.289';
// Legacy-Build seit 27.09.2026 (docs/pdfjs-kompatibilitaet.md); Fundstellen dort
const MAIN = 'node_modules/pdfjs-dist/legacy/build/pdf.mjs';
const WORKER = 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs';

const XFA =
  'XML-Namensraum; der XFA-Leser von pdf.js vergleicht ihn mit den Namensräumen eingebetteter Formulardaten, ruft ihn nie ab. XFA ist bei uns abgeschaltet (enableXfa: false).';
const NO_FILES =
  'tests/scripts/check-dist.test.ts: „pdf.js erzeugt bei uns keine Dateien (tote Adressen P2.16, P3)“';

const CORE_JS =
  'Urheberrechtstext von core-js (Feld license bzw. source), den core-js als Daten mitführt; im Hauptthread- und im Worker-Teil von pdf.js. Wird nie abgerufen.';

/** @type {Array<[string, number]>} Gruppe P2, verglichene Namensräume */
const P2 = [
  ['http://www.xfa.org/schema/xci/', 48521],
  ['http://www.xfa.org/schema/xfa-connection-set/', 48525],
  ['http://www.xfa.org/schema/xfa-data/', 48529],
  ['http://www.xfa.org/schema/xfa-form/', 48533],
  ['http://www.xfa.org/schema/xfa-locale-set/', 48537],
  ['http://ns.adobe.com/xdp/pdf/', 48541],
  ['http://www.w3.org/2000/09/xmldsig#', 48545],
  ['http://www.xfa.org/schema/xfa-source-set/', 48549],
  ['http://www.w3.org/1999/XSL/Transform', 48553],
  ['http://www.xfa.org/schema/xfa-template/', 48557],
  ['http://www.xfa.org/schema/xdc/', 48561],
  ['http://ns.adobe.com/xdp/', 48565],
  ['http://ns.adobe.com/xfdf/', 48569],
  ['http://www.w3.org/1999/xhtml', 48573],
  ['http://ns.adobe.com/xmpmeta/', 48577],
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
    source: `${MAIN}, Zeile 6284`,
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
    source: `${WORKER}, Zeile 56305`,
    test: NO_FILES,
  },
  {
    url: 'http://example.com',
    library,
    package: pkg,
    category: 'dead-address',
    reason:
      'Platzhalter-Basis für new URL in updateUrlHash (Sprungmarke an eine Adresse hängen). Reine Textverarbeitung, wird nie abgerufen.',
    source: `${MAIN}, Zeile 6644`,
    test: NO_FILES,
  },
  {
    url: 'https://foo.bar',
    library,
    package: pkg,
    category: 'dead-address',
    reason:
      'Platzhalter-Basis für new URL in getPdfFilenameFromUrl (Dateinamen aus einer Adresse ableiten). Reine Textverarbeitung, wird nie abgerufen.',
    source: `${MAIN}, Zeile 7606`,
    test: NO_FILES,
  },
  // P4: core-js 3.50.0 im Legacy-Build, Teil des Urheberrechtstexts (Objekt mit version,
  // copyright, license, source), den core-js im globalen Speicher ablegt. Wird nie abgerufen.
  {
    url: 'https://github.com/zloirock/core-js/blob/v3.50.0/LICENSE',
    library,
    package: pkg,
    category: 'dead-address',
    reason: CORE_JS,
    source: `${MAIN}, Zeile 3391`,
  },
  {
    url: 'https://github.com/zloirock/core-js',
    library,
    package: pkg,
    category: 'dead-address',
    reason: CORE_JS,
    source: `${MAIN}, Zeile 3392`,
  },
];
