/**
 * Erzeugt docs/texte-zur-freigabe.md aus dem Seitenregister (build/pages.ts) und den
 * Erklärtexten der Werkzeuge (src/tools/*\/main.html). Aufruf: node scripts/texte-zur-freigabe.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PAGES } from '../build/pages.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const TOOLS = [
  ['PDFs zusammenfügen', 'src/tools/pdf-zusammenfuegen/main.html'],
  ['Fotos verkleinern', 'src/tools/fotos-verkleinern/main.html'],
  ['SEPA-Sammelüberweisung', 'src/tools/sepa-sammelueberweisung/main.html'],
];
const clean = (/** @type {string} */ html) =>
  html
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const out = [
  '# Texte zur Freigabe',
  '',
  'Status: **freigegeben von Leon am 25.09.2026** (mit seinen Änderungen an Titeln, Meta-Beschreibungen und den Abschnitten „Gut zu wissen“). Neue oder geänderte Texte vor der Veröffentlichung erneut vorlegen.',
  '',
  'Erzeugt mit `node scripts/texte-zur-freigabe.mjs` aus `build/pages.ts` und den Werkzeug-Markups.',
  '',
  '## Titel und Meta-Beschreibungen (`build/pages.ts`)',
  '',
  '| URL | Titel | Meta-Beschreibung | Zeichen | Index |',
  '|---|---|---|---|---|',
  ...PAGES.map(
    (p) =>
      `| \`${p.url}\` | ${p.title.replace(/\|/g, '\\|')} | ${p.description} | ${p.description.length} | ${p.index ? 'ja' : 'noindex'} |`,
  ),
];

for (const [name, file] of TOOLS) {
  const html = readFileSync(`${root}/${file}`, 'utf8');
  const top = /<h1>[\s\S]*?<\/h1>\s*<p>([\s\S]*?)<\/p>/.exec(html);
  const section = html.slice(html.indexOf('<section class="explain"'));
  out.push('', `## ${name} (\`${file}\`)`, '');
  if (top?.[1]) out.push(`Unterzeile im Kopf: „${clean(top[1])}“`, '');
  let words = 0;
  for (const m of section.matchAll(/<(h2|p)[^>]*>([\s\S]*?)<\/\1>/g)) {
    const text = clean(m[2] ?? '');
    if (m[1] === 'p') words += text.split(' ').length;
    out.push(m[1] === 'h2' ? `**${text}**` : text, '');
  }
  out.push(`_(Erklärtext: ${words} Wörter)_`);
}

out.push(
  '',
  '## Weitere Texte',
  '',
  '| Stelle | Text | Datei |',
  '|---|---|---|',
  '| 404-Seite | „Diese Seite gibt es nicht.“ / „Die Adresse ist falsch geschrieben oder die Seite wurde verschoben.“ / Button „Zu allen Werkzeugen“ | `pages/404.html` |',
  '| Lizenzseite, Einleitung | siehe Datei | `pages/lizenzen/index.html` |',
  '| SEPA, Hinweis nur eine Überweisung | Wortlaut aus plan.md O9 | `src/tools/sepa-sammelueberweisung/messages.ts` |',
  '| SEPA, Warnung Datum | Wortlaut aus plan.md O7 | `src/tools/sepa-sammelueberweisung/messages.ts` |',
  '| Fehler- und Hinweismeldungen | alle Meldungen der Werkzeuge | `src/tools/*/page.ts`, `src/tools/sepa-sammelueberweisung/messages.ts` |',
  '',
);
writeFileSync(`${root}/docs/texte-zur-freigabe.md`, out.join('\n'));
console.log('docs/texte-zur-freigabe.md erzeugt');
