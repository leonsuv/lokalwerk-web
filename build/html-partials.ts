/**
 * Kleines Vite-Plugin: setzt gemeinsame HTML-Bausteine und die Kopfdaten jeder Seite ein.
 *
 * Platzhalter in den Seiten unter `pages/`:
 *   <!-- @head -->                         Titel, Meta-Beschreibung, Canonical, noindex
 *   <!-- @include partials/header.html --> Datei relativ zu `src/`, darf selbst wieder
 *                                          Platzhalter enthalten
 *
 * Außerdem erzeugt das Plugin beim Build `sitemap.xml` aus dem Seitenregister.
 */

import { readFileSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import type { Plugin } from 'vite';
import type { PageDef } from './pages.ts';

const INCLUDE = /<!--\s*@include\s+([\w./-]+)\s*-->/g;
const HEAD = /<!--\s*@head\s*-->/;
const MAX_DEPTH = 5;

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderHead(page: PageDef, siteUrl: string): string {
  const lines = [
    `<title>${escapeHtml(page.title)}</title>`,
    `<meta name="description" content="${escapeHtml(page.description)}">`,
  ];
  if (page.index) lines.push(`<link rel="canonical" href="${escapeHtml(siteUrl + page.url)}">`);
  else lines.push('<meta name="robots" content="noindex">');
  return lines.join('\n    ');
}

export interface RenderOptions {
  siteUrl: string;
  /** Liest eine Datei relativ zu `src/`. */
  readInclude: (path: string) => string;
}

export function renderPage(html: string, page: PageDef, options: RenderOptions): string {
  if (!HEAD.test(html)) throw new Error(`${page.file}: Platzhalter <!-- @head --> fehlt.`);

  const expand = (text: string, depth: number): string =>
    text.replace(INCLUDE, (_match, path: string) => {
      if (depth >= MAX_DEPTH)
        throw new Error(`${page.file}: Includes zu tief verschachtelt (${path}).`);
      return expand(options.readInclude(path), depth + 1);
    });

  let out = expand(html, 0).replace(HEAD, renderHead(page, options.siteUrl));
  if (page.nav) {
    out = out.replaceAll(`data-nav="${page.nav}"`, `data-nav="${page.nav}" aria-current="page"`);
  }

  const leftover = /<!--\s*@\w+/.exec(out);
  if (leftover) throw new Error(`${page.file}: Unbekannter Platzhalter „${leftover[0]}“.`);
  return out;
}

export function renderSitemap(pages: readonly PageDef[], siteUrl: string): string {
  const urls = pages
    .filter((p) => p.index)
    .map((p) => `  <url><loc>${escapeHtml(siteUrl + p.url)}</loc></url>`);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n');
}

export interface HtmlPartialsOptions {
  pagesDir: string;
  srcDir: string;
  pages: readonly PageDef[];
  siteUrl: string;
}

export function htmlPartials(options: HtmlPartialsOptions): Plugin {
  const srcDir = resolve(options.srcDir);

  const readInclude = (path: string): string => {
    const file = resolve(srcDir, path);
    if (!file.startsWith(srcDir + sep)) throw new Error(`Include außerhalb von src/: ${path}`);
    return readFileSync(file, 'utf8');
  };

  return {
    name: 'lokalwerk-html-partials',

    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        const file = relative(options.pagesDir, ctx.filename).split(sep).join('/');
        const page = options.pages.find((p) => p.file === file);
        if (!page) throw new Error(`Seite fehlt im Register build/pages.ts: ${file}`);
        return renderPage(html, page, { siteUrl: options.siteUrl, readInclude });
      },
    },

    configureServer(server) {
      // Bausteine liegen außerhalb des Vite-Roots und werden sonst nicht beobachtet.
      server.watcher.add(srcDir);
      server.watcher.on('change', (file) => {
        if (file.startsWith(srcDir + sep) && /\.(html|svg)$/.test(file)) {
          server.ws.send({ type: 'full-reload' });
        }
      });
    },

    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: renderSitemap(options.pages, options.siteUrl),
      });
    },
  };
}
