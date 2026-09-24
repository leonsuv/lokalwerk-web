import { describe, expect, it } from 'vitest';
import {
  dateMessage,
  ibanMessage,
  readErrorMessage,
  replacementsText,
  rowErrorMessage,
  rowWarningMessage,
} from '../../src/tools/sepa-sammelueberweisung/messages.ts';

const c = (code: number) => String.fromCodePoint(code);

describe('Meldungen der SEPA-Seite', () => {
  it('nennt bei IBAN-Fehlern die Ursache', () => {
    expect(ibanMessage({ code: 'wrong-length', country: 'DE', expected: 22, actual: 21 })).toBe(
      'IBAN muss 22 Zeichen haben, hat 21',
    );
    expect(ibanMessage({ code: 'non-eea', country: 'CH' })).toContain('noch nicht unterstützt');
  });

  it('nennt den Text aus plan.md B1 für mehrdeutige Beträge', () => {
    expect(rowErrorMessage({ code: 'amount', error: 'ambiguous' })).toBe(
      'Betrag ist nicht eindeutig. Schreib 1.234,00 oder 1,23.',
    );
    expect(rowErrorMessage({ code: 'amount', error: 'too-large' })).toContain('999.999.999,99');
  });

  it('nennt fehlende Spalten mit ihrer Beschriftung', () => {
    expect(rowErrorMessage({ code: 'missing-columns', fields: ['iban', 'amount'] })).toBe(
      'Spalte zuordnen: IBAN, Betrag',
    );
  });

  it('unterscheidet Empfänger und Kontoinhaber', () => {
    expect(rowErrorMessage({ code: 'name-empty' })).toBe('Empfänger fehlt');
    expect(rowErrorMessage({ code: 'name-empty' }, 'Kontoinhaber')).toBe('Kontoinhaber fehlt');
  });

  it('beschreibt Ersetzungen lesbar, auch unsichtbare Zeichen', () => {
    expect(
      replacementsText([
        { from: c(0xe9), to: 'e' },
        { from: '\n', to: ' ' },
        { from: c(0xad), to: '' },
        { from: c(0xa0), to: ' ' },
      ]),
    ).toBe(
      'é → e, Zeilenumbruch → Leerzeichen, unsichtbares Zeichen entfernt, besonderes Leerzeichen → Leerzeichen',
    );
  });

  it('meldet Kürzungen mit Feld und Länge', () => {
    expect(rowWarningMessage({ code: 'truncated', field: 'purpose', from: 150, to: 140 })).toBe(
      'Verwendungszweck auf 140 Zeichen gekürzt',
    );
  });

  it('Warnung für Datum mehr als 15 Tage in der Zukunft (plan.md O7)', () => {
    expect(dateMessage({ ok: true, warning: 'far-future' })).toBe(
      'Banken müssen Aufträge mit einem Datum mehr als 15 Tage in der Zukunft nicht annehmen.',
    );
    expect(dateMessage({ ok: true, warning: null })).toBeNull();
    expect(dateMessage({ ok: false, code: 'past' })).toBe(
      'Ausführungsdatum liegt in der Vergangenheit',
    );
  });

  it('Lesefehler nennen Zeilennummer und Abhilfe', () => {
    expect(readErrorMessage({ ok: false, code: 'unterminated-quote', line: 7 })).toContain(
      'Zeile 7',
    );
    expect(readErrorMessage({ ok: false, code: 'encrypted' })).toContain('ohne Passwort');
  });
});
