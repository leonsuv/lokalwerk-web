import { describe, expect, it } from 'vitest';
import { checkPassword, type Finding } from '../../../src/core/random/password-check.ts';

const kinds = (password: string): Finding['kind'][] =>
  checkPassword(password).findings.map((f) => f.kind);

describe('Zeichenarten und BSI-Einordnung', () => {
  it('zählt die vier Zeichenarten, auch Umlaute als Buchstaben', () => {
    const c = checkPassword('Aä1!');
    expect(c).toMatchObject({ upper: true, lower: true, digits: true, symbols: true, kinds: 4 });
    expect(checkPassword('abc').kinds).toBe(1);
  });

  it('zählt Zeichen, nicht UTF-16-Einheiten', () => {
    expect(checkPassword('a😀b').length).toBe(3);
  });

  it('folgt den BSI-Beispielen', () => {
    expect(checkPassword('Tz7!kPq2').bsi).toEqual({ ok: true, example: 'short-four-kinds' });
    expect(checkPassword('Tz7kPq2x').bsi).toEqual({ ok: false });
    expect(checkPassword('blau grün rot gelb orange').bsi).toEqual({ ok: true, example: 'long' });
  });
});

describe('Hinweise', () => {
  it('erkennt häufige Passwörter, auch mit Groß/Klein', () => {
    expect(kinds('Passwort')).toContain('common');
    expect(kinds('QWERTZ')).toContain('common');
  });

  it('erkennt ein häufiges Passwort mit angehängten Ziffern oder Zeichen', () => {
    expect(kinds('Passwort2026!')).toContain('common-start');
    expect(kinds('Passwort2026!')).not.toContain('common');
  });

  it('erkennt Reihen aufwärts und abwärts, aber erst ab vier Zeichen', () => {
    expect(kinds('xx1234yy')).toContain('sequence');
    expect(kinds('xxDCBAyy')).toContain('sequence');
    expect(kinds('abc')).not.toContain('sequence');
    expect(kinds('x12y3z')).not.toContain('sequence');
  });

  it('erkennt Tastaturreihen im deutschen Layout, auch rückwärts', () => {
    expect(kinds('mein-qwertz-pw')).toContain('keyboard');
    expect(kinds('lkjh')).toContain('keyboard');
    expect(kinds('mnbv')).toContain('keyboard');
  });

  it('erkennt wiederholte Zeichen und wiederholte Blöcke', () => {
    expect(kinds('xaaaaay')).toContain('repeat-char');
    expect(kinds('Ab3!Ab3!')).toContain('repeat-block');
    expect(kinds('Ab3!Ab3!Ab3!')).toContain('repeat-block');
    expect(kinds('Ab3!Cd4?')).not.toContain('repeat-block');
  });

  it('weist auf Umlaute und € hin (BSI-Empfehlung)', () => {
    expect(kinds('Grüße12345678')).toContain('umlaut');
    expect(kinds('Preis€€€€abcd')).toContain('umlaut');
  });

  it('meldet bei einem zufälligen Passwort nichts', () => {
    expect(checkPassword('vK9#mTq2!xRw5@Lp').findings).toEqual([]);
  });

  it('kommt mit leerer Eingabe zurecht', () => {
    expect(checkPassword('')).toMatchObject({ length: 0, kinds: 0, findings: [] });
  });
});
