import { describe, expect, it } from 'vitest';
import { guessColumns } from '../../../src/core/sepa/columns.ts';
import { checkDebtor, checkTransfers } from '../../../src/core/sepa/transfers.ts';
import { toTable, type Table } from '../../../src/core/sheet/table.ts';

function table(rows: unknown[][]): Table {
  const result = toTable(rows);
  if (!result.ok) throw new Error(result.code);
  return result.table;
}

// Beispieldaten aus dem Prototyp („Beispieldaten laden“); Zeile 5 hat absichtlich einen Tippfehler.
const sample = table([
  ['Empfänger', 'IBAN', 'Betrag', 'Verwendungszweck'],
  [
    'Sportverein Musterstadt e.V.',
    'DE89 3704 0044 0532 0130 00',
    '120,00',
    'Hallenmiete September',
  ],
  ['Anna Beispiel', 'DE50345678900123456789', '45,50', 'Auslagen Sommerfest'],
  ['Kiosk am Markt GmbH', 'DE89 1234 5678 1049 6387 12', '1.234,56', 'Rechnung 2026-117'],
  ['Tom Test', 'DE69234567891234567801', '30', 'Fahrtkosten'],
  ['Gärtnerei Grün', 'AT611904300234573201', '89,90', 'Rechnung 88'],
]);

describe('checkTransfers mit den Beispieldaten des Prototyps', () => {
  const result = checkTransfers(sample, guessColumns(sample.headers));

  it('schließt nur Zeile 5 (IBAN-Tippfehler) aus und nennt den Grund', () => {
    expect(result.excludedCount).toBe(1);
    const bad = result.rows.find((r) => r.errors.length > 0);
    expect(bad).toMatchObject({
      sourceRow: 5,
      errors: [{ code: 'iban', error: { code: 'checksum' } }],
    });
  });

  it('summiert nur gültige Zeilen in Cent', () => {
    expect(result.totalCents).toBe(12000 + 4550 + 123456 + 8990);
    expect(result.valid).toHaveLength(4);
  });

  it('normalisiert IBANs und behält Umlaute', () => {
    expect(result.valid[0]).toMatchObject({
      iban: 'DE89370400440532013000',
      name: 'Sportverein Musterstadt e.V.',
    });
    expect(result.valid[3]).toMatchObject({ name: 'Gärtnerei Grün', iban: 'AT611904300234573201' });
  });

  it('meldet keinen Einzelfall-Hinweis bei mehreren Überweisungen', () => {
    expect(result.singleTransfer).toBe(false);
  });
});

describe('checkTransfers: Fehler werden markiert, nie still korrigiert', () => {
  const headers = ['Name', 'IBAN', 'Betrag', 'Zweck', 'BIC'];
  const check = (row: unknown[]) => {
    const t = table([headers, row]);
    return checkTransfers(t, guessColumns(t.headers)).rows[0];
  };

  it('leerer Name', () => {
    expect(check(['  ', 'DE89370400440532013000', '5', '', ''])?.errors).toEqual([
      { code: 'name-empty' },
    ]);
  });

  it('Betrag nicht eindeutig', () => {
    expect(check(['A', 'DE89370400440532013000', '1,234', '', ''])?.errors).toEqual([
      { code: 'amount', error: 'ambiguous' },
    ]);
  });

  it('Betrag als Excel-Zahl', () => {
    expect(check(['A', 'DE89370400440532013000', 45.5, '', ''])).toMatchObject({
      cents: 4550,
      errors: [],
    });
  });

  it('IBAN außerhalb des EWR', () => {
    expect(check(['A', 'CH9300762011623852957', '5', '', ''])?.errors).toEqual([
      { code: 'iban', error: { code: 'non-eea', country: 'CH' } },
    ]);
  });

  it('ungültige BIC', () => {
    expect(check(['A', 'DE89370400440532013000', '5', '', 'XYZ'])?.errors).toEqual([
      { code: 'bic-invalid' },
    ]);
  });

  it('gültige BIC wird normalisiert übernommen', () => {
    expect(check(['A', 'DE89370400440532013000', '5', '', 'coba deff xxx'])).toMatchObject({
      bic: 'COBADEFFXXX',
    });
  });

  it('mehrere Fehler in einer Zeile werden alle genannt', () => {
    expect(check(['', 'DE00', 'abc', '', ''])?.errors.map((e) => e.code)).toEqual([
      'name-empty',
      'iban',
      'amount',
    ]);
  });
});

