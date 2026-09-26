/**
 * Pro ist bis zum Start ausgeblendet (Leon, 26.09.2026): Die Seite /pro/ bleibt als Datei, ist
 * noindex, steht nicht in der Sitemap und wird von keiner Seite verlinkt. Geprüft werden alle
 * Quellen, aus denen Seiten entstehen: Seiten, Teilvorlagen, Werkzeug-Markup und Code.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { renderSitemap } from '../../build/html-partials.ts';
import { PAGES, SITE_URL } from '../../build/pages.ts';

const root = fileURLToPath(new URL('../..', import.meta.url));
/** Ausgeblendeter Pro-Block der Startseite; wird nirgends eingebunden */
const PRO_BAND = join('src', 'partials', 'pro-band.html');

function files(dir: string, ext: RegExp): string[] {
  return readdirSync(join(root, dir), { recursive: true, encoding: 'utf8' })
    .filter((f) => ext.test(f))
    .map((f) => join(dir, f));
}

const sources = [
  ...files('pages', /\.html$/),
  ...files('src', /\.(html|svg|ts)$/),
  join('build', 'pages.ts'),
].filter((f) => f !== PRO_BAND);

/** Links auf /pro/, auch absolut und ohne Schrägstrich am Ende */
const PRO_LINK = /href\s*=\s*["'](?:https:\/\/lokalwerk\.eu)?\/pro\/?["'#?]/;

describe('Pro bis zum Start ausgeblendet', () => {
  it('keine Seite, Teilvorlage oder Code verlinkt auf /pro/', () => {
    const hits = sources.filter((f) => PRO_LINK.test(readFileSync(join(root, f), 'utf8')));
    expect(hits).toEqual([]);
  });

  it('der Pro-Block der Startseite wird nirgends eingebunden', () => {
    const hits = sources.filter((f) =>
      /@include\s+partials\/pro-band\.html/.test(readFileSync(join(root, f), 'utf8')),
    );
    expect(hits).toEqual([]);
  });

  it('/pro/ ist noindex und nicht in der Sitemap', () => {
    const pro = PAGES.find((p) => p.url === '/pro/');
    expect(pro?.index).toBe(false);
    expect(renderSitemap(PAGES, SITE_URL)).not.toContain('/pro/');
  });
});
