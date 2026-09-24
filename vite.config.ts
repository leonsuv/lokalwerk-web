import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { parseGlobalHeaders } from './build/headers.ts';
import { htmlPartials } from './build/html-partials.ts';
import { PAGES, SITE_URL } from './build/pages.ts';

const path = (p: string): string => fileURLToPath(new URL(p, import.meta.url));

const pagesDir = path('./pages');
const srcDir = path('./src');
const securityHeaders = parseGlobalHeaders(readFileSync(path('./public/_headers'), 'utf8'));

export default defineConfig({
  root: pagesDir,
  publicDir: path('./public'),
  appType: 'mpa',
  plugins: [htmlPartials({ pagesDir, srcDir, pages: PAGES, siteUrl: SITE_URL })],
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
