/**
 * Werkzeugseite „QR-Code für Überweisungen (EPC-QR-Code)“ (plan-phase2.md Werkzeug 17, E1, E2).
 * Nutzdaten nach EPC069-12 v3.1 (core/sepa/epc-qr.ts), Version 002, UTF-8, Fehlerkorrektur M,
 * höchstens QR-Version 13. Keine Rechnungsfelder (E1).
 */

import { formatEuro } from '../../core/format/money.ts';
import { QrTooLongError, qrMatrix, qrSvg, type QrMatrix } from '../../core/qr/encode.ts';
import { parseAmount } from '../../core/sepa/amount.ts';
import { validateBic } from '../../core/sepa/bic.ts';
import { sanitizeSepaText } from '../../core/sepa/charset.ts';
import {
  EPC_MAX_BYTES,
  EPC_MAX_VERSION,
  EPC_NAME_MAX,
  EPC_TEXT_MAX,
  epcBytes,
  epcPayload,
} from '../../core/sepa/epc-qr.ts';
import { formatIban, validateIban } from '../../core/sepa/iban.ts';
import { $, $$ } from '../../ui/dom.ts';
import { drawQr, savePng, saveSvg } from '../../ui/qr-output.ts';
import { showToast } from '../../ui/toast.ts';
import {
  ibanMessage,
  replacementsText,
  rowErrorMessage,
} from '../sepa-sammelueberweisung/messages.ts';

const canvas = $<HTMLCanvasElement>('#epc-canvas');
const captionButtons = $$<HTMLButtonElement>('button[data-caption]');
const AMOUNT_HINT = $('#epc-amount-msg').textContent ?? '';
const value = (id: string) => $<HTMLInputElement>(id).value;

let caption = true;
let current: { bytes: number[]; matrix: QrMatrix; lines: string[] } | null = null;

function message(id: string, text: string, isError: boolean): void {
  const el = $(id);
  el.textContent = text;
  el.classList.toggle('err', isError);
  document
    .querySelector(`[aria-describedby="${id.slice(1)}"]`)
    ?.setAttribute('aria-invalid', String(isError));
}

/** Satzende nur, wenn die Meldung noch keines hat */
const sentence = (text: string) => (/[.!?]$/.test(text) ? text : `${text}.`);

function textNote(result: ReturnType<typeof sanitizeSepaText>, max: number): string {
  const parts = [];
  if (result.replacements.length > 0)
    parts.push(`Umgeschrieben: ${replacementsText(result.replacements)}.`);
  if (result.truncated)
    parts.push(`Auf ${max} Zeichen gekürzt (vorher ${result.lengthBeforeTruncation}).`);
  return parts.join(' ');
}

function render(): void {
  for (const b of captionButtons) {
    b.setAttribute('aria-pressed', String((b.dataset.caption === 'yes') === caption));
  }
  current = null;
  let ok = true;

  const name = sanitizeSepaText(value('#epc-name'), EPC_NAME_MAX);
  const nameTouched = value('#epc-name').trim() !== '';
  message(
    '#epc-name-msg',
    name.blank && nameTouched ? 'Gib den Namen des Empfängers ein.' : textNote(name, EPC_NAME_MAX),
    name.blank && nameTouched,
  );
  if (name.blank) ok = false;

  const ibanInput = value('#epc-iban');
  const iban = validateIban(ibanInput);
  if (!iban.ok) {
    ok = false;
    message(
      '#epc-iban-msg',
      ibanInput.trim() === '' ? '' : sentence(ibanMessage(iban)),
      ibanInput.trim() !== '',
    );
  } else {
    message('#epc-iban-msg', '', false);
  }

  const bicInput = value('#epc-bic').trim();
  const bic = bicInput === '' ? null : validateBic(bicInput);
  if (bic && !bic.ok) {
    ok = false;
    message(
      '#epc-bic-msg',
      'Die BIC hat ein ungültiges Format. Lass das Feld leer, wenn du sie nicht brauchst.',
      true,
    );
  } else {
    message('#epc-bic-msg', '', false);
  }

  const amountInput = value('#epc-amount').trim();
  let cents: number | null = null;
  if (amountInput !== '') {
    const amount = parseAmount(amountInput);
    if (amount.ok) {
      cents = amount.cents;
      message('#epc-amount-msg', `Betrag im Code: ${formatEuro(amount.cents)}`, false);
    } else {
      ok = false;
      message(
        '#epc-amount-msg',
        sentence(rowErrorMessage({ code: 'amount', error: amount.code })),
        true,
      );
    }
  } else {
    message('#epc-amount-msg', AMOUNT_HINT, false);
  }

  const text = sanitizeSepaText(value('#epc-text'), EPC_TEXT_MAX);
  message('#epc-text-msg', textNote(text, EPC_TEXT_MAX), false);

  if (ok && iban.ok) {
    const payload = epcPayload({
      version: '002',
      charset: 1,
      bic: bic?.ok ? bic.bic : '',
      name: name.text,
      iban: iban.iban,
      amountCents: cents,
      purposeCode: '',
      reference: '',
      text: text.text,
      info: '',
    });
    const bytes = epcBytes(payload, 1);
    if (bytes.length > EPC_MAX_BYTES) {
      message(
        '#epc-text-msg',
        `Zusammen sind es ${bytes.length} Byte, erlaubt sind ${EPC_MAX_BYTES}. Kürze Name oder Verwendungszweck.`,
        true,
      );
    } else {
      try {
        const matrix = qrMatrix(bytes, { ecc: 'M', maxVersion: EPC_MAX_VERSION });
        const lines = [
          `Empfänger: ${name.text}`,
          `IBAN: ${formatIban(iban.iban)}`,
          ...(bic?.ok ? [`BIC: ${bic.bic}`] : []),
          ...(cents === null ? [] : [`Betrag: ${formatEuro(cents)}`]),
          ...(text.text ? [`Verwendungszweck: ${text.text}`] : []),
        ];
        current = { bytes, matrix, lines };
        drawQr(canvas, matrix, 8);
      } catch (e) {
        if (!(e instanceof QrTooLongError)) throw e;
        message(
          '#epc-text-msg',
          'Die Angaben passen nicht in den Code. Kürze Name oder Verwendungszweck.',
          true,
        );
      }
    }
  }
  canvas.hidden = current === null;
  $('#epc-empty').hidden = current !== null;
  $<HTMLButtonElement>('#epc-png').disabled = current === null;
  $<HTMLButtonElement>('#epc-svg').disabled = current === null;
}

async function png(): Promise<void> {
  if (!current) return;
  const out = document.createElement('canvas');
  drawQr(out, current.matrix, 16, caption ? current.lines : []);
  await savePng(out, 'qr-code-ueberweisung.png');
  showToast('Fertig: Der QR-Code ist gespeichert. Teste ihn vor dem Druck mit deiner Banking-App.');
}

for (const b of captionButtons) {
  b.addEventListener('click', () => {
    caption = b.dataset.caption === 'yes';
    render();
  });
}
document.querySelector('.workspace')?.addEventListener('input', render);
$('#epc-png').addEventListener('click', () => {
  png().catch(() => showToast('Das Bild konnte nicht erzeugt werden. Lade die Seite neu.'));
});
$('#epc-svg').addEventListener('click', () => {
  if (!current) return;
  saveSvg(
    qrSvg(current.bytes, { ecc: 'M', maxVersion: EPC_MAX_VERSION }),
    'qr-code-ueberweisung.svg',
  );
  showToast('Fertig: Der QR-Code ist gespeichert. Teste ihn vor dem Druck mit deiner Banking-App.');
});
render();
