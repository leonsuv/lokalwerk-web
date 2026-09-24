/** Läuft einmal vor allen Tests im Hauptprozess und meldet übersprungene Prüfungen deutlich. */

import { missingForXsdCheck } from './local-specs.ts';

export default function setup(): void {
  const missing = missingForXsdCheck();
  if (missing.length === 0) return;
  const line = '#'.repeat(80);
  process.stderr.write(
    [
      '',
      line,
      '##  ACHTUNG: XSD-PRÜFUNG VON pain.001 WIRD ÜBERSPRUNGEN',
      `##  Es fehlt: ${missing.join(', ')}`,
      '##  Anleitung: docs/lokale-spezifikationen.md',
      line,
      '',
      '',
    ].join('\n'),
  );
}
