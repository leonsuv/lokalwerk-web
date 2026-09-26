/** Läuft einmal vor allen Tests im Hauptprozess und meldet übersprungene Prüfungen deutlich. */

import { missingForEpcExamples, missingForXsdCheck } from './local-specs.ts';

function warn(title: string, missing: string[]): void {
  if (missing.length === 0) return;
  const line = '#'.repeat(80);
  process.stderr.write(
    [
      '',
      line,
      `##  ACHTUNG: ${title} WIRD ÜBERSPRUNGEN`,
      `##  Es fehlt: ${missing.join(', ')}`,
      '##  Anleitung: docs/lokale-spezifikationen.md',
      line,
      '',
      '',
    ].join('\n'),
  );
}

export default function setup(): void {
  warn('XSD-PRÜFUNG VON pain.001', missingForXsdCheck());
  warn('PRÜFUNG MIT DEN BEISPIELEN AUS EPC069-12 UND EPC262-08', missingForEpcExamples());
}
