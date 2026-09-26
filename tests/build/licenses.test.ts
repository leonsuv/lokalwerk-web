import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { collectLicenses, renderLicenses, REQUIRED_DATA_LICENSES } from '../../build/licenses.ts';
import {
  packageFromModuleId,
  setShippedForTest,
  verifyLicensesListed,
} from '../../build/shipped-packages.ts';

const root = fileURLToPath(new URL('../..', import.meta.url));
const entries = collectLicenses(root);
const byId = (id: string) => entries.find((e) => e.id === id);

describe('collectLicenses (aus den installierten Paketen)', () => {
  it('enthält alle Laufzeit-Abhängigkeiten samt Unterabhängigkeiten und die Schrift', () => {
    expect(entries.map((e) => e.id).sort()).toEqual(
      [
        '@fontsource/onest',
        '@pdf-lib/standard-fonts',
        '@pdf-lib/upng',
        'pako',
        'pdf-lib',
        'pdfjs-dist',
        'tslib',
        'xlsx',
      ].sort(),
    );
  });

  it('führt nur ausgelieferte Pakete auf, mit den Werkzeugen, die sie laden', () => {
    expect(byId('@napi-rs/canvas')).toBeUndefined();
    expect(byId('xlsx')?.usedIn).toBe(
      'SEPA-Sammelüberweisung, Excel und CSV umwandeln, Duplikate finden',
    );
    expect(byId('pako')?.usedIn).toBe(byId('pdf-lib')?.usedIn);
  });

  it('liest Version und Lizenz aus package.json', () => {
    expect(byId('pdf-lib')).toMatchObject({
      version: '1.17.1',
      license: 'MIT',
      kind: 'Bibliothek',
    });
    expect(byId('xlsx')).toMatchObject({ version: '0.20.3', license: 'Apache-2.0' });
    expect(byId('@fontsource/onest')).toMatchObject({ kind: 'Schrift', license: 'OFL-1.1' });
  });

  it('übernimmt jeden Lizenztext vollständig und wörtlich', () => {
    for (const entry of entries) {
      expect(entry.texts.length, entry.id).toBeGreaterThan(0);
      for (const text of entry.texts)
        expect(text.text.length, `${entry.id} ${text.file}`).toBeGreaterThan(100);
    }
    expect(byId('xlsx')?.texts[0]?.text).toContain('Apache License');
    expect(byId('xlsx')?.texts[0]?.text).toContain('END OF TERMS AND CONDITIONS');
    expect(byId('@fontsource/onest')?.texts[0]?.text).toContain(
      'SIL OPEN FONT LICENSE Version 1.1',
    );
  });

  it('nennt die Urheber', () => {
    expect(byId('pdf-lib')?.notices).toContain('Copyright (c) 2019 Andrew Dillon');
    expect(byId('xlsx')?.notices).toContain(
      'xlsx.js (C) 2013-present SheetJS -- http://sheetjs.com',
    );
    expect(byId('tslib')?.notices).toContain('Copyright (c) Microsoft Corporation.');
    expect(byId('@fontsource/onest')?.notices[0]).toContain('The Onest Project Authors');
  });

  it('nennt die Adobe-Hinweise aus den Metriken der 14 PDF-Standardschriften', () => {
    const lines = byId('@pdf-lib/standard-fonts')?.extra?.lines ?? [];
    expect(lines.join(' ')).toContain('Adobe Systems Incorporated');
    for (const font of ['Courier', 'Helvetica', 'Times-Roman', 'Symbol', 'ZapfDingbats']) {
      expect(lines.join(' ')).toContain(font);
    }
  });
});

