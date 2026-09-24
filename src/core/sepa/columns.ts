/**
 * Spaltenzuordnung aus den Überschriften raten. Der Nutzer kann sie in der Oberfläche ändern.
 * Reihenfolge der Felder ist wichtig: eindeutige Begriffe zuerst, damit z. B. „IBAN des
 * Empfängers“ als IBAN erkannt wird und nicht als Name.
 */

export type Field = 'name' | 'iban' | 'amount' | 'purpose' | 'bic';

export interface FieldInfo {
  field: Field;
  label: string;
  required: boolean;
}

/** Anzeige-Reihenfolge in der Oberfläche (wie im Prototyp). */
export const FIELDS: readonly FieldInfo[] = [
  { field: 'name', label: 'Empfänger', required: true },
  { field: 'iban', label: 'IBAN', required: true },
  { field: 'amount', label: 'Betrag', required: true },
  { field: 'purpose', label: 'Verwendungszweck', required: false },
  { field: 'bic', label: 'BIC', required: false },
];

/** Erkennungs-Reihenfolge und Muster. */
const PATTERNS: readonly [Field, RegExp][] = [
  ['iban', /iban/i],
  ['bic', /\bbic\b|swift/i],
  ['amount', /betrag|summe|amount|\beur\b|€/i],
  ['name', /empf|name|begünst|beguenst|inhaber|zahlungsempf/i],
  ['purpose', /zweck|verwendung|betreff|referenz|text|beschreibung|rechnung/i],
  ['iban', /konto/i],
];

export type ColumnMapping = Record<Field, number>;

export function guessColumns(headers: readonly string[]): ColumnMapping {
  const mapping: ColumnMapping = { name: -1, iban: -1, amount: -1, purpose: -1, bic: -1 };
  const used = new Set<number>();
  for (const [field, pattern] of PATTERNS) {
    if (mapping[field] >= 0) continue;
    const index = headers.findIndex((h, i) => !used.has(i) && pattern.test(h));
    if (index >= 0) {
      mapping[field] = index;
      used.add(index);
    }
  }
  return mapping;
}

export function missingRequiredFields(mapping: ColumnMapping): Field[] {
  return FIELDS.filter((f) => f.required && mapping[f.field] < 0).map((f) => f.field);
}
