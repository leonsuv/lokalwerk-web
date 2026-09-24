import { describe, expect, it } from 'vitest';
import { ALLOWED_JS_URLS, ALLOWED_SVG_XML_URLS, checkText } from '../../scripts/check-dist.mjs';

describe('checkText', () => {
  it('erlaubt die eigene Domain', () => {
    expect(checkText('<link rel="canonical" href="https://lokalwerk.eu/pro/">', 'html')).toEqual(
      [],
    );
    expect(checkText('a{background:url(https://lokalwerk.eu/x.png)}', 'css')).toEqual([]);
  });

  it('findet fremde Domains in HTML, CSS und JS', () => {
    expect(
      checkText('<link href="https://fonts.googleapis.com/css2?family=Onest">', 'html'),
    ).toHaveLength(1);
    expect(checkText('@import url(//cdn.example.com/a.css);', 'css')).toHaveLength(1);
    expect(checkText('import("https://cdnjs.cloudflare.com/x.js")', 'js')).toHaveLength(1);
    expect(checkText('new WebSocket("wss://example.com/s")', 'js')).toHaveLength(1);
  });

  it('lässt sich nicht mit ähnlichen Domains täuschen', () => {
    expect(checkText('"https://lokalwerk.eu.example.com/"', 'js')).toHaveLength(1);
    expect(checkText('"https://lokalwerk.eu@example.com/"', 'js')).toHaveLength(1);
  });

  it('findet Inline-Skripte, style-Blöcke und style-Attribute in HTML', () => {
    expect(checkText('<script>alert(1)</script>', 'html')).toHaveLength(1);
    expect(checkText('<script type="module" src="/assets/a.js"></script>', 'html')).toEqual([]);
    expect(checkText('<style>a{}</style>', 'html')).toHaveLength(1);
    expect(checkText('<div style="color:red">', 'html')).toHaveLength(1);
  });

  it('ignoriert Kommentare mit Leerzeichen nach //', () => {
    expect(checkText('const a = 1; // siehe plan.md', 'js')).toEqual([]);
  });

  it('findet on…-Attribute in HTML', () => {
    expect(checkText('<button onclick="x()">', 'html')).toHaveLength(1);
  });
});

describe('Positivlisten (plan.md N3)', () => {
  it('JavaScript hat bisher keine Ausnahmen', () => {
    expect(ALLOWED_JS_URLS).toEqual([]);
  });

  it('SVG und XML erlauben genau die zwei freigegebenen Namensräume', () => {
    expect(ALLOWED_SVG_XML_URLS.map((e) => e.url)).toEqual([
      'http://www.w3.org/2000/svg',
      'http://www.sitemaps.org/schemas/sitemap/0.9',
    ]);
    for (const entry of ALLOWED_SVG_XML_URLS) {
      expect(entry.reason.length).toBeGreaterThan(0);
      expect(entry.source.length).toBeGreaterThan(0);
    }
  });

  it('gilt nur exakt, nicht für Varianten oder andere Dateitypen', () => {
    expect(checkText('<svg xmlns="http://www.w3.org/2000/svg">', 'svg')).toEqual([]);
    expect(checkText('<svg xmlns="http://www.w3.org/2000/svg/x">', 'svg')).toHaveLength(1);
    expect(checkText('<svg xmlns="http://www.w3.org/1999/xlink">', 'svg')).toHaveLength(1);
    expect(
      checkText('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">', 'xml'),
    ).toEqual([]);
    expect(checkText('<svg xmlns="http://www.w3.org/2000/svg">', 'html')).toHaveLength(1);
    expect(checkText('a{b:url(http://www.w3.org/2000/svg)}', 'css')).toHaveLength(1);
    expect(checkText('"http://www.w3.org/2000/svg"', 'js')).toHaveLength(1);
  });
});

describe('SVG-Dateien', () => {
  const svg = (inner: string) => `<svg xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;

  it('lässt ein einfaches SVG mit internen Verweisen zu', () => {
    expect(checkText(svg('<use href="#i-shield" /><path d="M0 0" />'), 'svg')).toEqual([]);
  });

  it('verbietet Skripte, Event-Attribute und externe Verweise', () => {
    expect(checkText(svg('<script>alert(1)</script>'), 'svg')).toHaveLength(1);
    expect(checkText(svg('<rect onload="x()" />'), 'svg')).toHaveLength(1);
    expect(checkText(svg('<image href="/bild.png" />'), 'svg')).toHaveLength(1);
    expect(checkText(svg('<use xlink:href="other.svg#a" />'), 'svg')).toHaveLength(1);
  });
});
