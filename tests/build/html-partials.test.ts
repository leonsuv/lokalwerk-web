import { describe, expect, it } from 'vitest';
import { renderPage, renderSitemap } from '../../build/html-partials.ts';
import type { PageDef } from '../../build/pages.ts';

const page = (over: Partial<PageDef> = {}): PageDef => ({
  file: 'test/index.html',
  url: '/test/',
  title: 'Test & Titel – Lokalwerk',
  description: 'Beschreibung mit "Anführungszeichen" und <Klammern>.',
  index: true,
  nav: 'werkzeuge',
  ...over,
});

const includes: Record<string, string> = {
  'partials/header.html': '<a data-nav="werkzeuge">W</a><a data-nav="pro">P</a>',
  'partials/outer.html': '<div><!-- @include partials/inner.html --></div>',
  'partials/inner.html': '<span>innen</span>',
  'partials/loop.html': '<!-- @include partials/loop.html -->',
};
const options = {
  siteUrl: 'https://lokalwerk.eu',
  readInclude: (path: string): string => {
    const text = includes[path];
    if (text === undefined) throw new Error(`nicht gefunden: ${path}`);
    return text;
  },
};

describe('renderPage', () => {
  it('setzt Titel, Beschreibung und Canonical maskiert ein', () => {
    const out = renderPage('<head><!-- @head --></head>', page(), options);
    expect(out).toContain('<title>Test &amp; Titel – Lokalwerk</title>');
    expect(out).toContain(
      '<meta name="description" content="Beschreibung mit &quot;Anführungszeichen&quot; und &lt;Klammern&gt;.">',
    );
    expect(out).toContain('<link rel="canonical" href="https://lokalwerk.eu/test/">');
    expect(out).not.toContain('noindex');
  });

  it('setzt noindex statt Canonical für nicht indexierte Seiten', () => {
    const out = renderPage('<!-- @head -->', page({ index: false }), options);
    expect(out).toContain('<meta name="robots" content="noindex">');
    expect(out).not.toContain('canonical');
  });

  it('setzt Bausteine ein, auch verschachtelt', () => {
    const out = renderPage('<!-- @head --><!-- @include partials/outer.html -->', page(), options);
    expect(out).toContain('<div><span>innen</span></div>');
  });

  it('markiert den aktuellen Navigationspunkt', () => {
    const out = renderPage(
      '<!-- @head --><!-- @include partials/header.html -->',
      page({ nav: 'pro' }),
      options,
    );
    expect(out).toContain('<a data-nav="pro" aria-current="page">P</a>');
    expect(out).toContain('<a data-nav="werkzeuge">W</a>');
  });

  it('markiert keinen Navigationspunkt ohne nav', () => {
    const out = renderPage(
      '<!-- @head --><!-- @include partials/header.html -->',
      page({ nav: null }),
      options,
    );
    expect(out).not.toContain('aria-current');
  });

  it('bricht ohne @head-Platzhalter ab', () => {
    expect(() => renderPage('<head></head>', page(), options)).toThrow('@head');
  });

  it('bricht bei unbekanntem Platzhalter ab', () => {
    expect(() => renderPage('<!-- @head --><!-- @inklude x.html -->', page(), options)).toThrow(
      'Unbekannter Platzhalter',
    );
  });

  it('bricht bei fehlender Datei ab', () => {
    expect(() =>
      renderPage('<!-- @head --><!-- @include partials/fehlt.html -->', page(), options),
    ).toThrow('nicht gefunden');
  });

  it('bricht bei endloser Verschachtelung ab', () => {
    expect(() =>
      renderPage('<!-- @head --><!-- @include partials/loop.html -->', page(), options),
    ).toThrow('zu tief');
  });
});

describe('renderSitemap', () => {
  it('enthält nur indexierte Seiten', () => {
    const xml = renderSitemap(
      [page(), page({ url: '/geheim/', index: false })],
      'https://lokalwerk.eu',
    );
    expect(xml).toContain('<loc>https://lokalwerk.eu/test/</loc>');
    expect(xml).not.toContain('/geheim/');
  });
});
