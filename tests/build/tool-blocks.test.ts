import { describe, expect, it } from 'vitest';
import { PAGES, TOOL_PAGES } from '../../build/pages.ts';
import {
  renderCategoryLinks,
  renderHomeTools,
  renderRelated,
  renderToolOverview,
  toolSearchText,
} from '../../build/tool-blocks.ts';

describe('Werkzeug-Blöcke aus dem Register', () => {
  it('zeigt auf der Startseite die Werkzeuge mit home-Angabe, mit Schlagwort', () => {
    const html = renderHomeTools();
    for (const p of TOOL_PAGES.filter((t) => t.tool.home)) {
      const cls = `tool-card ${p.tool.category}${p.tool.featured ? ' featured' : ''}`;
      expect(html).toContain(`<a class="${cls}" href="${p.url}">`);
      if (p.tool.home?.tag) expect(html).toContain(`<span class="tag">${p.tool.home.tag}</span>`);
    }
  });

  it('stellt hervorgehobene Werkzeuge als breite Karte an den Anfang (W4)', () => {
    const home = renderHomeTools();
    expect(/<a class="[^"]*" href="([^"]+)"/.exec(home)?.[1]).toBe('/pdf-werkstatt/');
    expect(home).toContain('<a class="tool-card pdf featured" href="/pdf-werkstatt/">');
    const overview = renderToolOverview();
    const pdf = overview.slice(overview.indexOf('id="pdf"'), overview.indexOf('</section>'));
    expect(pdf.indexOf('<li class="featured"')).toBe(pdf.indexOf('<li'));
    expect(pdf).toContain('href="/pdf-werkstatt/"');
  });

  it('listet auf /werkzeuge/ jedes Werkzeug genau einmal, mit Suchtext', () => {
    const html = renderToolOverview();
    for (const p of TOOL_PAGES) {
      expect(html.split(`href="${p.url}"`)).toHaveLength(2);
      expect(html).toContain(`data-search="${toolSearchText(p)}"`);
    }
  });

  it('zeigt nur Kategorien mit Werkzeugen, als Abschnitt und als Sprungmarke', () => {
    const used = new Set(TOOL_PAGES.map((p) => p.tool.category));
    const overview = renderToolOverview();
    const links = renderCategoryLinks();
    for (const id of ['pdf', 'img', 'tab', 'sepa', 'util'] as const) {
      expect(links.includes(`class="${id}"`), id).toBe(used.has(id));
    }
    expect(overview.match(/<section class="tool-category"/g)).toHaveLength(used.size);
  });

  it('der Suchtext enthält Name, Suchwörter und Kategorie in vereinheitlichter Form', () => {
    const merge = TOOL_PAGES.find((p) => p.tool.id === 'pdf-zusammenfuegen');
    expect(merge).toBeDefined();
    const text = merge ? toolSearchText(merge) : '';
    for (const word of ['pdfs', 'zusammenfuegen', 'zusammenfugen', 'merge', 'pdf']) {
      expect(text.split(' ')).toContain(word);
    }
  });

  it('„Passt dazu“ ist leer ohne Verweise und zeigt sonst die Karten in Reihenfolge', () => {
    const [first, second, third] = TOOL_PAGES;
    if (!first || !second || !third) throw new Error('zu wenige Werkzeuge');
    expect(renderRelated({ ...first, tool: { ...first.tool, related: [] } })).toBe('');
    const html = renderRelated({
      ...first,
      tool: { ...first.tool, related: [third.tool.id, second.tool.id] },
    });
    expect(html).toContain('<h2 id="related-title">Passt dazu</h2>');
    expect(html.indexOf(third.url)).toBeLessThan(html.indexOf(second.url));
    expect(() =>
      renderRelated({ ...first, tool: { ...first.tool, related: ['gibt-es-nicht'] } }),
    ).toThrow(/gibt-es-nicht/);
  });

  it('gibt für Seiten ohne Werkzeug nichts aus', () => {
    const pro = PAGES.find((p) => p.url === '/pro/');
    expect(pro && renderRelated(pro)).toBe('');
  });
});
