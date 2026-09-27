/**
 * Prüft beim Build, dass jede tatsächlich ausgelieferte Bibliothek und Schrift auf der
 * Lizenzseite steht (build/licenses.ts). Die Plugin-Instanzen im Haupt-Build und in den
 * Worker-Builds teilen sich die Liste über dieses Modul.
 *
 * Außerdem entsteht eine Liste, welche Datei im Build welche Pakete enthält. check-dist
 * wendet die Adresslisten einer Bibliothek nur auf diese Dateien an (plan-phase2.md E14).
 * Sie liegt außerhalb von dist/, damit sie nicht ausgeliefert wird.
 */

import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Plugin } from 'vite';

const shipped = new Set<string>();
/** Datei im Build (relativ zu dist/) → enthaltene Pakete */
const packagesByFile = new Map<string, Set<string>>();
/** Paket → Werkzeuge (ids aus build/pages.ts), die es laden, ermittelt aus dem Haupt-Build */
let toolsByPackage = new Map<string, Set<string>>();

/**
 * Pakete, die nie ausgeliefert werden dürfen. @napi-rs/canvas ist eine optionale
 * Node-Abhängigkeit von pdfjs-dist und liegt nur in node_modules (Leon, 25.09.2026).
 */
export const NEVER_SHIPPED = /^@napi-rs\//;

/** Nur für Tests: ausgelieferte Pakete und ihre Werkzeuge setzen. */
export function setShippedForTest(
  names: readonly string[],
  tools: Record<string, readonly string[]> = {},
): void {
  shipped.clear();
  for (const name of names) shipped.add(name);
  toolsByPackage = new Map(Object.entries(tools).map(([p, t]) => [p, new Set(t)]));
}

/** Für Dateien, die ein Plugin unverändert aus einem Paket übernimmt (build/pdfjs.ts). */
export function recordFilePackages(fileName: string, packages: readonly string[]): void {
  for (const name of packages) shipped.add(name);
  packagesByFile.set(fileName, new Set(packages));
}

/** Paketname aus einem Modulpfad, z. B. …/node_modules/@pdf-lib/upng/UPNG.js → @pdf-lib/upng */
export function packageFromModuleId(id: string): string | null {
  const match = /[\\/]node_modules[\\/]((?:@[^\\/]+[\\/])?[^\\/]+)/.exec(id.replace(/\?.*$/, ''));
  if (!match?.[1] || id.startsWith('\0')) return null;
  // Bei verschachtelten node_modules zählt das innerste Paket.
  const all = [...id.matchAll(/[\\/]node_modules[\\/]((?:@[^\\/]+[\\/])?[^\\/]+)/g)];
  return (all.at(-1)?.[1] ?? match[1]).replace(/\\/g, '/');
}

/** Zeichnet die Pakete aller erzeugten Bundles auf (Haupt-Build und Worker). */
export function recordShippedPackages(): Plugin {
  return {
    name: 'lokalwerk-record-shipped-packages',
    apply: 'build',
    generateBundle(_options, bundle) {
      for (const output of Object.values(bundle)) {
        if (output.type !== 'chunk') continue;
        const packages = new Set<string>();
        for (const id of output.moduleIds) {
          const name = packageFromModuleId(id);
          if (name) packages.add(name);
        }
        for (const name of packages) shipped.add(name);
        if (packages.size > 0) packagesByFile.set(output.fileName, packages);
      }
    },
  };
}

export interface BundleChunk {
  fileName: string;
  code: string;
  imports: readonly string[];
  dynamicImports: readonly string[];
  moduleIds: readonly string[];
}

const TOOL_PAGE = /[\\/]src[\\/]tools[\\/]([^\\/]+)[\\/]page\.ts$/;

/**
 * Welche Werkzeuge welche Pakete laden: vom Seitencode (src/tools/<id>/page.ts) aus alle
 * statisch und dynamisch geladenen Teile, dazu die Worker, deren Dateinamen darin stehen.
 * `filePackages` ist die Zuordnung Datei → Pakete aus allen Builds (auch Worker). Nur ids aus
 * `toolIds` zählen; die Startseite lädt Werkzeuge nach und ist selbst keines. Lädt ein
 * Werkzeug ein anderes nach (Knopf „In der PDF-Werkstatt weiterbearbeiten“), zählen dessen
 * Pakete bei dem anderen Werkzeug: Der Weg endet am Seitencode eines anderen Werkzeugs.
 */
export function packagesByTool(
  chunks: readonly BundleChunk[],
  filePackages: ReadonlyMap<string, ReadonlySet<string>>,
  toolIds: ReadonlySet<string>,
): Map<string, Set<string>> {
  const byName = new Map(chunks.map((c) => [c.fileName, c]));
  const result = new Map<string, Set<string>>();
  for (const chunk of chunks) {
    const tool = chunk.moduleIds
      .map((id) => TOOL_PAGE.exec(id)?.[1])
      .find((id) => id !== undefined && toolIds.has(id));
    if (!tool) continue;
    const packages = result.get(tool) ?? new Set<string>();
    const seen = new Set<string>();
    const stack = [chunk.fileName];
    while (stack.length > 0) {
      const name = stack.pop() ?? '';
      if (seen.has(name)) continue;
      seen.add(name);
      const c = byName.get(name);
      if (!c) continue;
      const other = c.moduleIds
        .map((id) => TOOL_PAGE.exec(id)?.[1])
        .some((id) => id !== undefined && id !== tool && toolIds.has(id));
      if (other) continue;
      for (const id of c.moduleIds) {
        const pkg = packageFromModuleId(id);
        if (pkg) packages.add(pkg);
      }
      for (const [file, pkgs] of filePackages) {
        if (!byName.has(file) && c.code.includes(file.split('/').pop() ?? file)) {
          for (const pkg of pkgs) packages.add(pkg);
        }
      }
      stack.push(...c.imports, ...c.dynamicImports);
    }
    result.set(tool, packages);
  }
  return result;
}

