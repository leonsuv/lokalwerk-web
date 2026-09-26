/**
 * Werkzeugseite „QR-Code erstellen“ (plan-phase2.md, Werkzeug 28). uqr kodiert, alles läuft auf
 * der Seite (klein, keine Wartezeit). Nichts wird gespeichert oder gesendet.
 */

import { QrTooLongError, qrMatrix, qrSvg, utf8, type Ecc } from '../../core/qr/encode.ts';
import { contactPayload, urlPayload, wifiPayload } from '../../core/qr/payloads.ts';
import { $, $$ } from '../../ui/dom.ts';
import { drawQr, savePng, saveSvg } from '../../ui/qr-output.ts';
import { showToast } from '../../ui/toast.ts';

type Kind = 'url' | 'wifi' | 'contact' | 'text';

const canvas = $<HTMLCanvasElement>('#qr-canvas');
const kindButtons = $$<HTMLButtonElement>('button[data-kind]');
const securityButtons = $$<HTMLButtonElement>('button[data-security]');
const hiddenButtons = $$<HTMLButtonElement>('button[data-hidden]');
const value = (id: string) => $<HTMLInputElement | HTMLTextAreaElement>(id).value;

let kind: Kind = 'url';
let security: 'WPA' | 'nopass' = 'WPA';
let hidden = false;
let current: { bytes: number[]; ecc: Ecc; name: string } | null = null;

/** Inhalt des Codes oder eine Meldung, warum es noch keinen gibt */
function payload(): { text: string; name: string } | { error: string } | null {
  if (kind === 'url') {
    const input = value('#qr-url');
    if (input.trim() === '') return null;
    const result = urlPayload(input);
    $('#qr-url-hint').textContent =
      result.ok && result.addedScheme ? `Der Code enthält ${result.url}` : '';
    return result.ok
      ? { text: result.url, name: 'qr-code-link' }
      : {
          error:
            'Das ist keine gültige Adresse. Schreib sie zum Beispiel so: lokalwerk.eu/werkzeuge/',
        };
  }
  if (kind === 'wifi') {
    const ssid = value('#qr-ssid');
    if (ssid.trim() === '') return null;
    const password = value('#qr-pass');
    if (security === 'WPA' && password === '') {
      return { error: 'Gib das WLAN-Passwort ein oder wähl „Ohne Passwort“.' };
    }
    return { text: wifiPayload({ ssid, password, security, hidden }), name: 'qr-code-wlan' };
  }
  if (kind === 'contact') {
    const c = {
      firstName: value('#qr-first'),
      lastName: value('#qr-last'),
      organization: value('#qr-org'),
      phone: value('#qr-phone'),
      email: value('#qr-email'),
      url: value('#qr-web'),
    };
    if (!c.firstName.trim() && !c.lastName.trim() && !c.organization.trim()) return null;
    return { text: contactPayload(c), name: 'qr-code-kontakt' };
  }
  const text = value('#qr-text');
  return text.trim() === '' ? null : { text, name: 'qr-code-text' };
}

function render(): void {
  for (const b of kindButtons) b.setAttribute('aria-pressed', String(b.dataset.kind === kind));
  for (const b of securityButtons) {
    b.setAttribute('aria-pressed', String(b.dataset.security === security));
  }
  for (const b of hiddenButtons) {
    b.setAttribute('aria-pressed', String((b.dataset.hidden === 'yes') === hidden));
  }
  for (const panel of $$<HTMLElement>('[data-panel]')) panel.hidden = panel.dataset.panel !== kind;
  $<HTMLInputElement>('#qr-pass').disabled = security === 'nopass';

  const result = payload();
  let error = result && 'error' in result ? result.error : '';
  current = null;
  if (result && 'text' in result) {
    const ecc = $<HTMLSelectElement>('#qr-ecc').value as Ecc;
    const bytes = utf8(result.text);
    try {
      const matrix = qrMatrix(bytes, { ecc });
      drawQr(canvas, matrix, 8);
      current = { bytes, ecc, name: result.name };
      $('#qr-modules').textContent = `${matrix.size} × ${matrix.size} Module`;
    } catch (e) {
      if (!(e instanceof QrTooLongError)) throw e;
      error =
        'Der Inhalt ist zu lang für einen QR-Code. Kürze ihn oder wähl eine niedrigere Fehlerkorrektur.';
    }
  }
  $('#qr-error').textContent = error;
  canvas.hidden = current === null;
  $('#qr-empty').hidden = current !== null;
  if (!current) $('#qr-modules').textContent = '–';
  $<HTMLButtonElement>('#qr-png').disabled = current === null;
  $<HTMLButtonElement>('#qr-svg').disabled = current === null;
}

async function png(): Promise<void> {
  if (!current) return;
  const matrix = qrMatrix(current.bytes, { ecc: current.ecc });
  const target = Number($<HTMLSelectElement>('#qr-size').value);
  const out = document.createElement('canvas');
  drawQr(out, matrix, Math.max(1, Math.round(target / (matrix.size + 8))));
  await savePng(out, `${current.name}.png`);
  showToast('Fertig: Der QR-Code ist als PNG gespeichert.');
}

for (const b of kindButtons) {
  b.addEventListener('click', () => {
    kind = (b.dataset.kind ?? 'url') as Kind;
    render();
  });
}
for (const b of securityButtons) {
  b.addEventListener('click', () => {
    security = b.dataset.security === 'nopass' ? 'nopass' : 'WPA';
    render();
  });
}
for (const b of hiddenButtons) {
  b.addEventListener('click', () => {
    hidden = b.dataset.hidden === 'yes';
    render();
  });
}
document.querySelector('.workspace')?.addEventListener('input', render);
$('#qr-ecc').addEventListener('change', render);
$('#qr-png').addEventListener('click', () => {
  png().catch(() => showToast('Das Bild konnte nicht erzeugt werden. Lade die Seite neu.'));
});
$('#qr-svg').addEventListener('click', () => {
  if (!current) return;
  saveSvg(qrSvg(current.bytes, { ecc: current.ecc }), `${current.name}.svg`);
  showToast('Fertig: Der QR-Code ist als SVG gespeichert.');
});
render();
