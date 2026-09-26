/**
 * Inhalte für QR-Codes (Werkzeug „QR-Code erstellen“). Reine Funktionen.
 *
 * - Link: Adresse nach RFC 3986; ohne Schema wird https:// vorangestellt.
 * - WLAN: „WIFI:T:WPA;S:Name;P:Passwort;;“ ist keine Norm, sondern die verbreitete Schreibweise
 *   aus dem ZXing-Projekt (plan-phase2.md Werkzeug 28). Sonderzeichen \ ; , : " werden mit
 *   Backslash geschützt. Die Wi-Fi Alliance beschreibt ein ähnliches Format; dessen Wortlaut lag
 *   nicht vor, deshalb stützen wir uns nicht darauf.
 * - Kontakt: vCard 3.0 nach RFC 2426 (von älteren Telefonen am breitesten gelesen), Zeilen mit
 *   CRLF, Textwerte mit Backslash-Schutz für \ ; , und Zeilenumbrüche (RFC 2426, 4).
 */

export type UrlResult = { ok: true; url: string; addedScheme: boolean } | { ok: false };

export function urlPayload(input: string): UrlResult {
  const text = input.trim();
  if (text === '' || /\s/.test(text)) return { ok: false };
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(text);
  const candidate = hasScheme ? text : `https://${text}`;
  try {
    const url = new URL(candidate);
    if ((url.protocol === 'http:' || url.protocol === 'https:') && !url.hostname.includes('.')) {
      return { ok: false };
    }
  } catch {
    return { ok: false };
  }
  return { ok: true, url: candidate, addedScheme: !hasScheme };
}

const wifiEscape = (value: string) => value.replace(/([\\;,:"])/g, '\\$1');

export interface WifiInput {
  ssid: string;
  password: string;
  security: 'WPA' | 'nopass';
  hidden: boolean;
}

export function wifiPayload({ ssid, password, security, hidden }: WifiInput): string {
  const parts = [`T:${security}`, `S:${wifiEscape(ssid)}`];
  if (security !== 'nopass') parts.push(`P:${wifiEscape(password)}`);
  if (hidden) parts.push('H:true');
  return `WIFI:${parts.join(';')};;`;
}

export interface ContactInput {
  firstName: string;
  lastName: string;
  organization: string;
  phone: string;
  email: string;
  url: string;
}

const vcardEscape = (value: string) =>
  value
    .trim()
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');

export function contactPayload(c: ContactInput): string {
  const first = vcardEscape(c.firstName);
  const last = vcardEscape(c.lastName);
  const full =
    [c.firstName.trim(), c.lastName.trim()].filter(Boolean).join(' ') || c.organization.trim();
  const lines = ['BEGIN:VCARD', 'VERSION:3.0', `N:${last};${first};;;`, `FN:${vcardEscape(full)}`];
  if (c.organization.trim()) lines.push(`ORG:${vcardEscape(c.organization)}`);
  if (c.phone.trim()) lines.push(`TEL;TYPE=VOICE:${vcardEscape(c.phone)}`);
  if (c.email.trim()) lines.push(`EMAIL;TYPE=INTERNET:${vcardEscape(c.email)}`);
  if (c.url.trim()) lines.push(`URL:${vcardEscape(c.url)}`);
  lines.push('END:VCARD');
  return lines.join('\r\n');
}
