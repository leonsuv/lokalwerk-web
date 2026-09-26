import { describe, expect, it } from 'vitest';
import { EEA_IBAN_LENGTHS, NON_EEA_SEPA_COUNTRIES } from '../../../src/core/sepa/iban-countries.ts';
import { formatIban, normalizeIban, validateIban } from '../../../src/core/sepa/iban.ts';

/** Prüfziffer nach ISO 13616 berechnen, um für jedes Land eine gültige Test-IBAN zu bauen. */
function withCheckDigits(country: string, bban: string): string {
  const digits = [...`${bban}${country}00`].map((c) => Number.parseInt(c, 36)).join('');
  let remainder = 0;
  for (const d of digits) remainder = (remainder * 10 + Number(d)) % 97;
  return `${country}${String(98 - remainder).padStart(2, '0')}${bban}`;
}

describe('validateIban mit Beispielen aus offiziellen Quellen', () => {
  // Anlage 3 26.11, Beispiele in Kap. 2.2.1 (S. 93, 105, 112)
  it.each([
    'DE87200500001234567890',
    'DE21500500009876543210',
    'DE21500500001234567897',
    'DE25370502991000122343',
  ])('akzeptiert %s aus Anlage 3', (iban) => {
    expect(validateIban(iban)).toEqual({ ok: true, iban, country: 'DE' });
  });
  // Gültige Beispiele je Land aus der SWIFT IBAN Registry folgen, sobald sie vorliegt (plan.md O4).
});

describe('eigene Beispiel-IBANs mit nicht vergebener Bankleitzahl (docs/beispiel-ibans.md)', () => {
  it.each([
    'DE89 1234 5678 1049 6387 12',
    'DE69 2345 6789 1234 5678 00',
    'DE50 3456 7890 0123 4567 89',
    'DE15 8765 4321 0000 2020 51',
  ])('%s hat eine gültige Prüfziffer', (iban) => {
    expect(validateIban(iban)).toEqual({ ok: true, iban: iban.replace(/ /g, ''), country: 'DE' });
  });
});

describe('validateIban', () => {
  it('normalisiert Leerzeichen, geschützte Leerzeichen und Kleinbuchstaben', () => {
    const nbsp = String.fromCodePoint(0xa0);
    expect(validateIban(` de89 3704${nbsp}0044 0532 0130 00 `)).toEqual({
      ok: true,
      iban: 'DE89370400440532013000',
      country: 'DE',
    });
  });

  it('erkennt eine falsche Prüfziffer (Tippfehler)', () => {
    expect(validateIban('DE89370400440532013001')).toMatchObject({ ok: false, code: 'checksum' });
    expect(validateIban('DE69234567891234567801')).toMatchObject({ ok: false, code: 'checksum' });
  });

  it('erkennt vertauschte Ziffern', () => {
    expect(validateIban('DE89370400440532031000')).toMatchObject({ ok: false, code: 'checksum' });
  });

  it('erkennt eine falsche Länge mit Soll und Ist', () => {
    expect(validateIban('DE8937040044053201300')).toEqual({
      ok: false,
      code: 'wrong-length',
      country: 'DE',
      expected: 22,
      actual: 21,
    });
  });

  it('meldet leere Eingaben', () => {
    expect(validateIban('')).toEqual({ ok: false, code: 'empty' });
    expect(validateIban('   ')).toEqual({ ok: false, code: 'empty' });
  });

  it.each(['DE89-3704-0044', 'D889370400440532013000', '1234567890', 'DE89370400440532013000!'])(
    'meldet ungültige Zeichen oder Aufbau: %s',
    (iban) => {
      expect(validateIban(iban)).toMatchObject({ ok: false, code: 'invalid-characters' });
    },
  );

  it('meldet Länder außerhalb des SEPA-Raums', () => {
    expect(validateIban('US12345678901234567890')).toEqual({
      ok: false,
      code: 'not-sepa',
      country: 'US',
    });
  });

  it.each([...NON_EEA_SEPA_COUNTRIES])(
    'schließt %s aus (außerhalb des EWR, plan.md S4/O5)',
    (country) => {
      expect(validateIban(withCheckDigits(country, '12345678901234'))).toEqual({
        ok: false,
        code: 'non-eea',
        country,
      });
    },
  );

  it('schließt Gibraltar aus (plan.md O5)', () => {
    expect(NON_EEA_SEPA_COUNTRIES.has('GI')).toBe(true);
  });

  it('prüft die Prüfziffer für jedes unterstützte Land', () => {
    for (const [country, length] of Object.entries(EEA_IBAN_LENGTHS)) {
      const iban = withCheckDigits(country, '1'.repeat(length - 4));
      expect(validateIban(iban), iban).toMatchObject({ ok: true, country });
      const broken = iban.slice(0, -1) + (iban.endsWith('1') ? '2' : '1');
      expect(validateIban(broken), broken).toMatchObject({ ok: false, code: 'checksum' });
    }
  });
});

describe('Länderliste (EPC409-09 v8.0)', () => {
  it('enthält die 30 EU/EWR-Länder', () => {
    expect(Object.keys(EEA_IBAN_LENGTHS).sort()).toEqual(
      'AT BE BG CY CZ DE DK EE ES FI FR GR HR HU IE IS IT LI LT LU LV MT NL NO PL PT RO SE SI SK'.split(
        ' ',
      ),
    );
  });

  it('enthält die 11 Nicht-EWR-Länder und Gibraltar', () => {
    expect([...NON_EEA_SEPA_COUNTRIES].sort()).toEqual(
      'AD AL CH GB GI MC MD ME MK RS SM VA'.split(' '),
    );
  });

  it('hat keine Überschneidung zwischen EWR und Nicht-EWR', () => {
    for (const country of NON_EEA_SEPA_COUNTRIES) expect(EEA_IBAN_LENGTHS[country]).toBeUndefined();
  });
});

describe('Hilfsfunktionen', () => {
  it('normalizeIban', () => {
    expect(normalizeIban('de89 3704 0044')).toBe('DE8937040044');
  });

  it('formatIban in Vierergruppen', () => {
    expect(formatIban('DE89370400440532013000')).toBe('DE89 3704 0044 0532 0130 00');
  });
});