describe('Adobe Postscript AFM License (APAFML) für die Schriftmetriken', () => {
  const data = byId('@pdf-lib/standard-fonts')?.dataLicenses ?? [];

  it('steht beim Eintrag von @pdf-lib/standard-fonts', () => {
    expect(data.map((d) => d.spdx)).toEqual(['APAFML']);
  });

  it('übernimmt den Wortlaut unverändert mit Urheberzeile', () => {
    const text = data[0]?.text ?? '';
    expect(text).toBe(
      readFileSync(new URL('../../build/third-party/APAFML.txt', import.meta.url), 'utf8').trim(),
    );
    expect(text.split('\n')[0]).toBe(
      'Copyright (c) 1985, 1987, 1989, 1990, 1991, 1992, 1993, 1997 Adobe Systems Incorporated. All Rights Reserved.',
    );
    expect(text).toContain(
      'This file and the 14 PostScript(R) AFM files it accompanies may be used, copied, and distributed for any purpose and without charge, with or without modification, provided that all copyright notices are retained; that the AFM files are not distributed without this file; that all modifications to this file or any of the AFM files are prominently noted in the modified file(s); and that this paragraph is not modified. Adobe Systems has no responsibility or obligation to support the use of the AFM files.',
    );
  });

  it('vermerkt die Umwandlung und die geprüften Änderungen (Bedingung der Lizenz)', () => {
    expect(data[0]?.note).toContain('komprimiertes Format umgewandelt');
    expect(data[0]?.note).toContain('IsFixedPitch');
  });

  it('erscheint auf der Seite mit SPDX-Kennung', () => {
    const html = renderLicenses(entries);
    expect(html).toContain('Adobe Postscript AFM License (APAFML)');
    expect(html).toContain('MIT; APAFML (Enthaltene Schriftmetriken');
  });
});

describe('Lizenzen der Dekoder in pdf.js (Leon, 25.09.2026)', () => {
  const data = byId('pdfjs-dist')?.dataLicenses ?? [];
  const wasm = (file: string) =>
    readFileSync(new URL(`../../node_modules/pdfjs-dist/wasm/${file}`, import.meta.url), 'utf8');

  it('nennt OpenJPEG und PDFium-JBIG2 samt Anbindung, wörtlich aus dem Paket', () => {
    expect(data.map((d) => d.file.split('/').pop())).toEqual([
      'LICENSE_OPENJPEG',
      'LICENSE_PDFJS_OPENJPEG',
      'LICENSE_JBIG2',
      'LICENSE_PDFJS_JBIG2',
    ]);
    for (const d of data) {
      expect(d.text, d.file).toBe(wasm(d.file.split('/').pop() ?? '').trim());
      expect(d.source, d.file).toMatch(/aus dem npm-Paket pdfjs-dist, unverändert/);
    }
    expect(data[0]?.text).toContain('Universite catholique de Louvain');
    expect(data[2]?.text).toContain('The PDFium Authors');
  });

  it('der Build verlangt jede davon, sobald pdf.js ausgeliefert wird', () => {
    setShippedForTest(['pdfjs-dist']);
    const fontsDir = fileURLToPath(new URL('../../public/fonts', import.meta.url));
    const run = (files: string[]) => () =>
      (
        verifyLicensesListed({
          listed: () => ['pdfjs-dist', '@fontsource/onest'],
          dataLicenses: () => ({ 'pdfjs-dist': files }),
          requiredDataLicenses: REQUIRED_DATA_LICENSES,
          fontsDir,
          fontPrefixes: { 'onest-': '@fontsource/onest' },
        }).closeBundle as () => void
      ).call({});
    const all = data.map((d) => d.file);
    expect(run(all)).not.toThrow();
    expect(run(all.filter((f) => !f.endsWith('LICENSE_JBIG2')))).toThrow(/LICENSE_JBIG2/);
    setShippedForTest([]);
  });
});

describe('renderLicenses', () => {
  it('maskiert HTML und gibt jeden Text vollständig aus', () => {
    const html = renderLicenses([
      {
        id: '@a/b',
        name: '@a/b',
        version: '1.0.0',
        kind: 'Bibliothek',
        license: 'MIT',
        usedIn: 'Test',
        notices: ['Copyright <Test> & Co'],
        texts: [{ file: 'LICENSE', text: 'Text mit <b>' }],
        dataLicenses: [],
      },
    ]);
    expect(html).toContain('Copyright &lt;Test&gt; &amp; Co');
    expect(html).toContain('<pre class="license-text">Text mit &lt;b&gt;</pre>');
    expect(html).toContain('id="a-b"');
  });
});

