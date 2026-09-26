import { describe, expect, it } from 'vitest';
import { qrMatrix, QrTooLongError } from '../../../src/core/qr/encode.ts';
import {
  EPC_MAX_VERSION,
  epcAmount,
  epcBytes,
  epcPayload,
  type EpcFields,
} from '../../../src/core/sepa/epc-qr.ts';

const empty: EpcFields = {
  version: '002',
  charset: 1,
  bic: '',
  name: '',
  iban: '',
  amountCents: null,
  purposeCode: '',
  reference: '',
  text: '',
  info: '',
};

describe('EPC069-12 v3.1, Beispiele aus Kap. 2.3', () => {
  it('V1: 95 Zeichen, 96 Byte UTF-8, QR-Version 6', () => {
    const payload = epcPayload({
      ...empty,
      version: '001',
      charset: 1,
      bic: '[EPC-Beispiel entfernt]',
      name: '[EPC-Beispiel entfernt]',
      iban: '[EPC-Beispiel entfernt]',
      amountCents: 1230,
      purposeCode: 'GDDS',
      reference: '[EPC-Beispiel entfernt]',
    });
    expect(payload).toBe(
      'BCD\n001\n1\nSCT\n[EPC-Beispiel entfernt]\n[EPC-Beispiel entfernt]\n[EPC-Beispiel entfernt]\nEUR12.3\nGDDS\n[EPC-Beispiel entfernt]',
    );
    expect([...payload]).toHaveLength(95);
    expect(epcBytes(payload, 1)).toHaveLength(96);
    expect(qrMatrix(epcBytes(payload, 1), { ecc: 'M', maxVersion: EPC_MAX_VERSION })).toMatchObject(
      {
        version: 6,
        size: 41,
      },
    );
  });

  it('V2: ohne BIC, 103 Zeichen, 103 Byte ISO 8859-1, QR-Version 6', () => {
    const payload = epcPayload({
      ...empty,
      version: '002',
      charset: 2,
      name: "[EPC-Beispiel entfernt]",
      iban: '[EPC-Beispiel entfernt]',
      amountCents: 1230,
      text: '[EPC-Beispiel entfernt]',
    });
    expect(payload).toBe(
      "BCD\n002\n2\nSCT\n\n[EPC-Beispiel entfernt]\n[EPC-Beispiel entfernt]\nEUR12.3\n\n\n[EPC-Beispiel entfernt]",
    );
    expect([...payload]).toHaveLength(103);
    expect(epcBytes(payload, 2)).toHaveLength(103);
    expect(qrMatrix(epcBytes(payload, 2), { ecc: 'M', maxVersion: EPC_MAX_VERSION })).toMatchObject(
      {
        version: 6,
        size: 41,
      },
    );
  });
});

describe('epcPayload', () => {
  it('lässt leere Elemente am Ende weg (Kap. 2.2)', () => {
    expect(epcPayload({ ...empty, name: 'Verein', iban: 'DE89370400440532013000' })).toBe(
      'BCD\n002\n1\nSCT\n\nVerein\nDE89370400440532013000',
    );
  });

  it('schreibt Beträge wie die Beispiele, innerhalb von 0,01 bis 999.999.999,99', () => {
    expect(epcAmount(1)).toBe('EUR0.01');
    expect(epcAmount(1000)).toBe('EUR10.0');
    expect(epcAmount(1235)).toBe('EUR12.35');
    expect(epcAmount(99_999_999_999)).toBe('EUR999999999.99');
    expect(() => epcAmount(0)).toThrow(RangeError);
    expect(() => epcAmount(100_000_000_000)).toThrow(RangeError);
  });

  it('wirft, wenn der Code über Version 13 hinausginge', () => {
    const long = Array.from({ length: 500 }, () => 65);
    expect(() => qrMatrix(long, { ecc: 'M', maxVersion: EPC_MAX_VERSION })).toThrow(QrTooLongError);
  });
});
