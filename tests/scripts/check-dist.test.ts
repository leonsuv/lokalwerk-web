import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { collectLicenses } from '../../build/licenses.ts';
import {
  LICENSE_PAGE,
  licenseUrls,
  ALLOWED_JS_URLS,
  ALLOWED_LIBRARY_URLS,
  ALLOWED_SVG_XML_URLS,
  checkDist,
  checkForbidden,
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

  const pdfjsEntries = ALLOWED_LIBRARY_URLS.filter((e) => e.package === 'pdfjs-dist');

  it('enthält für pdf.js 17 Namensräume und 4 einzeln freigegebene tote Adressen', () => {
    expect(pdfjsEntries).toHaveLength(21);
    expect(pdfjsEntries.filter((e) => e.category === 'xml-namespace')).toHaveLength(17);
    expect(pdfjsEntries.filter((e) => e.category === 'dead-address').map((e) => e.url)).toEqual([
      'http://example.com',
      'https://foo.bar',
      'https://github.com/zloirock/core-js/blob/v3.50.0/LICENSE',
      'https://github.com/zloirock/core-js',
    ]);
  });

  it('Fundstellen im Legacy-Build, den die Seiten laden (docs/pdfjs-kompatibilitaet.md)', () => {
    for (const entry of pdfjsEntries) {
      expect(entry.source, entry.url).toMatch(/^node_modules\/pdfjs-dist\/legacy\/build\//);
    }
    const imports = ['pdfjs.ts', 'pdfjs.worker.ts'].map((f) =>
      readFileSync(new URL(`../../src/ui/pdfjs/${f}`, import.meta.url), 'utf8'),
    );
    for (const text of imports)
      expect(text).toMatch(/'pdfjs-dist\/legacy\/build\/pdf(\.worker)?\.mjs'/);
  });

  it('jede pdf.js-Adresse steht wirklich an der angegebenen Fundstelle', () => {
    for (const entry of pdfjsEntries) {
      const [, file, line] = /^(node_modules\/\S+), Zeile (\d+)$/.exec(entry.source) ?? [];
      const lines = readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8').split('\n');
      expect(lines[Number(line) - 1], entry.url).toContain(entry.url);
    }
  });

  it('pdf.js-Adressen gelten nur in Dateien mit pdf.js (E14)', () => {
    const files = { 'assets/pdfjs-Ab.js': ['pdfjs-dist'], 'assets/merge.worker-C.js': ['pdf-lib'] };
    const check = (file: string) =>
      checkText('"https://foo.bar"', 'js', file, { packagesByFile: files });
    expect(check('assets/pdfjs-Ab.js')).toEqual([]);
    expect(check('assets/merge.worker-C.js')).toHaveLength(1);
    expect(check('assets/pdf-teilen/index.html-D.js')).toHaveLength(1);
  });

  it('pdf.js erzeugt bei uns keine Dateien (tote Adressen P2.16, P3)', () => {
    // Die Adressen landen nur in Dateien, die pdf.js selbst schreibt (saveDocument, getData,
    // Download-Hilfen). Unser Code nutzt pdf.js nur zum Lesen und Zeichnen.
    const src = fileURLToPath(new URL('../../src', import.meta.url));
    const files = readdirSync(src, { recursive: true, encoding: 'utf8' }).filter((f) =>
      f.endsWith('.ts'),
    );
    for (const file of files) {
      const text = readFileSync(join(src, file), 'utf8');
      expect(text, file).not.toMatch(
        /\.saveDocument\(|\.getData\(|updateUrlHash|getPdfFilenameFromUrl/,
      );
    }
    for (const entry of pdfjsEntries.filter((e) => e.test)) {
      expect(entry.test).toMatch(/^tests\//);
    }
  });

  it('jede Ausnahme nennt ein Paket', () => {
    for (const entry of ALLOWED_LIBRARY_URLS) expect(entry.package, entry.url).toMatch(/^[@\w]/);
  });
});

describe('uqr (plan-phase2.md E5)', () => {
  const entries = ALLOWED_LIBRARY_URLS.filter((e) => e.package === 'uqr');

  it('nur der SVG-Namensraum, an der angegebenen Fundstelle', () => {
    expect(entries.map((e) => e.url)).toEqual(['http://www.w3.org/2000/svg']);
    const lines = readFileSync(
      new URL('../../node_modules/uqr/dist/index.mjs', import.meta.url),
      'utf8',
    ).split('\n');
    for (const entry of entries) {
      const line = Number(/Zeile (\d+)/.exec(entry.source)?.[1]);
      expect(lines[line - 1]).toContain(entry.url);
    }
  });

  it('gilt nur in Dateien mit uqr', () => {
    const files = { 'assets/qr-output-A.js': ['uqr'], 'assets/page-B.js': [] };
    const check = (file: string) =>
      checkText('"http://www.w3.org/2000/svg"', 'js', file, { packagesByFile: files });
    expect(check('assets/qr-output-A.js')).toEqual([]);
    expect(check('assets/page-B.js')).toHaveLength(1);
  });
});

describe('exifr (plan-phase2.md E7)', () => {
  const entries = ALLOWED_LIBRARY_URLS.filter((e) => e.package === 'exifr');

  it('drei XMP-Namensräume und eine tote Adresse, alle im Lite-Bundle', () => {
    expect(entries.map((e) => e.url).sort()).toEqual([
      'http://ns.adobe.com/',
      'http://ns.adobe.com/xap/1.0/',
      'http://ns.adobe.com/xmp/extension/',
      'https://github.com/MikeKovarik/exifr',
    ]);
    const code = readFileSync(
      new URL('../../node_modules/exifr/dist/lite.esm.mjs', import.meta.url),
      'utf8',
    );
    for (const entry of entries) expect(code, entry.url).toContain(entry.url);
  });

  it('gelten nur in Dateien mit exifr', () => {
    const files = { 'assets/meta.worker-A.js': ['exifr'], 'assets/page-B.js': [] };
    const check = (file: string) =>
      checkText('"http://ns.adobe.com/xap/1.0/"', 'js', file, { packagesByFile: files });
    expect(check('assets/meta.worker-A.js')).toEqual([]);
    expect(check('assets/page-B.js')).toHaveLength(1);
  });
});

describe('Lizenzseite (plan.md N3, Variante A)', () => {
  it('liest Adressen in spitzen Klammern ohne &gt; (z. B. „Anthony Fu <https://github.com/antfu>“)', () => {
    const html = '<p>Copyright (c) 2023 Anthony Fu &lt;https://github.com/antfu&gt;</p>';
    expect(
      checkText(html, 'html', LICENSE_PAGE, { licenseUrls: new Set(['https://github.com/antfu']) }),
    ).toEqual([]);
    expect(checkText(html, 'html', 'index.html')).toEqual([
      'fremde Adresse: https://github.com/antfu',
    ]);
  });

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

describe('pdf.js-Sandbox und QuickJS (plan-phase2.md Abschnitt 5.2)', () => {
  const pdfjs = (file: string) =>
    readFileSync(new URL(`../../node_modules/pdfjs-dist/${file}`, import.meta.url), 'utf8');

  it('meldet den Code der Sandbox und der QuickJS-Engine', () => {
    expect(checkForbidden('assets/a.js', pdfjs('build/pdf.sandbox.min.mjs'))).not.toEqual([]);
    expect(checkForbidden('assets/b.js', pdfjs('wasm/quickjs-eval.js'))).not.toEqual([]);
  });

  it('meldet die Dateien auch unter ihrem Namen, binär ohne Inhalt', () => {
    expect(checkForbidden('pdfjs/quickjs-eval.wasm', null)).toEqual([
      'pdf.js-Sandbox oder QuickJS wird ausgeliefert',
    ]);
    expect(checkForbidden('assets/pdf.sandbox-AbC.mjs', '')).toEqual([
      'pdf.js-Sandbox oder QuickJS wird ausgeliefert',
    ]);
  });

  it('lässt pdf.js selbst und die Ersatzdekoder durch', () => {
    for (const file of [
      'build/pdf.min.mjs',
      'build/pdf.worker.min.mjs',
      'wasm/openjpeg_nowasm_fallback.js',
      'wasm/jbig2_nowasm_fallback.js',
    ]) {
      expect(checkForbidden('assets/x.js', pdfjs(file)), file).toEqual([]);
    }
  });

  it('prüft in checkDist auch Dateien, die keine Textdateien sind', () => {
    const dir = mkdtempSync(join(tmpdir(), 'check-dist-'));
    mkdirSync(join(dir, 'pdfjs'));
    writeFileSync(join(dir, 'pdfjs', 'quickjs-eval.wasm'), new Uint8Array([0, 97, 115, 109]));
    expect(checkDist(dir)).toEqual([
      'pdfjs/quickjs-eval.wasm: pdf.js-Sandbox oder QuickJS wird ausgeliefert',
    ]);
  });
});
