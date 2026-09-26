/**
 * Prüft den fertigen Build (`dist/`) auf Adressen fremder Domains (AGENTS.md Regel 1 und 2,
 * plan.md Abschnitt 5 und N3). Bricht mit Exit-Code 1 ab, wenn etwas gefunden wird.
 *
 * - HTML und CSS: nur Adressen der eigenen Domain, keine Ausnahmen.
 *   HTML zusätzlich ohne Inline-Skripte, <style>-Blöcke, style- und on…-Attribute,
 *   weil die Content-Security-Policy sie blockieren würde.
 * - JavaScript: eigene Domain und exakte Einträge aus ALLOWED_JS_URLS.
 * - JavaScript zusätzlich: „tote Adressen in Bibliotheken“ aus ALLOWED_LIBRARY_URLS, jeweils nur
 *   in den Dateien, die die Bibliothek laut Build enthalten (plan-phase2.md E14). Die Zuordnung
 *   Datei → Pakete schreibt build/shipped-packages.ts beim Build (scripts/shipped-manifest.mjs).
 * - Einzige Ausnahme in HTML (plan.md N3, Variante A): Auf lizenzen/index.html sind Adressen
 *   erlaubt, die im Textinhalt stehen (nie in einem Attribut) und beim Build wörtlich in den
 *   gesammelten Lizenzdaten vorkommen (build/licenses.ts). Jede andere Adresse bricht ab.
 * - SVG und XML: eigene Domain und exakte Einträge aus ALLOWED_SVG_XML_URLS.
 *   SVG zusätzlich ohne <script>, on…-Attribute und externe href/xlink:href.
 * - Nie ausgeliefert werden die PDF-JavaScript-Sandbox von pdf.js (pdf.sandbox.mjs) und ihre
 *   QuickJS-Engine (quickjs-eval.js/.wasm), weder als Datei noch in einem Bundle
 *   (plan-phase2.md Abschnitt 5.2).
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { collectLicenses } from '../build/licenses.ts';
import { EXIFR_URLS } from './allowed-urls-exifr.mjs';
import { PDFJS_URLS } from './allowed-urls-pdfjs.mjs';
import { SHEETJS_URLS } from './allowed-urls-sheetjs.mjs';
import { UQR_URLS } from './allowed-urls-uqr.mjs';
import { SHIPPED_MANIFEST } from './shipped-manifest.mjs';

export const SITE_ORIGIN = 'https://lokalwerk.eu';

/**
 * @typedef {{ url: string, reason: string, source: string }} AllowedUrl
 * @typedef {'html' | 'css' | 'js' | 'svg' | 'xml'} Kind
 */

/*
 * Positivlisten: nur reine Namensraum- und Schema-Adressen, die nie geladen werden, jede als
 * exakte Adresse mit Begründung und Fundstelle. Neue Einträge nur nach Rückfrage beim
 * Betreiber (plan.md N3).
 */

/** @type {ReadonlyArray<AllowedUrl>} */
export const ALLOWED_JS_URLS = [];

/** @type {ReadonlyArray<AllowedUrl>} */
export const ALLOWED_SVG_XML_URLS = [
  {
    url: 'http://www.w3.org/2000/svg',
    reason:
      'Pflicht-Namensraum jeder eigenständigen SVG-Datei (public/favicon.svg). Wird nicht abgerufen.',
    source: 'W3C, Scalable Vector Graphics (SVG) 2, Abschnitt 1.3 „SVG namespace and DTD“',
  },
  {
    url: 'http://www.sitemaps.org/schemas/sitemap/0.9',
    reason: 'Pflicht-Namensraum von sitemap.xml (build/html-partials.ts). Wird nicht abgerufen.',
    source: 'sitemaps.org, Sitemaps XML format, Protokoll 0.9',
  },
];

/**
 * „Tote Adressen in Bibliotheken“ (plan.md N3): Adressen im Code einer Bibliothek, die bei uns
 * nie ausgeführt werden. Gilt nur für Dateien, die das npm-Paket `package` laut Build enthalten
 * (plan-phase2.md E14), nie global. Jede Ausnahme braucht Fundstelle und einen Test, der belegt, dass
 * die Adresse nicht in erzeugten Dateien landet. Neue Einträge nur nach Rückfrage.
 *
 * Seit 24.09.2026 außerdem freigegeben: XML-Namensräume und Beziehungstypen nach ECMA-376
 * aus SheetJS, jeweils nur im SEPA-Worker (scripts/allowed-urls-sheetjs.mjs).
 * Seit 25.09.2026: Namensräume und zwei tote Adressen aus pdf.js (scripts/allowed-urls-pdfjs.mjs).
 * Seit 26.09.2026: SVG-Namensraum in uqr (scripts/allowed-urls-uqr.mjs).
 * 26.09.2026 vorgelegt, Freigabe ausstehend: XMP-Namensräume und eine Adresse aus exifr
 * (scripts/allowed-urls-exifr.mjs).
 *
 * @type {ReadonlyArray<AllowedUrl & { library: string, package: string, category?: string, test?: string }>}
 */
