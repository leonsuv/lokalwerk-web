import { describe, expect, it } from 'vitest';
import { checkIbanValue, summarize } from '../../../src/core/sepa/iban-list.ts';

describe('checkIbanValue', () => {
  it('gültige IBAN, formatiert, Bankdaten über die Nachschlage-Funktion', () => {
    expect(checkIbanValue('de89 3704 0044 0532 0130 00')).toEqual({
      status: 'ok',
      iban: 'DE89370400440532013000',
      formatted: 'DE89 3704 0044 0532 0130 00',
      country: 'DE',
      bank: null,
    });
    const lookup = () => ({ name: 'Testbank', bic: 'TESTDEFFXXX' });
    expect(checkIbanValue('DE89370400440532013000', lookup)).toMatchObject({
      bank: { name: 'Testbank', bic: 'TESTDEFFXXX' },
    });
  });

  it('meldet Prüfziffer, Länge, Zeichen, Land und leere Zellen', () => {
    expect(checkIbanValue('DE89370400440532013001')).toMatchObject({
      status: 'error',
      code: 'checksum',
    });
    expect(checkIbanValue('DE8937040044053201300')).toMatchObject({
      status: 'error',
      code: 'wrong-length',
      expected: 22,
      actual: 21,
    });
    expect(checkIbanValue('DE89-3704')).toMatchObject({
      status: 'error',
      code: 'invalid-characters',
    });
    expect(checkIbanValue('US12345678901234')).toMatchObject({ status: 'error', code: 'not-sepa' });
    expect(checkIbanValue('  ')).toEqual({ status: 'empty' });
  });

  it('SEPA außerhalb des EWR: nur die Prüfziffer (Länge ungeprüft, plan.md O4)', () => {
    // Beispiel-IBAN der Schweiz mit gültiger Prüfziffer, selbst berechnet
    const ch = 'CH9300762011623852957';
    expect(checkIbanValue(ch)).toMatchObject({
      status: 'non-eea',
      country: 'CH',
      checksumOk: true,
    });
    expect(checkIbanValue('CH9400762011623852957')).toMatchObject({ checksumOk: false });
  });
});

describe('summarize', () => {
  it('zählt und findet doppelte IBANs', () => {
    const s = summarize(
      ['DE89370400440532013000', 'x', '', 'de89 3704 0044 0532 0130 00'].map((v) =>
        checkIbanValue(v),
      ),
    );
    expect([s.ok, s.errors, s.empty, s.nonEea]).toEqual([2, 1, 1, 0]);
    expect(s.repeated.get('DE89370400440532013000')).toEqual([0, 3]);
  });
});
