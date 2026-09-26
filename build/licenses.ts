/**
 * Lizenzhinweise der ausgelieferten Bibliotheken und Schriften, beim Build aus den
 * installierten Paketen gelesen (Seite /lizenzen/). So veraltet die Seite nicht bei Updates.
 *
 * Bibliotheken: die ausgelieferten Laufzeit-Abhängigkeiten (USED_IN) samt ihren Abhängigkeiten.
 * Nicht ausgelieferte Abhängigkeiten stehen nicht auf der Seite (Leon, 25.09.2026).
 * Schriften: die selbst gehosteten Schriften aus public/fonts/ (FONTS unten).
 * Ob wirklich jede ausgelieferte Bibliothek hier steht, prüft build/shipped-packages.ts.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { escapeHtml } from './html-partials.ts';
import { toolById } from './pages.ts';

export interface LicenseText {
  file: string;
  text: string;
}

export interface LicenseEntry {
  /** npm-Paketname */
  id: string;
  name: string;
  version: string;
  kind: 'Bibliothek' | 'Schrift';
  license: string;
  usedIn: string;
  /** Urheberangaben aus Lizenzdateien und Kopfkommentaren, wörtlich */
  notices: string[];
  /** Vollständige Lizenz- und NOTICE-Dateien, wörtlich */
  texts: LicenseText[];
  /** Weitere Hinweise, die in den ausgelieferten Daten stehen */
  extra?: { title: string; lines: string[] };
  /** Lizenzen für mitgelieferte Daten, deren Text nicht im npm-Paket liegt */
  dataLicenses: DataLicense[];
}

export interface DataLicense {
  /** Datei mit dem Lizenztext, relativ zum Projektordner; zugleich Kennung für die Build-Prüfung */
  file: string;
  /** SPDX-Kennung */
  spdx: string;
  name: string;
  subject: string;
  /** Vermerk zu Änderungen an den Daten (Bedingung der Lizenz) */
  note: string;
  /** Herkunft des Lizenztexts, ohne Adressen (Adressen stehen in docs/) */
  source: string;
  text: string;
}

const PDFJS_WASM = 'node_modules/pdfjs-dist/wasm';
const PDFJS_DECODERS =
  'pdf.js enthält diesen Dekoder als von Mozilla übersetzten Code (WebAssembly und daraus ' +
  'erzeugtes JavaScript). Ausgeliefert wird nur die JavaScript-Fassung, unverändert.';

/**
 * Lizenzen mitgelieferter Teile, deren Text nicht in der Hauptlizenzdatei des npm-Pakets steht.
 * Der Build verlangt jede davon, sobald das Paket ausgeliefert wird (build/shipped-packages.ts).
 * APAFML: docs/adobe-afm.md (Quellen, Abgleich, Prüfung der Metriken).
 * pdfjs-dist: Dekoder für JPEG 2000 (OpenJPEG) und JBIG2/CCITT (PDFium), Texte wörtlich aus dem
 * Paket (Leon, 25.09.2026).
 */
