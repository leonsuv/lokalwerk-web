/**
 * Kennungen für pain.001: MsgId, PmtInfId, EndToEndId.
 *
 * Anlage 3 26.11, Kap. 2.3.1.1, S. 253: Max35Text, im TVS eingeschränkt auf
 * ([A-Za-z0-9]|[+?/\-:().,' ]){1,35}. Kap. 2.1, S. 84: Referenzen dürfen nicht mit „/“
 * beginnen oder enden und kein „//“ enthalten. MsgId muss je Datei neu sein (S. 95).
 * Hinweis: Das Muster im TVS lässt durch eine Eigenheit des regulären Ausdrucks auch „|“ zu;
 * das ist nicht Teil des Zeichensatzes aus S. 85 und wird hier abgelehnt.
 */

import { REFERENCE_MAX_LENGTH } from './charset.ts';

export function isValidReference(id: string): boolean {
  return (
    /^[A-Za-z0-9+?/\-:().,' ]{1,35}$/.test(id) &&
    !id.startsWith('/') &&
    !id.endsWith('/') &&
    !id.includes('//')
  );
}

const pad = (n: number, width = 2) => String(n).padStart(width, '0');
const BASE36 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * „LW“ + Zeitstempel (Ortszeit, Sekunden) + 6 Zufallszeichen, z. B. LW20260924213000K7Q2ZD
 * (22 Zeichen). Zeit und Zufall werden übergeben, damit das Ergebnis testbar ist.
 */
export function createMessageId(now: Date, random: Uint8Array): string {
  if (random.length < 6) throw new RangeError('Mindestens 6 Zufallsbytes nötig');
  const stamp =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const suffix = [...random.subarray(0, 6)].map((b) => BASE36[b % 36]).join('');
  return `LW${stamp}${suffix}`;
}

export const paymentInformationId = (messageId: string): string => `${messageId}-P1`;

/** Eindeutige EndToEndId je Überweisung: MsgId + laufende Nummer (ab 1). */
export function endToEndId(messageId: string, index: number): string {
  const id = `${messageId}-${index + 1}`;
  if (id.length > REFERENCE_MAX_LENGTH) throw new RangeError(`EndToEndId zu lang: ${id}`);
  return id;
}
