/**
 * Lizenzhinweise der ausgelieferten Bibliotheken und Schriften, beim Build aus den
 * installierten Paketen gelesen (Seite /lizenzen/). So veraltet die Seite nicht bei Updates.
 *
 * Bibliotheken: alle Laufzeit-Abhängigkeiten aus package.json samt ihren Abhängigkeiten.
 * Schriften: die selbst gehosteten Schriften aus public/fonts/ (FONTS unten).
 * Ob wirklich jede ausgelieferte Bibliothek hier steht, prüft build/shipped-packages.ts.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { escapeHtml } from './html-partials.ts';

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

/**
 * Lizenzen mitgelieferter Daten, die das npm-Paket nicht selbst enthält. Der Build verlangt
 * sie, sobald das Paket ausgeliefert wird (build/shipped-packages.ts).
 * APAFML: docs/adobe-afm.md (Quellen, Abgleich, Prüfung der Metriken).
 */
export const REQUIRED_DATA_LICENSES: Record<string, Omit<DataLicense, 'text'> & { file: string }> =
  {
    '@pdf-lib/standard-fonts': {
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
      file: 'build/third-party/APAFML.txt',
    },
  };

/** Wo die direkten Abhängigkeiten verwendet werden; ihre Unterabhängigkeiten erben das. */
const USED_IN: Record<string, string> = {
  'pdf-lib': 'PDFs zusammenfügen',
  xlsx: 'SEPA-Sammelüberweisung (Excel- und ODS-Dateien lesen)',
};

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
  const config = REQUIRED_DATA_LICENSES[name];
  if (!config) return [];
  const { file, ...rest } = config;
  return [{ ...rest, text: readFileSync(join(root, file), 'utf8').trim() }];
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
    visit(dep, root, USED_IN[dep] ?? 'Lokalwerk');
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
