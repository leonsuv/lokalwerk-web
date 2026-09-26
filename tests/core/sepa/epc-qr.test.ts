import { describe, expect, it } from 'vitest';
import { qrMatrix, QrTooLongError } from '../../../src/core/qr/encode.ts';
import {
  EPC_MAX_VERSION,
  epcAmount,
  epcBytes,
  epcPayload,
  type EpcFields,
} from '../../../src/core/sepa/epc-qr.ts';
import { epcExamples } from '../../local-specs.ts';

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

// Die Beispiele aus EPC069-12 Kap. 2.3 liegen lokal (.local-specs/epc/, Nutzung des EPC nur
// nicht-kommerziell); ohne die Datei wird dieser Block übersprungen (Hinweis: tests/global-setup.ts).
const official = epcExamples();

describe.skipIf(!official)('EPC069-12 v3.1, Beispiele aus Kap. 2.3 (lokal)', () => {
  for (const [i, example] of (official?.epc069_12.beispiele ?? []).entries()) {
    it(`Beispiel ${i + 1}: Zeichen, Bytes und QR-Version wie im Dokument`, () => {
      const fields: EpcFields = {
        ...example.fields,
        charset: example.fields.charset === 2 ? 2 : 1,
      };
      const payload = epcPayload(fields);
      expect(payload).toBe(example.payload);
      expect([...payload]).toHaveLength(example.zeichen);
      const bytes = epcBytes(payload, fields.charset);
      expect(bytes).toHaveLength(example.bytes);
      expect(qrMatrix(bytes, { ecc: 'M', maxVersion: EPC_MAX_VERSION }).version).toBe(
        example.qrVersion,
      );
    });
  }
});

describe('eigene Beispiele nach dem Aufbau aus EPC069-12 Kap. 2.2', () => {
  it('Version 001 mit BIC, UTF-8, Umlaut zählt zwei Byte', () => {
    const payload = epcPayload({
      ...empty,
      version: '001',
      charset: 1,
      bic: 'BANKDEFFXXX',
      name: 'Musterverein Grünwald e. V.',
      iban: 'DE69234567891234567800',
      amountCents: 4250,
      purposeCode: 'CHAR',
      text: 'Mitgliedsbeitrag 2026',
    });
    expect(payload).toBe(
      'BCD\n001\n1\nSCT\nBANKDEFFXXX\nMusterverein Grünwald e. V.\nDE69234567891234567800\nEUR42.5\nCHAR\n\nMitgliedsbeitrag 2026',
    );
    expect(epcBytes(payload, 1)).toHaveLength([...payload].length + 1);
  });

  it('Version 002 ohne BIC, ISO 8859-1, ein Byte je Zeichen', () => {
    const payload = epcPayload({
      ...empty,
      version: '002',
      charset: 2,
      name: 'Café Élise GmbH',
      iban: 'DE50345678900123456789',
      amountCents: 999,
      text: 'Bestellung 4711',
    });
    expect(payload).toBe(
      'BCD\n002\n2\nSCT\n\nCafé Élise GmbH\nDE50345678900123456789\nEUR9.99\n\n\nBestellung 4711',
    );
    expect(epcBytes(payload, 2)).toHaveLength([...payload].length);
    expect(
      qrMatrix(epcBytes(payload, 2), { ecc: 'M', maxVersion: EPC_MAX_VERSION }).version,
    ).toBeLessThanOrEqual(EPC_MAX_VERSION);
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
