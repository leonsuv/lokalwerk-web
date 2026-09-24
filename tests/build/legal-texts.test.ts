/**
 * Rechtstexte werden nicht umgeschrieben, sondern wörtlich aus dem Prototyp übernommen
 * (AGENTS.md Abschnitt 9, plan.md A7). Einzige Abweichung: die feststehende Kontaktadresse
 * ist kein markierter Platzhalter mehr.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

const decode = (html: string) =>
  html
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/[ \t\r\n]+/g, ' ')
    .trim();

/** Überschriften, Absätze und Entwurf-Kasten in Reihenfolge, Markierungen als [[…]]. */
function blocks(source: string): string[] {
  // Zeilenumbrüche innerhalb von Tags (z. B. durch Formatierer) nicht als Abweichung werten.
  const html = source.replace(/<(\/?[a-z0-9]+)\s*>/g, '<$1>');
  const marked = html.replace(/<mark>(.*?)<\/mark>/gs, '[[$1]]');
  return [...marked.matchAll(/<(h1|h2|p|div class="draft")[^>]*>(.*?)<\/(?:h1|h2|p|div)>/gs)]
    .map((m) => decode(m[2] ?? ''))
    .filter((t) => t !== '');
}

function prototypeSection(id: string): string {
  const html = read('prototype/lokalwerk-prototyp.html');
  const start = html.indexOf(`id="page-${id}"`);
  return html.slice(start, html.indexOf('</section>', start));
}

describe.each(['impressum', 'datenschutz'])('Rechtstext %s', (id) => {
  it('stimmt wörtlich mit dem Prototyp überein', () => {
    const expected = blocks(prototypeSection(id)).map((t) =>
      t.replace('[[kontakt@lokalwerk.eu]]', 'kontakt@lokalwerk.eu'),
    );
    expect(blocks(read(`pages/${id}/index.html`))).toEqual(expected);
  });

  it('nennt die Kontaktadresse aus AGENTS.md', () => {
    expect(read(`pages/${id}/index.html`)).toContain('kontakt@lokalwerk.eu');
    expect(read(`pages/${id}/index.html`)).not.toContain('lokalwerk.de');
  });
});