export const REQUIRED_DATA_LICENSES: Record<string, ReadonlyArray<Omit<DataLicense, 'text'>>> = {
  'pdfjs-dist': [
    {
      file: `${PDFJS_WASM}/LICENSE_OPENJPEG`,
      spdx: 'BSD-2-Clause',
      name: 'BSD 2-Clause License',
      subject: 'JPEG-2000-Dekoder OpenJPEG',
      note: PDFJS_DECODERS,
      source: 'Datei wasm/LICENSE_OPENJPEG aus dem npm-Paket pdfjs-dist, unverändert.',
    },
    {
      file: `${PDFJS_WASM}/LICENSE_PDFJS_OPENJPEG`,
      spdx: 'BSD-2-Clause',
      name: 'BSD 2-Clause License',
      subject: 'Anbindung von OpenJPEG an pdf.js',
      note: 'Der von Mozilla geschriebene Teil, der OpenJPEG mit pdf.js verbindet.',
      source: 'Datei wasm/LICENSE_PDFJS_OPENJPEG aus dem npm-Paket pdfjs-dist, unverändert.',
    },
    {
      file: `${PDFJS_WASM}/LICENSE_JBIG2`,
      spdx: 'BSD-3-Clause AND Apache-2.0',
      name: 'BSD 3-Clause License und Apache License 2.0',
      subject: 'JBIG2- und CCITT-Dekoder aus PDFium',
      note:
        PDFJS_DECODERS +
        ' Die Lizenzdatei enthält den Hinweis der PDFium-Autoren (BSD 3-Clause) und den vollständigen Text der Apache License 2.0.',
      source: 'Datei wasm/LICENSE_JBIG2 aus dem npm-Paket pdfjs-dist, unverändert.',
    },
    {
      file: `${PDFJS_WASM}/LICENSE_PDFJS_JBIG2`,
      spdx: 'Apache-2.0',
      name: 'Apache License 2.0',
      subject: 'Anbindung des JBIG2-Dekoders an pdf.js',
      note: 'Der von Mozilla geschriebene Teil, der den PDFium-Dekoder mit pdf.js verbindet.',
      source: 'Datei wasm/LICENSE_PDFJS_JBIG2 aus dem npm-Paket pdfjs-dist, unverändert.',
    },
  ],
  '@pdf-lib/standard-fonts': [
    {
      file: 'build/third-party/APAFML.txt',
      spdx: 'APAFML',
      name: 'Adobe Postscript AFM License',
      subject: 'Enthaltene Schriftmetriken der 14 PDF-Standardschriften (Adobe Core 14 AFM)',
      note:
        'Von pdf-lib in ein komprimiertes Format umgewandelt. Zeichenbreiten, Unterschneidungspaare und die übrigen ' +
        'Kopfangaben sind unverändert. Nicht übernommen wurden Zeichencodes, Begrenzungsrahmen der Zeichen, ' +
        'Ligaturangaben und die Kommentarzeilen der Originaldateien. Abweichend vom Original steht die Angabe ' +
        '„IsFixedPitch“ bei allen 14 Schriften auf „true“ (im Original nur bei den vier Courier-Schnitten); ' +
        'pdf-lib verwendet diese Angabe nicht.',
      source:
        'Wortlaut aus der SPDX-Lizenzliste (Kennung APAFML), abgeglichen mit MustRead.html aus Adobes ' +
        'Core14_AFMs.tar, wie sie im Quellcode-Repository von @pdf-lib/standard-fonts liegt.',
    },
  ],
};

/**
 * Ausgelieferte direkte Abhängigkeiten und die Werkzeuge (ids aus build/pages.ts), die sie laden.
 * Ihre Unterabhängigkeiten erben das. Nur diese Pakete stehen auf /lizenzen/. Der Build prüft,
 * dass die Werkzeuge genau stimmen (build/shipped-packages.ts, verifyLicensesListed).
 */
export const USED_IN: Readonly<Record<string, readonly string[]>> = {
  'pdf-lib': [
    'pdf-zusammenfuegen',
    'pdf-seiten-bearbeiten',
    'pdf-schwaerzen',
    'pdf-unterschreiben',
    'pdf-teilen',
    'pdf-seitenzahlen',
    'pdf-stempel',
    'pdf-metadaten-entfernen',
    'bilder-zu-pdf',
  ],
  xlsx: ['sepa-sammelueberweisung', 'excel-csv-umwandeln', 'duplikate-finden'],
  'pdfjs-dist': ['pdf-seiten-bearbeiten', 'pdf-zu-bildern', 'pdf-schwaerzen', 'pdf-unterschreiben'],
};

/** Namen der Werkzeuge für die Lizenzseite, in der Reihenfolge von USED_IN */
function toolNames(ids: readonly string[]): string {
  return ids
    .map((id) => {
      const tool = toolById(id);
      if (!tool) throw new Error(`Lizenzen: Werkzeug ${id} gibt es nicht (build/pages.ts)`);
      return tool.tool.name;
    })
    .join(', ');
}

