/**
 * HTML-Blöcke aus dem Werkzeugregister (build/pages.ts), plan-phase2.md Abschnitt 3:
 *   home-tools     Karten auf der Startseite
 *   tool-overview  alle Werkzeuge nach Kategorie auf /werkzeuge/, mit Suchtext je Karte
 *   related        „Passt dazu“ unter einer Werkzeugseite
 *
 * Läuft beim Build (build/html-partials.ts) und auf der Startseite, wenn sie ohne Neuladen
 * in ein Werkzeug wechselt (src/tools/home/page.ts). Nur Daten aus dem Register, keine
 * Nutzerdaten; trotzdem wird alles maskiert.
 */

import { searchText } from '../src/core/search/match.ts';
import { escapeHtml as e } from './html-escape.ts';
import { CATEGORIES, TOOL_PAGES, toolById, type PageDef, type ToolPage } from './pages.ts';

function icon(id: string, size: number): string {
  return `<svg width="${size}" height="${size}" aria-hidden="true"><use href="#${e(id)}" /></svg>`;
}

function card(page: ToolPage, tag?: string): string {
  const { tool } = page;
  return [
    `<a class="tool-card ${tool.category}" href="${e(page.url)}">`,
    `<span class="ic">${icon(tool.icon, 24)}</span>`,
    `<h3>${e(tool.name)}</h3>`,
    `<p>${e(tool.short)}</p>`,
    `<div class="foot">${tag ? `<span class="tag">${e(tag)}</span>` : '<span></span>'}<span class="open">Öffnen</span></div>`,
    '</a>',
  ].join('');
}

/** Suchtext einer Karte: Name, Satz, Suchwörter und Kategorie. */
export function toolSearchText(page: ToolPage): string {
  const category = CATEGORIES.find((c) => c.id === page.tool.category)?.name ?? '';
  return searchText([page.tool.name, page.tool.short, ...page.tool.keywords, category]);
}

export function renderHomeTools(): string {
  const cards = TOOL_PAGES.filter((p) => p.tool.home).map((p) => card(p, p.tool.home?.tag));
  return `<div class="tool-grid">${cards.join('')}</div>`;
}

export function renderToolOverview(): string {
  return CATEGORIES.map((category) => {
    const tools = TOOL_PAGES.filter((p) => p.tool.category === category.id);
    if (tools.length === 0) return '';
    const count = `${tools.length} ${tools.length === 1 ? 'Werkzeug' : 'Werkzeuge'}`;
    const items = tools.map((p) => `<li data-search="${e(toolSearchText(p))}">${card(p)}</li>`);
    return [
      `<section class="tool-category" id="${e(category.anchor)}" aria-labelledby="kat-${e(category.anchor)}">`,
      `<div class="section-head"><h2 id="kat-${e(category.anchor)}">${e(category.name)}</h2><p>${count}</p></div>`,
      `<ul class="tool-grid" role="list">${items.join('')}</ul>`,
      '</section>',
    ].join('');
  }).join('\n');
}

/** Sprungmarken zu den Kategorien, die Werkzeuge haben (E13). */
export function renderCategoryLinks(): string {
  const links = CATEGORIES.filter((c) => TOOL_PAGES.some((p) => p.tool.category === c.id)).map(
    (c) => `<li><a class="${c.id}" href="#${e(c.anchor)}">${e(c.name)}</a></li>`,
  );
  return `<ul class="jump-links" role="list">${links.join('')}</ul>`;
}

/** „Passt dazu“ für eine Werkzeugseite. Leer, wenn das Werkzeug keine Verweise hat. */
export function renderRelated(page: PageDef): string {
  const related = (page.tool?.related ?? []).map((id) => {
    const target = toolById(id);
    if (!target) throw new Error(`${page.url}: verwandtes Werkzeug „${id}“ gibt es nicht.`);
    return target;
  });
  if (related.length === 0) return '';
  return [
    '<div class="wrap">',
    '<section class="related" aria-labelledby="related-title">',
    '<h2 id="related-title">Passt dazu</h2>',
    `<div class="tool-grid">${related.map((p) => card(p)).join('')}</div>`,
    '</section>',
    '</div>',
  ].join('');
}
