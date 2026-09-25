/**
 * Ort der Zuordnung „Datei im Build → enthaltene Pakete“ (build/shipped-packages.ts).
 * Außerhalb von dist/, damit sie nicht ausgeliefert wird.
 */

import { fileURLToPath } from 'node:url';

export const SHIPPED_MANIFEST = fileURLToPath(
  new URL('../node_modules/.cache/lokalwerk/shipped-files.json', import.meta.url),
);
