import { describe, expect, it } from 'vitest';
import { validateBic } from '../../../src/core/sepa/bic.ts';

describe('validateBic (Anlage 3 26.11, Kap. 2.3.1.1, S. 253)', () => {
  it.each(['COBADEFFXXX', 'COBADEFF', 'BANKDEFFXXX', 'SPUEDE2UXXX', 'GENODEM1GLS'])(
    'akzeptiert %s',
    (bic) => {
      expect(validateBic(bic)).toEqual({ ok: true, bic });
    },
  );

  it('normalisiert Leerzeichen und Kleinbuchstaben', () => {
    expect(validateBic(' coba de ff ')).toEqual({ ok: true, bic: 'COBADEFF' });
  });

  it('erlaubt Ziffern im Institutsteil (BICFIDec2014)', () => {
    expect(validateBic('1234DEFF')).toMatchObject({ ok: true });
  });

  it.each(['', 'COBADEF', 'COBADEFFXX', 'COBADEFFXXXX', 'COBA1EFF', 'COBADE-F'])(
    'lehnt %j ab',
    (bic) => {
      expect(validateBic(bic)).toEqual({ ok: false, code: 'invalid-format' });
    },
  );
});
