/**
 * Hinweis oben im Werkzeug, wenn der Browser zu alt für pdf.js ist (support.ts). Einmal je Seite
 * statt „Keine Vorschau möglich“ auf jeder Kachel oder „Die Datei ist beschädigt …“.
 */

import { SAVE_STILL_WORKS, UNSUPPORTED_PREVIEW, UNSUPPORTED_TOOL } from './support.ts';

/**
 * `preview`: Das Werkzeug speichert auch ohne pdf.js, nur die Vorschau fehlt.
 * `tool`: Das Werkzeug braucht pdf.js für sein Ergebnis.
 */
export function unsupportedNote(
  kind: 'preview' | 'tool',
  container: Element | null = document.querySelector('.workspace .card'),
): (state: { unsupported: boolean; fileLoaded?: boolean }) => void {
  const note = document.createElement('div');
  note.className = 'note mt-m pdfjs-unsupported';
  note.setAttribute('role', 'alert');
  note.hidden = true;
  // Festes Markup ohne Nutzerdaten; der HTML-Parser setzt den SVG-Namensraum selbst.
  note.innerHTML = '<svg width="18" height="18" aria-hidden="true"><use href="#i-info" /></svg>';
  const text = document.createElement('span');
  note.append(text);
  container?.prepend(note);
  return ({ unsupported, fileLoaded = false }) => {
    note.hidden = !unsupported;
    if (!unsupported) return;
    const message =
      kind === 'tool'
        ? UNSUPPORTED_TOOL
        : fileLoaded
          ? `${UNSUPPORTED_PREVIEW} ${SAVE_STILL_WORKS}`
          : UNSUPPORTED_PREVIEW;
    if (text.textContent !== message) text.textContent = message;
  };
}