export const ALLOWED_LIBRARY_URLS = [
  ...SHEETJS_URLS,
  ...PDFJS_URLS,
  ...UQR_URLS,
  ...EXIFR_URLS,
  {
    url: 'https://github.com/Hopding/pdf-lib',
    library: 'pdf-lib 1.17.1',
    package: 'pdf-lib',
    reason:
      'Standardtext für die PDF-Metadaten Producer/Creator. Wird nur geschrieben, wenn ' +
      'updateMetadata aktiv ist; wir setzen überall updateMetadata: false (docs/pdf-lib.md, Nr. 8 und 9).',
    source:
      'node_modules/pdf-lib/es/api/PDFDocument.js, Zeile 1334, PDFDocument.prototype.updateInfoDict',
    test: 'tests/core/pdf/merge.test.ts: „übernimmt keine Metadaten der Originale und schreibt keine eigenen“',
  },
];

/** @type {Partial<Record<Kind, ReadonlyArray<AllowedUrl>>>} */
const ALLOWED_BY_KIND = {
  js: ALLOWED_JS_URLS,
  svg: ALLOWED_SVG_XML_URLS,
  xml: ALLOWED_SVG_XML_URLS,
};

const URL_PATTERN = /(?:(?:https?|wss?|ftp):)?\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)+[^\s"'`()<>\\]*/gi;
const EVENT_ATTRIBUTE = /\son[a-z]+\s*=/i;

/** @param {string} url */
function isOwnDomain(url) {
  const normalized = url.startsWith('//') ? `https:${url}` : url;
  return normalized === SITE_ORIGIN || normalized.startsWith(`${SITE_ORIGIN}/`);
}

/** Die Lizenzseite im Build (einzige Seite mit der Ausnahme nach Variante A). */
export const LICENSE_PAGE = 'lizenzen/index.html';

/**
 * Alle Adressen, die wörtlich in den gesammelten Lizenzdaten stehen.
 * @param {ReadonlyArray<import('../build/licenses.ts').LicenseEntry>} entries
 * @returns {Set<string>}
 */
export function licenseUrls(entries) {
  const texts = entries.flatMap((e) => [
    ...e.notices,
    ...e.texts.map((t) => t.text),
    ...(e.extra?.lines ?? []),
    ...e.dataLicenses.flatMap((d) => [d.text, d.note, d.source]),
  ]);
  return new Set(texts.flatMap((t) => [...t.matchAll(URL_PATTERN)].map((m) => m[0])));
}

/** Steht die Fundstelle innerhalb eines Tags (also in einem Attribut)? */
function insideTag(/** @type {string} */ text, /** @type {number} */ index) {
  return text.lastIndexOf('<', index) > text.lastIndexOf('>', index);
}

/**
 * @typedef {{
 *   licenseUrls?: ReadonlySet<string>,
 *   packagesByFile?: Readonly<Record<string, readonly string[]>>,
 * }} CheckContext
 */

/**
 * @param {string} text
 * @param {Kind} kind
 * @param {string} [file] Pfad relativ zu dist/, nötig für die Bibliotheks-Ausnahmen
 * @param {CheckContext} [context]
 * @returns {string[]} Beanstandungen, leer wenn alles in Ordnung ist
 */
export function checkText(text, kind, file = '', context = {}) {
  /** @type {string[]} */
  const problems = [];
  const packages = context.packagesByFile?.[file] ?? [];
  const allowed = [
    ...(ALLOWED_BY_KIND[kind] ?? []),
    ...(kind === 'js'
      ? ALLOWED_LIBRARY_URLS.filter((entry) => packages.includes(entry.package))
      : []),
  ];

  const onLicensePage = kind === 'html' && file === LICENSE_PAGE && context.licenseUrls;
  for (const match of text.matchAll(URL_PATTERN)) {
    // In HTML endet eine Adresse vor &lt; oder &gt; (< und > kommen in Adressen nicht vor).
    const url = kind === 'html' ? match[0].replace(/&(?:lt|gt);.*$/, '') : match[0];
    if (isOwnDomain(url)) continue;
    if (allowed.some((entry) => entry.url === url)) continue;
    if (onLicensePage && context.licenseUrls?.has(url) && !insideTag(text, match.index)) continue;
    problems.push(`fremde Adresse: ${url}`);
  }

  if (kind === 'html') {
    for (const tag of text.match(/<script\b[^>]*>/gi) ?? []) {
      if (!/\ssrc=/i.test(tag)) problems.push(`Inline-Skript: ${tag}`);
    }
    if (/<style\b/i.test(text)) problems.push('<style>-Block (von der CSP blockiert)');
    if (/\sstyle\s*=/i.test(text)) problems.push('style-Attribut (von der CSP blockiert)');
    if (EVENT_ATTRIBUTE.test(text)) problems.push('on…-Attribut (von der CSP blockiert)');
  }

  if (kind === 'svg') {
    if (/<script\b/i.test(text)) problems.push('<script> in SVG');
    if (EVENT_ATTRIBUTE.test(text)) problems.push('on…-Attribut in SVG');
    for (const m of text.matchAll(/\s(?:xlink:)?href\s*=\s*["']([^"']*)["']/gi)) {
      if (!m[1]?.startsWith('#')) problems.push(`externer Verweis in SVG: ${m[0].trim()}`);
    }
  }

  return problems;
}

/** Dateinamen und Code-Merkmale der pdf.js-Sandbox (node_modules/pdfjs-dist 6.3.289) */
const FORBIDDEN_FILE = /(?:^|\/)(?:quickjs[^/]*|pdf\.sandbox[^/]*)$/i;
const FORBIDDEN_CODE = ['QuickJSSandbox', 'SandboxSupportBase', 'quickjs-eval'];

/**
 * @param {string} path Pfad relativ zu dist/
 * @param {string | null} text Inhalt bei Textdateien, sonst null
 * @returns {string[]}
 */
export function checkForbidden(path, text) {
  /** @type {string[]} */
  const problems = [];
  if (FORBIDDEN_FILE.test(path)) problems.push('pdf.js-Sandbox oder QuickJS wird ausgeliefert');
  for (const marker of FORBIDDEN_CODE) {
    if (text?.includes(marker)) problems.push(`enthält Code der pdf.js-Sandbox (${marker})`);
  }
  return problems;
}

/** @param {string} dir @returns {string[]} */
function listFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? listFiles(full) : [full];
  });
}

