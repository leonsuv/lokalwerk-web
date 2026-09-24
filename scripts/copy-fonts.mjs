/**
 * Kopiert die benötigten Onest-Schnitte (Latin-Subset, WOFF2) und die Lizenz aus
 * @fontsource/onest nach public/fonts/. Das Ergebnis wird committet; das Skript dient
 * nur dazu, die Dateien bei einem Versionswechsel nachvollziehbar neu zu erzeugen.
 */

import { copyFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const WEIGHTS = [400, 500, 600, 700, 800];
/** @param {string} p */
const from = (p) =>
  fileURLToPath(new URL(`../node_modules/@fontsource/onest/${p}`, import.meta.url));
/** @param {string} p */
const to = (p) => fileURLToPath(new URL(`../public/fonts/${p}`, import.meta.url));

mkdirSync(to(''), { recursive: true });
for (const w of WEIGHTS) {
  const name = `onest-latin-${w}-normal.woff2`;
  copyFileSync(from(`files/${name}`), to(name));
}
copyFileSync(from('LICENSE'), to('OFL.txt'));
console.log(`copy-fonts: ${WEIGHTS.length} Schnitte und OFL.txt nach public/fonts/ kopiert.`);