describe('checkTransfers: Warnungen bei Umschreibung und Kürzung', () => {
  const t = table([
    ['Name', 'IBAN', 'Betrag', 'Zweck'],
    ['Café Łódź', 'DE89370400440532013000', '5', 'x'.repeat(150)],
  ]);
  const row = checkTransfers(t, guessColumns(t.headers)).rows[0];

  it('meldet jede Ersetzung im Namen', () => {
    expect(row?.warnings).toContainEqual({
      code: 'replaced',
      field: 'name',
      replacements: [
        { from: 'é', to: 'e' },
        { from: 'Ł', to: 'L' },
        { from: 'ó', to: 'o' },
        { from: 'ź', to: 'z' },
      ],
    });
    expect(row?.name).toBe('Cafe Lodz');
  });

  it('meldet die Kürzung des Verwendungszwecks auf 140 Zeichen', () => {
    expect(row?.warnings).toContainEqual({
      code: 'truncated',
      field: 'purpose',
      from: 150,
      to: 140,
    });
    expect(row?.errors).toEqual([]);
  });
});

describe('checkTransfers: Spalten und Sonderfälle', () => {
  it('ohne Pflichtspalten ist jede Zeile fehlerhaft', () => {
    const t = table([
      ['Name', 'Notiz'],
      ['A', 'x'],
    ]);
    expect(checkTransfers(t, guessColumns(t.headers)).rows[0]?.errors[0]).toEqual({
      code: 'missing-columns',
      fields: ['iban', 'amount'],
    });
  });

  it('meldet den Einzelfall, wenn nur eine Überweisung gültig ist (plan.md O9)', () => {
    const t = table([
      ['Name', 'IBAN', 'Betrag'],
      ['A', 'DE89370400440532013000', '5'],
      ['B', 'DE00', '5'],
    ]);
    expect(checkTransfers(t, guessColumns(t.headers)).singleTransfer).toBe(true);
  });

  it('ein Zweck nur aus Leerzeichen wird leer, ohne Fehler (Anlage 3 S. 84)', () => {
    const t = table([
      ['Name', 'IBAN', 'Betrag', 'Zweck'],
      ['A', 'DE89370400440532013000', '5', '   '],
    ]);
    expect(checkTransfers(t, guessColumns(t.headers)).rows[0]).toMatchObject({
      purpose: '',
      errors: [],
    });
  });
});

describe('checkDebtor (eigenes Konto)', () => {
  it('prüft Name, IBAN und optionale BIC', () => {
    expect(
      checkDebtor({
        name: 'Förderverein Beispiel e.V.',
        iban: 'DE69 2345 6789 1234 5678 00',
        bic: '',
      }),
    ).toEqual({
      name: 'Förderverein Beispiel e.V.',
      iban: 'DE69234567891234567800',
      bic: '',
      errors: [],
      warnings: [],
    });
  });

  it('nur EWR auch für das eigene Konto', () => {
    expect(checkDebtor({ name: 'A', iban: 'GB29NWBK60161331926819', bic: '' }).errors).toEqual([
      { code: 'iban', error: { code: 'non-eea', country: 'GB' } },
    ]);
  });

  it('meldet fehlenden Namen und ungültige BIC', () => {
    expect(checkDebtor({ name: '', iban: 'DE89370400440532013000', bic: 'X' }).errors).toEqual([
      { code: 'name-empty' },
      { code: 'bic-invalid' },
    ]);
  });
});
