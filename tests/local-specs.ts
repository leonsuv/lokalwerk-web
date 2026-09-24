/**
 * Lokale Spezifikationsdateien (.local-specs/, nicht im Repo; docs/lokale-spezifikationen.md).
 * Gemeinsam genutzt von den Tests und vom globalSetup, das einen Hinweis ausgibt, wenn
 * Dateien fehlen.
 */

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const DK_XSD = fileURLToPath(
  new URL('../.local-specs/dk/pain.001.001.09_GBIC_5.xsd', import.meta.url),
);
export const DK_EXAMPLE = fileURLToPath(
  new URL('../.local-specs/dk/pain.001.001.09.xml', import.meta.url),
);

function hasXmllint(): boolean {
  try {
    execFileSync('xmllint', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/** Was für die XSD-Prüfung von pain.001 fehlt; leer, wenn alles da ist. */
export function missingForXsdCheck(): string[] {
  return [
    ...(existsSync(DK_XSD) ? [] : ['.local-specs/dk/pain.001.001.09_GBIC_5.xsd']),
    ...(existsSync(DK_EXAMPLE) ? [] : ['.local-specs/dk/pain.001.001.09.xml']),
    ...(hasXmllint() ? [] : ['Programm xmllint']),
  ];
}