/** @type {Record<string, Kind>} */
const KINDS = {
  '.html': 'html',
  '.css': 'css',
  '.js': 'js',
  '.mjs': 'js',
  '.svg': 'svg',
  '.xml': 'xml',
};

/**
 * @param {string} distDir
 * @param {CheckContext} [context]
 * @returns {string[]}
 */
export function checkDist(distDir, context = {}) {
  return listFiles(distDir).flatMap((file) => {
    const kind = KINDS[extname(file)];
    const path = relative(distDir, file).split(sep).join('/');
    const text = kind ? readFileSync(file, 'utf8') : null;
    return [
      ...checkForbidden(path, text),
      ...(kind && text !== null ? checkText(text, kind, path, context) : []),
    ].map((p) => `${path}: ${p}`);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const distDir = fileURLToPath(new URL('../dist', import.meta.url));
  const root = fileURLToPath(new URL('..', import.meta.url));
  if (!existsSync(SHIPPED_MANIFEST)) {
    console.error(`check-dist: ${SHIPPED_MANIFEST} fehlt. Erst „vite build“ ausführen.`);
    process.exit(1);
  }
  /** @type {unknown} */
  const manifest = JSON.parse(readFileSync(SHIPPED_MANIFEST, 'utf8'));
  const packagesByFile = /** @type {Record<string, string[]>} */ (manifest);
  const problems = checkDist(distDir, {
    licenseUrls: licenseUrls(collectLicenses(root)),
    packagesByFile,
  });
  if (problems.length > 0) {
    console.error(`check-dist: ${problems.length} Problem(e) im Build gefunden:`);
    for (const p of problems) console.error(`  ${p}`);
    process.exit(1);
  }
  console.log('check-dist: keine fremden Adressen, keine Inline-Skripte, -Stile oder -Handler.');
}
