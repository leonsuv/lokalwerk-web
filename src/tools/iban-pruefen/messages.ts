/**
 * Meldungen zur IBAN-Prüfung, für Tabelle und Ausgabedatei (AGENTS.md Abschnitt 7). Dieselben
 * Fehlertexte wie auf der SEPA-Seite.
 */

import type { IbanCheck } from '../../core/sepa/iban-list.ts';
import { ibanMessage } from '../sepa-sammelueberweisung/messages.ts';

export function ibanCheckMessage(check: IbanCheck, repeatedLines: readonly number[] = []): string {
  switch (check.status) {
    case 'ok': {
      const base = check.bank ? `gültig, ${check.bank.name}, BIC ${check.bank.bic}` : 'gültig';
      return repeatedLines.length > 1
        ? `${base}, kommt mehrfach vor (Zeilen ${repeatedLines.join(', ')})`
        : base;
    }
    case 'empty':
      return 'leer';
    case 'non-eea':
      return check.checksumOk
        ? `SEPA-Land außerhalb des EWR (${check.country}): Prüfziffer stimmt, Länge nicht geprüft`
        : `SEPA-Land außerhalb des EWR (${check.country}): Prüfziffer stimmt nicht (Tippfehler?)`;
    case 'error':
      return ibanMessage(check);
  }
}
