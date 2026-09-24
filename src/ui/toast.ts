/**
 * Kurze Meldung unten auf der Seite (Prototyp: 3,8 Sekunden). Das Element #toast steht mit
 * role="status" schon beim Laden im Fuß (src/partials/footer.html), damit Screenreader
 * Änderungen vorlesen.
 */

import { $ } from './dom.ts';

const DURATION_MS = 3800;
let hideTimer: ReturnType<typeof setTimeout> | undefined;

export function showToast(message: string): void {
  const toast = $('#toast');
  clearTimeout(hideTimer);
  // Erst leeren, damit auch eine wiederholte gleiche Meldung erneut vorgelesen wird.
  toast.textContent = '';
  requestAnimationFrame(() => {
    toast.textContent = message;
    toast.classList.add('show');
    hideTimer = setTimeout(() => toast.classList.remove('show'), DURATION_MS);
  });
}