/** Selbst gehostete Schriften (public/fonts/, scripts/copy-fonts.mjs). */
const FONTS = [{ id: '@fontsource/onest', filePrefix: 'onest-', name: 'Onest' }];

const LICENSE_FILE = /^(licen[cs]e|copying|notice|copyrightnotice)(\.(md|txt))?$/i;

interface PackageJson {
  name: string;
  version: string;
  license?: string | { type: string };
  dependencies?: Record<string, string>;
  module?: string;
  main?: string;
}

const readJson = <T>(file: string): T => JSON.parse(readFileSync(file, 'utf8')) as T;

/** Paketordner wie Node ihn auflöst: erst verschachtelt, dann weiter oben. */
function packageDir(name: string, fromDir: string, root: string): string {
  let dir = fromDir;
  for (;;) {
    const candidate = join(dir, 'node_modules', name);
    if (existsSync(join(candidate, 'package.json'))) return candidate;
    if (dir === root || dirname(dir) === dir) break;
    dir = dirname(dir);
  }
  throw new Error(`Lizenzen: Paket ${name} nicht gefunden (von ${fromDir})`);
}

function licenseTexts(dir: string): LicenseText[] {
  return readdirSync(dir)
    .filter((file) => LICENSE_FILE.test(file))
    .sort()
    .map((file) => ({ file, text: readFileSync(join(dir, file), 'utf8').trim() }));
}

