/**
 * Prüft den fertigen Build (`dist/`) auf Adressen fremder Domains (AGENTS.md Regel 1 und 2,
 * plan.md Abschnitt 5 und N3). Bricht mit Exit-Code 1 ab, wenn etwas gefunden wird.
 *
 * - HTML und CSS: nur Adressen der eigenen Domain, keine Ausnahmen.
 *   Zusätzlich keine Inline-Skripte, <style>-Blöcke oder style-Attribute, weil die
 *   Content-Security-Policy sie blockieren würde.
 * - JavaScript: nur Adressen der eigenen Domain und exakte Einträge aus ALLOWED_JS_URLS.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const SITE_ORIGIN = 'https://lokalwerk.eu';

/**
 * Positivliste für JavaScript. Nur reine Namensraum- und Schema-Adressen, die nie geladen
 * werden, jede als exakte Adresse mit Begründung und Fundstelle. Neue Einträge nur nach
 * Rückfrage beim Betreiber (plan.md N3).
 *
 * @type {ReadonlyArray<{ url: string, reason: string, source: string }>}
 */
export const ALLOWED_JS_URLS = [];

const URL_PATTERN = /(?:(?:https?|wss?|ftp):)?\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)+[^\s"'`()<>\\]*/gi;

/** @param {string} url */
function isOwnDomain(url) {
  const normalized = url.startsWith('//') ? `https:${url}` : url;
  return normalized === SITE_ORIGIN || normalized.startsWith(`${SITE_ORIGIN}/`);
}

/**
 * @param {string} text
 * @param {'html' | 'css' | 'js'} kind
 * @returns {string[]} Beanstandungen, leer wenn alles in Ordnung ist
 */
export function checkText(text, kind) {
  /** @type {string[]} */
  const problems = [];

  for (const match of text.matchAll(URL_PATTERN)) {
    const url = match[0];
    if (isOwnDomain(url)) continue;
    if (kind === 'js' && ALLOWED_JS_URLS.some((entry) => entry.url === url)) continue;
    problems.push(`fremde Adresse: ${url}`);
  }

  if (kind === 'html') {
    for (const tag of text.match(/<script\b[^>]*>/gi) ?? []) {
      if (!/\ssrc=/i.test(tag)) problems.push(`Inline-Skript: ${tag}`);
    }
    if (/<style\b/i.test(text)) problems.push('<style>-Block (von der CSP blockiert)');
    if (/\sstyle\s*=/i.test(text)) problems.push('style-Attribut (von der CSP blockiert)');
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

/** @type {Record<string, 'html' | 'css' | 'js'>} */
const KINDS = { '.html': 'html', '.css': 'css', '.js': 'js', '.mjs': 'js' };

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
  console.log('check-dist: keine fremden Adressen, keine Inline-Skripte oder -Stile.');
}
