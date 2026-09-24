/**
 * Zeilen einer Überweisungsliste prüfen (AGENTS.md Abschnitt 5): Fehlerhafte Zeilen werden
 * nie still übernommen oder korrigiert, sondern markiert, begründet und ausgeschlossen.
 * Umschreibungen und Kürzungen werden als Warnung gemeldet.
 */

import { validateBic, type BicResult } from './bic.ts';
import {
  NAME_MAX_LENGTH,
  PURPOSE_MAX_LENGTH,
  sanitizeSepaText,
  type Replacement,
} from './charset.ts';
import { missingRequiredFields, type ColumnMapping, type Field } from './columns.ts';
import { validateIban, type IbanError } from './iban.ts';
import { parseAmount, type AmountError } from './amount.ts';
import type { Cell, Table } from '../sheet/table.ts';

export type RowError =
  | { code: 'missing-columns'; fields: Field[] }
  | { code: 'name-empty' }
  | { code: 'iban'; error: IbanError }
  | { code: 'amount'; error: AmountError }
  | { code: 'bic-invalid' };

export type RowWarning =
  | { code: 'replaced'; field: 'name' | 'purpose'; replacements: Replacement[] }
  | { code: 'truncated'; field: 'name' | 'purpose'; from: number; to: number };

export interface CheckedRow {
  /** Zeilennummer in der Datei (1 = erste Zeile, also die Kopfzeile) */
  sourceRow: number;
  name: string;
  iban: string;
  bic: string;
  cents: number | null;
  purpose: string;
  errors: RowError[];
  warnings: RowWarning[];
}

export interface CheckResult {
  rows: CheckedRow[];
  valid: CheckedRow[];
  totalCents: number;
  excludedCount: number;
  /** Nur eine gültige Überweisung: Hinweis nach plan.md O9 */
  singleTransfer: boolean;
}

const cellText = (cell: Cell | undefined): string =>
  cell === undefined ? '' : typeof cell === 'number' ? String(cell) : cell;

function textField(
  raw: string,
  field: 'name' | 'purpose',
  maxLength: number,
  warnings: RowWarning[],
): { text: string; blank: boolean } {
  const result = sanitizeSepaText(raw, maxLength);
  if (result.replacements.length > 0) {
    warnings.push({ code: 'replaced', field, replacements: result.replacements });
  }
  if (result.truncated) {
    warnings.push({
      code: 'truncated',
      field,
      from: result.lengthBeforeTruncation,
      to: result.text.length,
    });
  }
  return { text: result.text, blank: result.blank };
}

export function checkTransfers(table: Table, mapping: ColumnMapping): CheckResult {
  const missing = missingRequiredFields(mapping);
  const get = (row: Cell[], field: Field): Cell | undefined =>
    mapping[field] >= 0 ? row[mapping[field]] : undefined;

  const rows = table.rows.map((row, i): CheckedRow => {
    const errors: RowError[] = [];
    const warnings: RowWarning[] = [];
    if (missing.length > 0) errors.push({ code: 'missing-columns', fields: missing });

    const name = textField(cellText(get(row, 'name')), 'name', NAME_MAX_LENGTH, warnings);
    if (name.blank) errors.push({ code: 'name-empty' });

    const iban = validateIban(cellText(get(row, 'iban')));
    if (!iban.ok) {
      const { ok: _, ...error } = iban;
      errors.push({ code: 'iban', error });
    }

    const amountCell = get(row, 'amount');
    const amount = parseAmount(amountCell ?? '');
    if (!amount.ok) errors.push({ code: 'amount', error: amount.code });

    const purpose = textField(
      cellText(get(row, 'purpose')),
      'purpose',
      PURPOSE_MAX_LENGTH,
      warnings,
    );

    const bicRaw = cellText(get(row, 'bic')).trim();
    let bic = '';
    if (bicRaw !== '') {
      const checked: BicResult = validateBic(bicRaw);
      if (checked.ok) bic = checked.bic;
      else errors.push({ code: 'bic-invalid' });
    }

    return {
      sourceRow: table.sourceRows[i] ?? i + 2,
      name: name.text,
      iban: iban.ok ? iban.iban : cellText(get(row, 'iban')).trim(),
      bic,
      cents: amount.ok ? amount.cents : null,
      purpose: purpose.text,
      errors,
      warnings,
    };
  });

  const valid = rows.filter((r) => r.errors.length === 0);
  return {
    rows,
    valid,
    totalCents: valid.reduce((sum, r) => sum + (r.cents ?? 0), 0),
    excludedCount: rows.length - valid.length,
    singleTransfer: valid.length === 1,
  };
}

export interface DebtorInput {
  name: string;
  iban: string;
  bic: string;
}

export interface CheckedDebtor {
  name: string;
  iban: string;
  bic: string;
  errors: RowError[];
  warnings: RowWarning[];
}

/** Eigenes Konto (Auftraggeber): gleiche Regeln wie für Empfänger, auch nur EWR (plan.md S4). */
export function checkDebtor(input: DebtorInput): CheckedDebtor {
  const errors: RowError[] = [];
  const warnings: RowWarning[] = [];
  const name = textField(input.name, 'name', NAME_MAX_LENGTH, warnings);
  if (name.blank) errors.push({ code: 'name-empty' });
  const iban = validateIban(input.iban);
  if (!iban.ok) {
    const { ok: _, ...error } = iban;
    errors.push({ code: 'iban', error });
  }
  let bic = '';
  if (input.bic.trim() !== '') {
    const checked = validateBic(input.bic);
    if (checked.ok) bic = checked.bic;
    else errors.push({ code: 'bic-invalid' });
  }
  return { name: name.text, iban: iban.ok ? iban.iban : input.iban.trim(), bic, errors, warnings };
}
