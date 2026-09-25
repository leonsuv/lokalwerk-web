import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { collectLicenses } from '../../build/licenses.ts';
import {
  LICENSE_PAGE,
  licenseUrls,
  ALLOWED_JS_URLS,
  ALLOWED_LIBRARY_URLS,
  ALLOWED_SVG_XML_URLS,
  checkText,
} from '../../scripts/check-dist.mjs';

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

describe('Tote Adressen in Bibliotheken (plan.md N3)', () => {
  const pdfLib = '"pdf-lib (https://github.com/Hopding/pdf-lib)"';

  const pdfLibEntries = ALLOWED_LIBRARY_URLS.filter((e) => e.library.startsWith('pdf-lib'));
  const sheetJsEntries = ALLOWED_LIBRARY_URLS.filter((e) => e.library.startsWith('SheetJS'));

  it('enthält genau die freigegebene pdf-lib-Adresse mit Fundstelle und Test', () => {
    expect(pdfLibEntries.map((e) => e.url)).toEqual(['https://github.com/Hopding/pdf-lib']);
    for (const entry of pdfLibEntries) {
      expect(entry.source).toMatch(/node_modules\/pdf-lib\/.+Zeile \d+/);
      expect(entry.test).toMatch(/^tests\//);
    }
  });

  it('enthält für SheetJS 22 Namensräume, 29 Beziehungstypen und 3 einzeln freigegebene Adressen', () => {
    const count = (category: string) =>
      sheetJsEntries.filter((e) => e.category === category).length;
    expect(sheetJsEntries).toHaveLength(54);
    expect(count('xml-namespace')).toBe(22);
    expect(count('ecma376-relationship')).toBe(29);
    expect(
      sheetJsEntries
        .filter((e) => e.category === 'dead-address')
        .map((e) => e.url)
        .sort(),
    ).toEqual([
      'http://schemas.openxmlformats.org/package/2006/sheetjs/core-properties',
      'http://sheetjs.com',
      'http://sheetjs.openxmlformats.org/officeDocument/2006/relationships/officeDocument',
    ]);
  });

  it('jede SheetJS-Adresse steht wirklich an der angegebenen Fundstelle', () => {
    const lines = readFileSync(
      new URL('../../node_modules/xlsx/xlsx.mjs', import.meta.url),
      'utf8',
    ).split('\n');
    for (const entry of sheetJsEntries) {
      const line = Number(/Zeile (\d+)/.exec(entry.source)?.[1]);
      expect(lines[line - 1], entry.url).toContain(entry.url);
      expect(entry.reason.length).toBeGreaterThan(0);
    }
  });

  it('einzeln freigegebene Adressen haben einen Test (plan.md N3)', () => {
    for (const entry of sheetJsEntries.filter((e) => e.category === 'dead-address')) {
      expect(entry.test).toMatch(/^tests\//);
    }
  });

  // Zuordnung wie in node_modules/.cache/lokalwerk/shipped-files.json nach einem Build.
  const packagesByFile = {
    'assets/sheet.worker-w6J4Ywau.js': ['xlsx'],
    'assets/tabelle.worker-Q1.js': ['xlsx'],
    'assets/merge.worker-TScBrF7F.js': ['@pdf-lib/standard-fonts', 'pako', 'pdf-lib', 'tslib'],
    'assets/nur-pako.worker-P1.js': ['pako'],
  };
  const inBuild = (text: string, file: string, kind: 'js' | 'html' = 'js') =>
    checkText(text, kind, file, { packagesByFile });

  it('SheetJS-Adressen gelten in jeder Datei mit SheetJS, und nur dort (E14)', () => {
    const url = '"http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
    expect(inBuild(url, 'assets/sheet.worker-w6J4Ywau.js')).toEqual([]);
    expect(inBuild(url, 'assets/tabelle.worker-Q1.js')).toEqual([]);
    expect(inBuild(url, 'assets/merge.worker-TScBrF7F.js')).toHaveLength(1);
    expect(inBuild(url, 'assets/sepa-sammelueberweisung/index.html-x.js')).toHaveLength(1);
    expect(inBuild(url, 'assets/sheet.worker-w6J4Ywau.js', 'html')).toHaveLength(1);
  });

  it('greifen nicht in einem Worker ohne die Bibliothek, auch wenn er ähnlich heißt (E14)', () => {
    const url = '"http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
    expect(inBuild(url, 'assets/sheet.worker-ANDERS.js')).toHaveLength(1);
    expect(inBuild(pdfLib, 'assets/nur-pako.worker-P1.js')).toHaveLength(1);
    expect(inBuild(pdfLib, 'assets/merge.worker-ANDERS.js')).toHaveLength(1);
  });

  it('die pdf-lib-Adresse gilt nur in Dateien mit pdf-lib', () => {
    expect(inBuild(pdfLib, 'assets/merge.worker-TScBrF7F.js')).toEqual([]);
    expect(inBuild(pdfLib, 'assets/pdf-zusammenfuegen/index.html-Bz.js')).toHaveLength(1);
    expect(inBuild(pdfLib, 'assets/merge.worker-TScBrF7F.js.map')).toHaveLength(1);
    expect(checkText(pdfLib, 'js')).toHaveLength(1);
    expect(checkText(pdfLib, 'js', 'assets/merge.worker-TScBrF7F.js')).toHaveLength(1);
    expect(inBuild(pdfLib, 'assets/merge.worker-TScBrF7F.js', 'html')).toHaveLength(1);
  });

  it('gilt nur exakt, nicht für Unterseiten oder andere Adressen im Worker', () => {
    const worker = 'assets/merge.worker-TScBrF7F.js';
    expect(inBuild('"https://github.com/Hopding/pdf-lib/tree/master"', worker)).toHaveLength(1);
    expect(inBuild('"https://example.com/"', worker)).toHaveLength(1);
  });

  it('jede Ausnahme nennt ein Paket', () => {
    for (const entry of ALLOWED_LIBRARY_URLS) expect(entry.package, entry.url).toMatch(/^[@\w]/);
  });
});

describe('Lizenzseite (plan.md N3, Variante A)', () => {
  const urls = licenseUrls(collectLicenses(fileURLToPath(new URL('../..', import.meta.url))));
  const check = (html: string, file = LICENSE_PAGE) =>
    checkText(html, 'html', file, { licenseUrls: urls });

  it('kennt die Adressen aus den gesammelten Lizenztexten', () => {
    for (const url of [
      'http://www.apache.org/licenses/',
      'http://www.apache.org/licenses/LICENSE-2.0',
      'http://scripts.sil.org/OFL',
      'https://github.com/simpals/onest',
      'http://sheetjs.com',
    ]) {
      expect(urls.has(url), url).toBe(true);
    }
  });

  it('erlaubt eine Adresse aus den Lizenzdaten im Textinhalt der Lizenzseite', () => {
    expect(
      check('<pre class="license-text">see http://www.apache.org/licenses/LICENSE-2.0 here</pre>'),
    ).toEqual([]);
  });

  it('lehnt dieselbe Adresse in einem href-Attribut ab, auch auf der Lizenzseite', () => {
    expect(check('<a href="http://www.apache.org/licenses/LICENSE-2.0">Lizenz</a>')).toHaveLength(
      1,
    );
  });

  it('lehnt sie in anderen Attributen ab', () => {
    expect(check('<img src="http://scripts.sil.org/OFL">')).toHaveLength(1);
    expect(check('<p title="http://sheetjs.com">x</p>')).toHaveLength(1);
  });

  it('lehnt eine Adresse ab, die nicht in den Lizenzdaten steht, auch im Textinhalt', () => {
    expect(check('<p>https://example.com/tracker</p>')).toHaveLength(1);
    expect(check('<p>http://www.apache.org/licenses/other</p>')).toHaveLength(1);
  });

  it('gilt nur für die Lizenzseite', () => {
    expect(check('<p>http://www.apache.org/licenses/</p>', 'impressum/index.html')).toHaveLength(1);
    expect(check('<p>http://www.apache.org/licenses/</p>', 'index.html')).toHaveLength(1);
  });

  it('gilt nur, wenn die Lizenzdaten übergeben werden', () => {
    expect(checkText('<p>http://www.apache.org/licenses/</p>', 'html', LICENSE_PAGE)).toHaveLength(
      1,
    );
  });
});
