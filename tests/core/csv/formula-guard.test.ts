import { describe, expect, it } from 'vitest';
import { guardFormulas, isFormulaStart } from '../../../src/core/csv/formula-guard.ts';

describe('isFormulaStart', () => {
  it.each(['=SUMME(A1)', '+49 170 1234567', '@SUM(1)', '\tx', '\rx', '-1+1', '-cmd|x', '--'])(
    'erkennt %j als Formelanfang',
    (v) => expect(isFormulaStart(v)).toBe(true),
  );

  it.each(['', 'Text', '12,50', '-5', '-12,50', '-1.234,56', ' =x', 'a=b', '0=1'])(
    'lässt %j in Ruhe',
    (v) => expect(isFormulaStart(v)).toBe(false),
  );
});

describe('guardFormulas', () => {
  it('setzt ein Apostroph vor Formelzellen und zählt sie', () => {
    const { rows, count } = guardFormulas([
      ['Name', 'Betrag'],
      ['=HYPERLINK("x")', '-5'],
      ['+49 30 1', 'ok'],
    ]);
    expect(rows).toEqual([
      ['Name', 'Betrag'],
      ['\'=HYPERLINK("x")', '-5'],
      ["'+49 30 1", 'ok'],
    ]);
    expect(count).toBe(2);
  });

  it('verändert die Eingabe nicht und meldet 0 bei sauberen Daten', () => {
    const input = [['a', 'b']];
    const { rows, count } = guardFormulas(input);
    expect(count).toBe(0);
    expect(rows).toEqual(input);
    expect(rows).not.toBe(input);
  });
});
