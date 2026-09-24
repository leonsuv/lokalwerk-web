/**
 * Prüft erzeugte pain.001-Dateien gegen das DK-Schema (TVS GBIC_5) mit xmllint und gleicht
 * den Aufbau mit der offiziellen DK-Beispieldatei ab. Beide Dateien dürfen nicht ins Repo
 * (Nutzungsbedingungen ebics.de) und liegen lokal in .local-specs/dk/
 * (docs/lokale-spezifikationen.md). Fehlen sie, wird der Test mit Hinweis übersprungen.
 *
 * Das Schema allein reicht nicht (z. B. erlaubt es DtTm statt Dt); die Textregeln aus
 * Anlage 3 prüft pain001.test.ts.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildPain001 } from '../../../src/core/sepa/pain001.ts';
import { DK_EXAMPLE as EXAMPLE, DK_XSD as XSD, missingForXsdCheck } from '../../local-specs.ts';
import { input, scenarios, tx } from './pain001-input.ts';

// Hinweis bei fehlenden Dateien gibt tests/global-setup.ts aus.
const available = missingForXsdCheck().length === 0;

function validate(xml: string): string {
  try {
    execFileSync('xmllint', ['--noout', '--schema', XSD, '-'], { input: xml, stdio: 'pipe' });
    return 'gültig';
  } catch (error) {
    const stderr = (error as { stderr?: Buffer }).stderr?.toString() ?? String(error);
    return stderr.trim();
  }
}

/** Reihenfolge der Elementnamen, ohne Adress-Elemente (die senden wir nicht). */
function elementOrder(xml: string): string[] {
  const address = new Set(['PstlAdr', 'StrtNm', 'BldgNb', 'PstCd', 'TwnNm', 'Ctry', 'AdrLine']);
  return [...xml.matchAll(/<([A-Za-z]+)[\s>]/g)]
    .map((m) => m[1] ?? '')
    .filter((n) => !address.has(n));
}

describe.skipIf(!available)('pain.001 gegen DK-Schema pain.001.001.09_GBIC_5 (xmllint)', () => {
  it('die offizielle DK-Beispieldatei ist gültig (Werkzeug funktioniert)', () => {
    expect(validate(readFileSync(EXAMPLE, 'utf8'))).toBe('gültig');
  });

  it.each(Object.entries(scenarios))('%s', (_name, data) => {
    expect(validate(buildPain001(data))).toBe('gültig');
  });

  it('das Schema lehnt eine absichtlich falsche Datei ab (Test kann scheitern)', () => {
    const broken = buildPain001(input()).replace('<Othr><Id>NOTPROVIDED</Id></Othr>', '');
    expect(validate(broken)).toMatch(/Missing child element|fails to validate/);
  });

  it('Aufbau entspricht der DK-Beispieldatei (ohne Adressangaben)', () => {
    const ours = buildPain001(
      input({
        debtor: { name: 'Debtor Name', iban: 'DE87200500001234567890', bic: 'BANKDEFFXXX' },
        transactions: [
          tx({ endToEndId: 'E1', bic: 'SPUEDE2UXXX', purpose: 'Zweck 1' }),
          tx({ endToEndId: 'E2', bic: 'SPUEDE2UXXX', purpose: 'Zweck 2' }),
        ],
      }),
    );
    expect(elementOrder(ours)).toEqual(elementOrder(readFileSync(EXAMPLE, 'utf8')));
  });
});
