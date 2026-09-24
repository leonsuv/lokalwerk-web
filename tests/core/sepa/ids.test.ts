import { describe, expect, it } from 'vitest';
import {
  createMessageId,
  endToEndId,
  isValidReference,
  paymentInformationId,
} from '../../../src/core/sepa/ids.ts';

describe('isValidReference (Anlage 3 26.11, S. 84 und S. 253)', () => {
  it.each([
    'LW20260924213000ABC123',
    'Rechnung 2026-117',
    "a+b?c/d-e:f(g)h.i,j'k l",
    'x'.repeat(35),
  ])('akzeptiert %j', (id) => {
    expect(isValidReference(id)).toBe(true);
  });

  it('lehnt mehr als 35 Zeichen ab (Max35Text)', () => {
    expect(isValidReference('x'.repeat(36))).toBe(false);
  });

  it('lehnt leere Kennungen ab', () => {
    expect(isValidReference('')).toBe(false);
  });

  it.each(['/abc', 'abc/', 'ab//c'])('lehnt %j ab (Schrägstrich-Regel, S. 84)', (id) => {
    expect(isValidReference(id)).toBe(false);
  });

  it.each(['ä', 'ß', '&', '*', '$', '%', '|', '_', '@'])(
    'lehnt %j ab (Kennungen nur im Grundzeichensatz)',
    (char) => {
      expect(isValidReference(`abc${char}def`)).toBe(false);
    },
  );
});

describe('createMessageId', () => {
  const now = new Date(2026, 8, 24, 21, 30, 5);

  it('baut LW + Ortszeit + 6 Zeichen aus Zufallsbytes', () => {
    expect(createMessageId(now, new Uint8Array([0, 1, 10, 35, 36, 71]))).toBe(
      'LW2026092421300501AZ0Z',
    );
  });

  it('ist gültig und höchstens 35 Zeichen lang', () => {
    const id = createMessageId(now, new Uint8Array([255, 254, 253, 252, 251, 250]));
    expect(id).toHaveLength(22);
    expect(isValidReference(id)).toBe(true);
  });

  it('unterscheidet sich bei anderem Zufall', () => {
    expect(createMessageId(now, new Uint8Array(6).fill(1))).not.toBe(
      createMessageId(now, new Uint8Array(6).fill(2)),
    );
  });

  it('verlangt genug Zufallsbytes', () => {
    expect(() => createMessageId(now, new Uint8Array(5))).toThrow(RangeError);
  });
});

describe('abgeleitete Kennungen', () => {
  const msgId = 'LW2026092421300501AZ0Z';

  it('PmtInfId', () => {
    expect(paymentInformationId(msgId)).toBe('LW2026092421300501AZ0Z-P1');
  });

  it('EndToEndId zählt ab 1 und bleibt bis 9.999.999 Überweisungen gültig (Anlage 3 S. 88)', () => {
    expect(endToEndId(msgId, 0)).toBe('LW2026092421300501AZ0Z-1');
    const last = endToEndId(msgId, 9_999_998);
    expect(last).toBe('LW2026092421300501AZ0Z-9999999');
    expect(isValidReference(last)).toBe(true);
  });
});
