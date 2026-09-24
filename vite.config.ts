import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { parseGlobalHeaders } from './build/headers.ts';
import { htmlPartials } from './build/html-partials.ts';
import {
  collectLicenses,
  FONT_FILE_PREFIXES,
  renderLicenses,
  REQUIRED_DATA_LICENSES,
} from './build/licenses.ts';
import { PAGES, SITE_URL } from './build/pages.ts';
import { recordShippedPackages, verifyLicensesListed } from './build/shipped-packages.ts';

const path = (p: string): string => fileURLToPath(new URL(p, import.meta.url));

const pagesDir = path('./pages');
const srcDir = path('./src');
const securityHeaders = parseGlobalHeaders(readFileSync(path('./public/_headers'), 'utf8'));
const licenses = () => collectLicenses(path('.'));

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
      blocks: { licenses: () => renderLicenses(licenses()) },
    }),
    recordShippedPackages(),
    verifyLicensesListed({
      listed: () => licenses().map((l) => l.id),
      dataLicenses: () =>
        Object.fromEntries(licenses().map((l) => [l.id, l.dataLicenses.map((d) => d.spdx)])),
      requiredDataLicenses: REQUIRED_DATA_LICENSES,
      fontsDir: path('./public/fonts'),
      fontPrefixes: FONT_FILE_PREFIXES,
    }),
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
