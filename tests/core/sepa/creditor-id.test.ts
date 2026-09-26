import { describe, expect, it } from 'vitest';
import { creditorCheckDigits, validateCreditorId } from '../../../src/core/sepa/creditor-id.ts';
import { epcExamples } from '../../local-specs.ts';

// Das Beispiel aus EPC262-08 Kap. 8.1.15 liegt lokal (.local-specs/epc/, Nutzung des EPC nur
// nicht-kommerziell); ohne die Datei wird dieser Block übersprungen (Hinweis: tests/global-setup.ts).
const official = epcExamples()?.epc262_08;

describe.skipIf(!official)('Gläubiger-ID, Beispiel aus EPC262-08 Kap. 8.1.15 (lokal)', () => {
  it('rechnet die Prüfziffer nach', () => {
    if (!official) return;
    expect(creditorCheckDigits(official.land, official.national)).toBe(official.pruefziffer);
    expect(validateCreditorId(official.id)).toMatchObject({
      ok: true,
      country: official.land,
      checkDigits: official.pruefziffer,
      national: official.national,
    });
  });
});

describe('Gläubiger-ID (EPC262-08 v12.0)', () => {
  it('eigene Beispiele, unabhängig nachgerechnet (ISO 7064 Mod 97-10)', () => {
    // Nachgerechnet mit einer eigenen Umsetzung außerhalb des Projekts (26.09.2026)
    expect(creditorCheckDigits('DE', '01234567890')).toBe('79');
    expect(creditorCheckDigits('DE', '00000123456')).toBe('32');
    expect(validateCreditorId('DE79ZZZ01234567890')).toMatchObject({
      ok: true,
      country: 'DE',
      checkDigits: '79',
      businessCode: 'ZZZ',
      national: '01234567890',
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
