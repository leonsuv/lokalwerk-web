/** Gemeinsame Testeingaben für pain.001 (Unit-Test und XSD-Test). */

import type { Pain001Input, Pain001Transaction } from '../../../src/core/sepa/pain001.ts';

export const tx = (over: Partial<Pain001Transaction> = {}): Pain001Transaction => ({
  endToEndId: 'LW2026092421300501AZ0Z-1',
  cents: 12000,
  name: 'Sportverein Musterstadt e.V.',
  iban: 'DE89370400440532013000',
  bic: '',
  purpose: 'Hallenmiete September',
  ...over,
});

export const input = (over: Partial<Pain001Input> = {}): Pain001Input => ({
  messageId: 'LW2026092421300501AZ0Z',
  paymentInformationId: 'LW2026092421300501AZ0Z-P1',
  createdAt: new Date(2026, 8, 24, 21, 30, 5),
  executionDate: '2026-09-25',
  debtor: { name: 'Förderverein Beispiel e.V.', iban: 'DE69234567891234567800', bic: '' },
  transactions: [
    tx(),
    tx({
      endToEndId: 'LW2026092421300501AZ0Z-2',
      cents: 4550,
      name: 'Gärtnerei Grün & Söhne',
      iban: 'AT611904300234573201',
      bic: 'COBADEFFXXX',
      purpose: '',
    }),
  ],
  ...over,
});

/** Verschiedene Fälle, die alle gegen das DK-Schema gültig sein müssen. */
export const scenarios: Record<string, Pain001Input> = {
  'zwei Überweisungen, mit und ohne BIC': input(),
  'Auftraggeber mit BIC': input({
    debtor: { name: 'Verein', iban: 'DE89370400440532013000', bic: 'GENODEM1GLS' },
  }),
  'eine Überweisung': input({ transactions: [tx()] }),
  Höchstbetrag: input({ transactions: [tx({ cents: 99_999_999_999 })] }),
  Mindestbetrag: input({ transactions: [tx({ cents: 1 })] }),
  'Summe über dem Einzel-Höchstbetrag': input({
    transactions: [
      tx({ cents: 99_999_999_999 }),
      tx({ endToEndId: 'E2E-2', cents: 99_999_999_999 }),
    ],
  }),
  'alle erlaubten Zeichen': input({
    transactions: [
      tx({
        name: "AZaz09'.:?,-(+)/ ÄÖÜäöüß&*$%",
        purpose: "Zweck mit allen Zeichen: A-Z a-z 0-9 ' : ? , - ( + . ) / Ä Ö Ü ä ö ü ß & * $ %",
      }),
    ],
  }),
  'maximale Längen': input({
    transactions: [
      tx({ name: 'N'.repeat(70), purpose: 'P'.repeat(140), endToEndId: 'E'.repeat(35) }),
    ],
  }),
  'hundert Überweisungen': input({
    transactions: Array.from({ length: 100 }, (_, i) =>
      tx({ endToEndId: `E2E-${i + 1}`, cents: 100 + i }),
    ),
  }),
};