function copyrightLines(texts: readonly LicenseText[]): string[] {
  const lines = texts
    .flatMap((t) => t.text.split(/\r?\n/))
    .map((l) => l.replace(/^[/*!\s]+/, '').trim());
  return lines.filter(
    (l) => /^copyright\b|^\(c\)/i.test(l) && !/\[yyyy\]|copyright owner/i.test(l),
  );
}

/** Erhaltener Kopfkommentar /*! … *\/ im Einstiegsmodul, z. B. bei SheetJS. */
function headerNotice(dir: string, pkg: PackageJson): string[] {
  const entry = pkg.module ?? pkg.main;
  if (!entry || !existsSync(join(dir, entry))) return [];
  const head = readFileSync(join(dir, entry), 'utf8').slice(0, 2000);
  const match = /\/\*!([^\n]*?\((?:c|C)\)[^\n]*?)\*\//.exec(head);
  return match?.[1] ? [match[1].trim()] : [];
}

/** Die Metriken der 14 PDF-Standardschriften enthalten Urheberhinweise von Adobe. */
function standardFontNotices(dir: string): NonNullable<LicenseEntry['extra']> {
  const require = createRequire(join(dir, 'package.json'));
  const fonts = require(dir) as {
    FontNames: Record<string, string>;
    Font: { load(name: string): { Notice: string } };
  };
  const byNotice = new Map<string, string[]>();
  for (const name of Object.values(fonts.FontNames)) {
    const notice = fonts.Font.load(name).Notice.trim();
    byNotice.set(notice, [...(byNotice.get(notice) ?? []), name]);
  }
  return {
    title: 'Hinweise in den enthaltenen Schriftmetriken der 14 PDF-Standardschriften',
    lines: [...byNotice].map(([notice, names]) => `${names.join(', ')}: ${notice}`),
  };
}

function dataLicensesFor(name: string, root: string): DataLicense[] {
  return (REQUIRED_DATA_LICENSES[name] ?? []).map((config) => ({
    ...config,
    text: readFileSync(join(root, config.file), 'utf8').trim(),
  }));
}

export function collectLicenses(root: string): LicenseEntry[] {
  const rootPkg = readJson<PackageJson>(join(root, 'package.json'));
  const entries = new Map<string, LicenseEntry>();

  const visit = (name: string, fromDir: string, usedIn: string) => {
    if (entries.has(name)) return;
    const dir = packageDir(name, fromDir, root);
    const pkg = readJson<PackageJson>(join(dir, 'package.json'));
    const texts = licenseTexts(dir);
    if (texts.length === 0) throw new Error(`Lizenzen: ${name} hat keine Lizenzdatei`);
    entries.set(name, {
      id: name,
      name,
      version: pkg.version,
      kind: 'Bibliothek',
      license: typeof pkg.license === 'string' ? pkg.license : (pkg.license?.type ?? 'unbekannt'),
      usedIn,
      notices: [...new Set([...headerNotice(dir, pkg), ...copyrightLines(texts)])],
      texts,
      ...(name === '@pdf-lib/standard-fonts' ? { extra: standardFontNotices(dir) } : {}),
      dataLicenses: dataLicensesFor(name, root),
    });
    for (const dep of Object.keys(pkg.dependencies ?? {})) visit(dep, dir, usedIn);
  };
  for (const dep of Object.keys(rootPkg.dependencies ?? {})) {
    const tools = USED_IN[dep];
    if (tools) visit(dep, root, toolNames(tools));
  }

  for (const font of FONTS) {
    const dir = packageDir(font.id, root, root);
    const pkg = readJson<PackageJson>(join(dir, 'package.json'));
    const meta = readJson<{ version: string; license: { type: string; attribution?: string } }>(
      join(dir, 'metadata.json'),
    );
    const texts = licenseTexts(dir);
    entries.set(font.id, {
      id: font.id,
      name: font.name,
      version: `${meta.version} (über ${font.id} ${pkg.version})`,
      kind: 'Schrift',
      license: meta.license.type,
      usedIn: 'alle Seiten (selbst gehostet)',
      dataLicenses: [],
      notices: [
        ...new Set([
          ...(meta.license.attribution ? [meta.license.attribution] : []),
          ...copyrightLines(texts),
        ]),
      ],
      texts,
    });
  }

  return [...entries.values()];
}

/** Dateinamen-Präfixe der Schriften in public/fonts/, damit der Build sie zuordnen kann. */
export const FONT_FILE_PREFIXES: Record<string, string> = Object.fromEntries(
  FONTS.map((f) => [f.filePrefix, f.id]),
);

export function renderLicenses(entries: readonly LicenseEntry[]): string {
  const e = escapeHtml;
  return entries
    .map((entry) => {
      const parts = [
        `<section class="license" id="${e(entry.id.replace(/[@/]/g, '-').replace(/^-/, ''))}">`,
        `<h2>${e(entry.name)}</h2>`,
        '<dl class="license-facts">',
        `<dt>Art</dt><dd>${entry.kind}</dd>`,
        `<dt>Version</dt><dd>${e(entry.version)}</dd>`,
        `<dt>Lizenz</dt><dd>${e([entry.license, ...entry.dataLicenses.map((d) => `${d.spdx} (${d.subject})`)].join('; '))}</dd>`,
        `<dt>Verwendet für</dt><dd>${e(entry.usedIn)}</dd>`,
        `<dt>Urheber</dt><dd>${entry.notices.map(e).join('<br>') || 'siehe Lizenztext'}</dd>`,
        '</dl>',
      ];
      if (entry.extra) {
        parts.push(`<h3>${e(entry.extra.title)}</h3>`, '<ul class="license-notes">');
        parts.push(...entry.extra.lines.map((line) => `<li>${e(line)}</li>`), '</ul>');
      }
      for (const text of entry.texts) {
        parts.push(`<h3>${e(text.file)}</h3>`, `<pre class="license-text">${e(text.text)}</pre>`);
      }
      for (const data of entry.dataLicenses) {
        parts.push(
          `<h3>${e(data.subject)}: ${e(data.name)} (${e(data.spdx)})</h3>`,
          `<p>${e(data.note)}</p>`,
          `<p class="license-source">${e(data.source)}</p>`,
          `<pre class="license-text">${e(data.text)}</pre>`,
        );
      }
      parts.push('</section>');
      return parts.join('\n');
    })
    .join('\n');
}
