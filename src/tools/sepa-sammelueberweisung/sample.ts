/** Beispieldaten aus dem Prototyp. Zeile 5 (Tom Test) hat absichtlich einen IBAN-Tippfehler. */

export const SAMPLE_DEBTOR = {
  name: 'Förderverein Beispiel e.V.',
  iban: 'DE69 2345 6789 1234 5678 00',
};

export const SAMPLE_ROWS: string[][] = [
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
];
