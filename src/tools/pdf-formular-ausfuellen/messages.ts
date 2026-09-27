/**
 * Meldungen von „PDF-Formular ausfüllen“, gemeinsam für die Werkzeugseite und die PDF-Werkstatt.
 * Texte freigegeben von Leon am 26.09.2026 (docs/texte-zur-freigabe.md).
 */

import { WorkerError } from '../../ui/worker-protocol.ts';

export const MESSAGES: Record<string, string> = {
  empty: 'Die Datei ist leer.',
  encrypted:
    'Die PDF ist verschlüsselt (Passwort- oder Kopierschutz). Entferne den Schutz und füge sie erneut hinzu.',
  damaged:
    'Die Datei ist beschädigt oder keine gültige PDF. Speichere sie im Ursprungsprogramm erneut als PDF.',
  'no-pages': 'Die PDF enthält keine Seiten.',
  'out-of-memory': 'Nicht genug Arbeitsspeicher für diese PDF.',
  unreadable:
    'Die Datei konnte nicht gelesen werden. Prüfe, ob sie noch am selben Ort liegt, und füge sie erneut hinzu.',
  'worker-failed': 'Das Werkzeug konnte nicht starten. Lade die Seite neu.',
  xfa: 'Das ist ein XFA-Formular. Das lässt sich hier nicht ausfüllen; nimm dafür das Programm, das der Herausgeber des Formulars nennt.',
  charset:
    'Eine Eingabe enthält Zeichen, die die PDF-Schrift nicht darstellen kann. Ersetze sie, zum Beispiel Ł durch L.',
};
export const FALLBACK =
  'Die Datei konnte nicht verarbeitet werden. Lade die Seite neu und versuch es noch einmal.';
export const messageFor = (error: unknown): string =>
  (error instanceof WorkerError ? MESSAGES[error.code] : undefined) ?? FALLBACK;

export const NO_FIELDS =
  'Diese PDF hat keine ausfüllbaren Felder. Druck sie aus oder frag beim Herausgeber nach einer ausfüllbaren Fassung.';