describe('packageFromModuleId (Build-Prüfung der ausgelieferten Pakete)', () => {
  it.each([
    ['/p/node_modules/pdf-lib/es/api/PDFDocument.js', 'pdf-lib'],
    ['/p/node_modules/@pdf-lib/upng/UPNG.js', '@pdf-lib/upng'],
    ['/p/node_modules/pdf-lib/node_modules/tslib/tslib.es6.js', 'tslib'],
    ['/p/node_modules/xlsx/xlsx.mjs?commonjs-proxy', 'xlsx'],
    ['/p/src/core/pdf/merge.ts', null],
    ['\0vite/preload-helper.js', null],
  ])('%s → %s', (id, expected) => {
    expect(packageFromModuleId(id)).toBe(expected);
  });
});

describe('verifyLicensesListed (Build bricht ab, wenn etwas fehlt)', () => {
  const fontsDir = fileURLToPath(new URL('../../public/fonts', import.meta.url));
  const run = (listed: string[], prefixes: Record<string, string>) => {
    const plugin = verifyLicensesListed({ listed: () => listed, fontsDir, fontPrefixes: prefixes });
    const hook = plugin.closeBundle as () => void;
    return () => hook.call({});
  };

  it('bricht ab, wenn die Schrift nicht aufgeführt ist', () => {
    expect(run([], { 'onest-': '@fontsource/onest' })).toThrow(/@fontsource\/onest/);
  });

  it('bricht ab, wenn eine Schriftdatei keinem Paket zugeordnet ist', () => {
    expect(run(['@fontsource/onest'], {})).toThrow(/keinem Paket zugeordnet/);
  });

  it('bricht ab, wenn @pdf-lib/standard-fonts ausgeliefert wird und APAFML fehlt', () => {
    setShippedForTest(['@pdf-lib/standard-fonts']);
    const plugin = verifyLicensesListed({
      listed: () => ['@pdf-lib/standard-fonts', '@fontsource/onest'],
      dataLicenses: () => ({ '@pdf-lib/standard-fonts': [] }),
      requiredDataLicenses: REQUIRED_DATA_LICENSES,
      fontsDir,
      fontPrefixes: { 'onest-': '@fontsource/onest' },
    });
    expect(() => (plugin.closeBundle as () => void).call({})).toThrow(/APAFML/);
    setShippedForTest([]);
  });

  it('bricht ab, wenn eine aufgeführte Bibliothek gar nicht ausgeliefert wird', () => {
    setShippedForTest([]);
    expect(run(['@fontsource/onest', 'pdfjs-dist'], { 'onest-': '@fontsource/onest' })).toThrow(
      /pdfjs-dist steht auf \/lizenzen\/, wird aber nicht ausgeliefert/,
    );
  });

  it('bricht ab, wenn @napi-rs/canvas ausgeliefert wird (Leon, 25.09.2026)', () => {
    setShippedForTest(['@napi-rs/canvas']);
    expect(
      run(['@fontsource/onest', '@napi-rs/canvas'], { 'onest-': '@fontsource/onest' }),
    ).toThrow(/dürfen nie ausgeliefert werden: @napi-rs\/canvas/);
    setShippedForTest([]);
  });

  it('bricht ab, wenn die genannten Werkzeuge nicht zum Build passen', () => {
    setShippedForTest(['xlsx'], { xlsx: ['duplikate-finden', 'sepa-sammelueberweisung'] });
    const plugin = (usedIn: Record<string, string[]>) =>
      verifyLicensesListed({
        listed: () => ['@fontsource/onest', 'xlsx'],
        usedIn,
        fontsDir,
        fontPrefixes: { 'onest-': '@fontsource/onest' },
      });
    const close = (usedIn: Record<string, string[]>) => () =>
      (plugin(usedIn).closeBundle as () => void).call({});
    expect(close({ xlsx: ['sepa-sammelueberweisung'] })).toThrow(
      /xlsx wird laut Build von \[duplikate-finden, sepa-sammelueberweisung\] geladen/,
    );
    expect(close({ xlsx: ['sepa-sammelueberweisung', 'duplikate-finden'] })).not.toThrow();
    setShippedForTest([]);
  });

  it('läuft durch, wenn alles aufgeführt ist', () => {
    expect(run(['@fontsource/onest'], { 'onest-': '@fontsource/onest' })).not.toThrow();
  });
});
