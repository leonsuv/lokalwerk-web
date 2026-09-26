/**
 * Adressen in uqr 0.1.3 (QR-Code-Bibliothek, plan-phase2.md E5). Gilt nur für Dateien im Build,
 * die uqr enthalten (E14). Fundstelle: Zeile in node_modules/uqr/dist/index.mjs;
 * tests/scripts/check-dist.test.ts prüft, dass die Adresse dort steht.
 *
 * Freigegeben von Leon am 26.09.2026 (plan.md N3); angekündigt in plan-phase2.md Abschnitt 5.2.
 * Übersicht: docs/uqr-adressen.md. Neue Einträge nur nach Rückfrage.
 */

/** @type {ReadonlyArray<{ url: string, library: string, package: string, category: string, reason: string, source: string }>} */
export const UQR_URLS = [
  {
    url: 'http://www.w3.org/2000/svg',
    library: 'uqr 0.1.3',
    package: 'uqr',
    category: 'xml-namespace',
    reason:
      'Pflicht-Namensraum im Kopf der erzeugten SVG-Datei (renderSVG, SVG-Export der QR-Codes). Ein Name, keine Datei; wird nie abgerufen.',
    source: 'node_modules/uqr/dist/index.mjs, Zeile 723',
  },
];
