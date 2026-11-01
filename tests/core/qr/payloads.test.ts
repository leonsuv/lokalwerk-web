import { describe, expect, it } from 'vitest';
import {
  contactPayload,
  mailPayload,
  urlPayload,
  wifiPayload,
} from '../../../src/core/qr/payloads.ts';
import { QUIET_ZONE, qrMatrix, qrSvg, utf8 } from '../../../src/core/qr/encode.ts';

describe('urlPayload', () => {
  it('ergänzt https:// und lehnt Unsinn ab', () => {
    expect(urlPayload('lokalwerk.eu/werkzeuge/')).toEqual({
      ok: true,
      url: 'https://lokalwerk.eu/werkzeuge/',
      addedScheme: true,
    });
    expect(urlPayload('https://example.org/a?b=1')).toMatchObject({ ok: true, addedScheme: false });
    expect(urlPayload('mailto:kontakt@example.org')).toMatchObject({ ok: true });
    expect(urlPayload('kein link')).toEqual({ ok: false });
    expect(urlPayload('localhost')).toEqual({ ok: false });
    expect(urlPayload('')).toEqual({ ok: false });
  });
});

describe('wifiPayload (ZXing-Schreibweise)', () => {
  it('schützt Sonderzeichen mit Backslash', () => {
    expect(
      wifiPayload({ ssid: 'Verein;Gast', password: 'a:b\\c"d,e', security: 'WPA', hidden: false }),
    ).toBe('WIFI:T:WPA;S:Verein\\;Gast;P:a\\:b\\\\c\\"d\\,e;;');
  });

  it('ohne Passwort und versteckt', () => {
    expect(wifiPayload({ ssid: 'Offen', password: 'x', security: 'nopass', hidden: true })).toBe(
      'WIFI:T:nopass;S:Offen;H:true;;',
    );
  });
});

describe('contactPayload (vCard 3.0, RFC 2426)', () => {
  it('schreibt Pflichtfelder, schützt Sonderzeichen und trennt mit CRLF', () => {
    expect(
      contactPayload({
        firstName: 'Anna',
        lastName: 'Müller; Schmidt',
        organization: 'Musterverein e. V.',
        phone: '+49 221 123456',
        email: 'anna@example.org',
        url: '',
      }),
    ).toBe(
      [
        'BEGIN:VCARD',
        'VERSION:3.0',
        'N:Müller\\; Schmidt;Anna;;;',
        'FN:Anna Müller\\; Schmidt',
        'ORG:Musterverein e. V.',
        'TEL;TYPE=VOICE:+49 221 123456',
        'EMAIL;TYPE=INTERNET:anna@example.org',
        'END:VCARD',
      ].join('\r\n'),
    );
  });
});

describe('qrSvg und qrMatrix', () => {
  it('SVG mit Ruhezone von 4 Modulen, Matrix ohne', () => {
    const bytes = utf8('https://lokalwerk.eu/');
    const matrix = qrMatrix(bytes, { ecc: 'M' });
    const svg = qrSvg(bytes, { ecc: 'M' });
    const side = (matrix.size + 2 * QUIET_ZONE) * 10;
    expect(svg).toContain(`viewBox="0 0 ${side} ${side}"`);
    expect(matrix.modules).toHaveLength(matrix.size);
    // Suchmuster oben links: 7 × 7, außen dunkel
    expect(matrix.modules[0]?.slice(0, 7)).toEqual(Array(7).fill(true));
  });
});

describe('mailPayload (mailto, RFC 6068)', () => {
  it('nur Adresse', () => {
    expect(mailPayload({ address: ' max@example.de ', subject: '', body: '' })).toEqual({
      ok: true,
      text: 'mailto:max@example.de',
    });
  });

  it('Betreff und Text prozent-kodiert, Zeilenumbruch als %0D%0A', () => {
    expect(
      mailPayload({ address: 'a@b.de', subject: 'Frage & Antwort', body: 'Hallo\nWelt äöü?' }),
    ).toEqual({
      ok: true,
      text: 'mailto:a@b.de?subject=Frage%20%26%20Antwort&body=Hallo%0D%0AWelt%20%C3%A4%C3%B6%C3%BC%3F',
    });
  });

  it('kodiert Sonderzeichen vor dem @ und setzt Umlaut-Domains in Punycode um', () => {
    expect(mailPayload({ address: 'a+b%c@müller.de', subject: '', body: '' })).toEqual({
      ok: true,
      text: 'mailto:a%2Bb%25c@xn--mller-kva.de',
    });
  });

  it.each([
    '',
    'ohne-at',
    '@example.de',
    'a b@example.de',
    'a@example',
    'a@@b.de',
    'a,b@example.de',
    'a@.de',
  ])('lehnt %j ab', (address) =>
    expect(mailPayload({ address, subject: '', body: '' })).toEqual({ ok: false }),
  );
});
