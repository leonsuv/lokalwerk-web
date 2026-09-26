/**
 * Adressen in exifr 7.1.3, Fassung lite (plan-phase2.md E7). Gilt nur für Dateien im Build, die
 * exifr enthalten (E14). Übersicht: docs/exifr-adressen.md. Fundstelle: node_modules/exifr/
 * dist/lite.esm.mjs (eine Zeile); tests/scripts/check-dist.test.ts prüft, dass die Adresse dort steht.
 *
 * VORGELEGT am 26.09.2026, Freigabe durch Leon ausstehend (plan.md N3).
 */

const library = 'exifr 7.1.3 (lite)';
const pkg = 'exifr';
const source = 'node_modules/exifr/dist/lite.esm.mjs, Zeile 1';
const XMP =
  'XMP-Namensraum; exifr erkennt daran XMP-Blöcke in JPEG-Dateien (Bytevergleich), ruft ihn nie ab.';

/** @type {ReadonlyArray<{ url: string, library: string, package: string, category: string, reason: string, source: string, test?: string }>} */
export const EXIFR_URLS = [
  {
    url: 'http://ns.adobe.com/',
    library,
    package: pkg,
    category: 'xml-namespace',
    reason: XMP,
    source,
  },
  {
    url: 'http://ns.adobe.com/xap/1.0/',
    library,
    package: pkg,
    category: 'xml-namespace',
    reason: XMP,
    source,
  },
  {
    url: 'http://ns.adobe.com/xmp/extension/',
    library,
    package: pkg,
    category: 'xml-namespace',
    reason: XMP,
    source,
  },
  {
    url: 'https://github.com/MikeKovarik/exifr',
    library,
    package: pkg,
    category: 'dead-address',
    reason:
      'Text einer console.warn-Meldung für HEIC-Dateien mit mehreren Teilen; wir nehmen nur JPEG, PNG und WebP an. Wird nie abgerufen.',
    source,
    test: 'tests/scripts/check-dist.test.ts: „exifr (plan-phase2.md E7)“',
  },
];
