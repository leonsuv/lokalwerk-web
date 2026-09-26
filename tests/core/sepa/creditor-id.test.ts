import { describe, expect, it } from 'vitest';
import { creditorCheckDigits, validateCreditorId } from '../../../src/core/sepa/creditor-id.ts';

describe('Gläubiger-ID (EPC262-08 v12.0)', () => {
  it('rechnet das Beispiel aus Kap. 8.1.15 (Malta) nach', () => {
    // „Calculating the Check Digits for MTXXZZZ[EPC-Beispiel entfernt]“ … „MT50ZZZ[EPC-Beispiel entfernt]“
    expect(creditorCheckDigits('MT', '[EPC-Beispiel entfernt]')).toBe('50');
    expect(validateCreditorId('MT50ZZZ[EPC-Beispiel entfernt]')).toMatchObject({
      ok: true,
      country: 'MT',
      checkDigits: '50',
      businessCode: 'ZZZ',
      national: '[EPC-Beispiel entfernt]',
    });
  });

  it('übergeht die Geschäftsbereichskennung bei der Prüfziffer (Kap. 4)', () => {
    const digits = creditorCheckDigits('DE', '01234567890');
    const id = `DE${digits}ZZZ01234567890`;
    expect(validateCreditorId(id).ok).toBe(true);
    expect(validateCreditorId(`DE${digits}X7Y01234567890`)).toMatchObject({
      ok: true,
      businessCode: 'X7Y',
    });
  });

  it('nimmt Leerzeichen und Kleinschreibung hin', () => {
    const digits = creditorCheckDigits('DE', '01234567890');
    expect(validateCreditorId(` de${digits} zzz 0123 4567 890 `).ok).toBe(true);
  });

  it('meldet Tippfehler, falsche Länge und falschen Aufbau', () => {
    const digits = creditorCheckDigits('DE', '01234567890');
    expect(validateCreditorId(`DE${digits}ZZZ01234567891`)).toMatchObject({ code: 'checksum' });
    expect(validateCreditorId(`DE${digits}ZZZ0123456789`)).toMatchObject({
      code: 'length-de',
      actual: 17,
    });
    expect(validateCreditorId(`DE${digits}ZZZ0123456789A`)).toMatchObject({ code: 'national-de' });
    expect(validateCreditorId('DEXXZZZ01234567890')).toMatchObject({ code: 'format' });
    expect(validateCreditorId('US12ZZZ0123')).toMatchObject({ code: 'not-sepa', country: 'US' });
    expect(validateCreditorId('   ')).toMatchObject({ code: 'empty' });
  });
});
