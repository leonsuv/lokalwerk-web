/**
 * Prüft den fertigen Build (`dist/`) auf Adressen fremder Domains (AGENTS.md Regel 1 und 2,
 * plan.md Abschnitt 5 und N3). Bricht mit Exit-Code 1 ab, wenn etwas gefunden wird.
 *
 * - HTML und CSS: nur Adressen der eigenen Domain, keine Ausnahmen.
 *   HTML zusätzlich ohne Inline-Skripte, <style>-Blöcke, style- und on…-Attribute,
 *   weil die Content-Security-Policy sie blockieren würde.
 * - JavaScript: eigene Domain und exakte Einträge aus ALLOWED_JS_URLS.
 * - SVG und XML: eigene Domain und exakte Einträge aus ALLOWED_SVG_XML_URLS.
 *   SVG zusätzlich ohne <script>, on…-Attribute und externe href/xlink:href.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

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

/**
 * @param {string} text
 * @param {Kind} kind
 * @returns {string[]} Beanstandungen, leer wenn alles in Ordnung ist
 */
export function checkText(text, kind) {
  /** @type {string[]} */
  const problems = [];
  const allowed = ALLOWED_BY_KIND[kind] ?? [];

  for (const match of text.matchAll(URL_PATTERN)) {
    const url = match[0];
    if (isOwnDomain(url)) continue;
    if (allowed.some((entry) => entry.url === url)) continue;
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

/** @param {string} distDir @returns {string[]} */
export function checkDist(distDir) {
  return listFiles(distDir).flatMap((file) => {
    const kind = KINDS[extname(file)];
    if (!kind) return [];
    return checkText(readFileSync(file, 'utf8'), kind).map(
      (p) => `${relative(distDir, file)}: ${p}`,
    );
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const distDir = fileURLToPath(new URL('../dist', import.meta.url));
  const problems = checkDist(distDir);
  if (problems.length > 0) {
    console.error(`check-dist: ${problems.length} Problem(e) im Build gefunden:`);
    for (const p of problems) console.error(`  ${p}`);
    process.exit(1);
  }
  console.log('check-dist: keine fremden Adressen, keine Inline-Skripte, -Stile oder -Handler.');
}