/** Nur im Haupt-Build: ordnet die Pakete den Werkzeugen zu (für die Lizenzseite). */
export function recordToolPackages(toolIds: ReadonlySet<string>): Plugin {
  return {
    name: 'lokalwerk-record-tool-packages',
    apply: 'build',
    generateBundle(_options, bundle) {
      const chunks: BundleChunk[] = [];
      for (const o of Object.values(bundle)) {
        if (o.type === 'chunk') chunks.push(o);
      }
      toolsByPackage = new Map();
      for (const [tool, packages] of packagesByTool(chunks, packagesByFile, toolIds)) {
        for (const pkg of packages) {
          toolsByPackage.set(pkg, (toolsByPackage.get(pkg) ?? new Set()).add(tool));
        }
      }
    },
  };
}

/**
 * Schreibt am Ende des Builds die Zuordnung Datei → Pakete als JSON, z. B.
 * { "assets/sheet.worker-AbC.js": ["xlsx"] }. Wird von scripts/check-dist.mjs gelesen.
 */
export function writeShippedManifest(file: string): Plugin {
  return {
    name: 'lokalwerk-write-shipped-manifest',
    apply: 'build',
    closeBundle() {
      const manifest = Object.fromEntries(
        [...packagesByFile]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([f, p]) => [f, [...p].sort()]),
      );
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`);
    },
  };
}

export interface VerifyOptions {
  /** Paketnamen auf der Lizenzseite */
  listed: () => readonly string[];
  /** Je Paket die Dateien der Datenlizenzen auf der Lizenzseite (DataLicense.file) */
  dataLicenses?: () => Record<string, readonly string[]>;
  /**
   * Werkzeuge je direkter Abhängigkeit, wie auf der Lizenzseite genannt (build/licenses.ts).
   * Muss mit dem übereinstimmen, was der Build tatsächlich lädt.
   */
  usedIn?: Readonly<Record<string, readonly string[]>>;
  /** Je Paket verlangte Datenlizenzen, sobald das Paket ausgeliefert wird */
  requiredDataLicenses?: Record<string, ReadonlyArray<{ file: string; spdx: string }>>;
  /** Ordner der selbst gehosteten Schriften und Zuordnung Dateipräfix → Paket */
  fontsDir: string;
  fontPrefixes: Record<string, string>;
}

/**
 * Bricht den Build ab, wenn eine ausgelieferte Bibliothek oder Schrift nicht aufgeführt ist, eine
 * aufgeführte Bibliothek gar nicht ausgeliefert wird, die genannten Werkzeuge nicht stimmen oder
 * ein Paket aus NEVER_SHIPPED im Build steckt.
 */
export function verifyLicensesListed(options: VerifyOptions): Plugin {
  return {
    name: 'lokalwerk-verify-licenses',
    apply: 'build',
    closeBundle() {
      const listed = new Set(options.listed());
      const fonts = readdirSync(options.fontsDir)
        .filter((f) => f.endsWith('.woff2'))
        .map((file) => {
          const prefix = Object.keys(options.fontPrefixes).find((p) => file.startsWith(p));
          if (!prefix)
            throw new Error(
              `Lizenzen: Schrift ${file} ist keinem Paket zugeordnet (build/licenses.ts).`,
            );
          return options.fontPrefixes[prefix] ?? '';
        });
      const missing = [...new Set([...shipped, ...fonts])]
        .filter((name) => !listed.has(name))
        .sort();
      if (missing.length > 0) {
        throw new Error(`Lizenzen fehlen auf /lizenzen/ für: ${missing.join(', ')}`);
      }
      const forbidden = [...shipped].filter((name) => NEVER_SHIPPED.test(name)).sort();
      if (forbidden.length > 0) {
        throw new Error(`Diese Pakete dürfen nie ausgeliefert werden: ${forbidden.join(', ')}`);
      }
      const fontIds = new Set(Object.values(options.fontPrefixes));
      const notShipped = [...listed].filter((n) => !fontIds.has(n) && !shipped.has(n)).sort();
      if (notShipped.length > 0) {
        throw new Error(
          `Lizenzen: ${notShipped.join(', ')} steht auf /lizenzen/, wird aber nicht ausgeliefert.`,
        );
      }
      for (const [pkg, declared] of Object.entries(options.usedIn ?? {})) {
        const actual = [...(toolsByPackage.get(pkg) ?? [])].sort().join(', ');
        const expected = [...declared].sort().join(', ');
        if (actual !== expected) {
          throw new Error(
            `Lizenzen: ${pkg} wird laut Build von [${actual}] geladen, build/licenses.ts nennt [${expected}].`,
          );
        }
      }
      const listedData = options.dataLicenses?.() ?? {};
      for (const [pkg, required] of Object.entries(options.requiredDataLicenses ?? {})) {
        if (!shipped.has(pkg)) continue;
        for (const { file, spdx } of required) {
          if (!(listedData[pkg] ?? []).includes(file)) {
            throw new Error(
              `Lizenzen: ${pkg} wird ausgeliefert, aber die Datenlizenz ${spdx} (${file}) fehlt auf /lizenzen/.`,
            );
          }
        }
      }
      console.log(
        `Lizenzen: ${shipped.size} ausgelieferte Bibliotheken und ${new Set(fonts).size} Schrift(en) aufgeführt.`,
      );
    },
  };
}
