import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { parseGlobalHeaders } from './build/headers.ts';
import { chunkGuard } from './build/chunk-guard.ts';
import { htmlPartials } from './build/html-partials.ts';
import { pdfjsFallbacks } from './build/pdfjs.ts';
import {
  collectLicenses,
  FONT_FILE_PREFIXES,
  renderLicenses,
  REQUIRED_DATA_LICENSES,
  USED_IN,
} from './build/licenses.ts';
import { PAGES, SITE_URL, TOOL_PAGES } from './build/pages.ts';
import { checkRegistry, iconIds } from './build/registry.ts';
import {
  recordShippedPackages,
  recordToolPackages,
  verifyLicensesListed,
  writeShippedManifest,
} from './build/shipped-packages.ts';
import {
  renderCategoryLinks,
  renderHomeTools,
  renderRelated,
  renderToolOverview,
} from './build/tool-blocks.ts';
import { SHIPPED_MANIFEST } from './scripts/shipped-manifest.mjs';

const path = (p: string): string => fileURLToPath(new URL(p, import.meta.url));

const pagesDir = path('./pages');
const srcDir = path('./src');
const securityHeaders = parseGlobalHeaders(readFileSync(path('./public/_headers'), 'utf8'));
const licenses = () => collectLicenses(path('.'));

// Register vor jedem Start prüfen (plan-phase2.md Abschnitt 3.5).
const registryProblems = checkRegistry(
  PAGES,
  iconIds(readFileSync(path('./src/partials/icons.svg'), 'utf8')),
);
if (registryProblems.length > 0) {
  throw new Error(`Seitenregister build/pages.ts:\n  ${registryProblems.join('\n  ')}`);
}

export default defineConfig({
  root: pagesDir,
  publicDir: path('./public'),
  appType: 'mpa',
  plugins: [
    htmlPartials({
      pagesDir,
      srcDir,
      pages: PAGES,
      siteUrl: SITE_URL,
      blocks: {
        licenses: () => renderLicenses(licenses()),
        'home-tools': renderHomeTools,
        'tool-overview': renderToolOverview,
        'category-links': renderCategoryLinks,
        related: renderRelated,
      },
    }),
    recordShippedPackages(),
    recordToolPackages(new Set(TOOL_PAGES.map((p) => p.tool.id))),
    verifyLicensesListed({
      listed: () => licenses().map((l) => l.id),
      dataLicenses: () =>
        Object.fromEntries(licenses().map((l) => [l.id, l.dataLicenses.map((d) => d.spdx)])),
      usedIn: USED_IN,
      requiredDataLicenses: REQUIRED_DATA_LICENSES,
      fontsDir: path('./public/fonts'),
      fontPrefixes: FONT_FILE_PREFIXES,
    }),
    pdfjsFallbacks(),
    writeShippedManifest(SHIPPED_MANIFEST),
    chunkGuard(),
  ],
  worker: {
    format: 'es',
    // Auch Pakete in den Workern zählen für die Lizenzprüfung.
    plugins: () => [recordShippedPackages()],
  },
  resolve: {
    // Seiten verweisen mit /src/… auf Stile und Skripte, obwohl der Root `pages/` ist.
    alias: [{ find: /^\/src\//, replacement: `${srcDir}/` }],
  },
  build: {
    outDir: path('./dist'),
    emptyOutDir: true,
    // Der Polyfill enthält fetch(); alle unterstützten Browser können modulepreload selbst.
    modulePreload: { polyfill: false },
    rollupOptions: {
      input: Object.fromEntries(PAGES.map((p) => [p.file, `${pagesDir}/${p.file}`])),
    },
  },
  server: {
    fs: { allow: [path('.')] },
  },
  preview: {
    headers: securityHeaders,
  },
});
