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

/** Nur für Tests: ausgelieferte Pakete setzen. */
export function setShippedForTest(names: readonly string[]): void {
  shipped.clear();
  for (const name of names) shipped.add(name);
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
  /** Je Paket die SPDX-Kennungen der Datenlizenzen auf der Lizenzseite */
  dataLicenses?: () => Record<string, readonly string[]>;
  /** Je Paket verlangte Datenlizenzen, sobald das Paket ausgeliefert wird */
  requiredDataLicenses?: Record<string, { spdx: string }>;
  /** Ordner der selbst gehosteten Schriften und Zuordnung Dateipräfix → Paket */
  fontsDir: string;
  fontPrefixes: Record<string, string>;
}

/** Bricht den Build ab, wenn eine ausgelieferte Bibliothek oder Schrift nicht aufgeführt ist. */
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
      const listedData = options.dataLicenses?.() ?? {};
      for (const [pkg, { spdx }] of Object.entries(options.requiredDataLicenses ?? {})) {
        if (shipped.has(pkg) && !(listedData[pkg] ?? []).includes(spdx)) {
          throw new Error(
            `Lizenzen: ${pkg} wird ausgeliefert, aber die Datenlizenz ${spdx} fehlt auf /lizenzen/.`,
          );
        }
      }
      console.log(
        `Lizenzen: ${shipped.size} ausgelieferte Bibliotheken und ${new Set(fonts).size} Schrift(en) aufgeführt.`,
      );
    },
  };
}
