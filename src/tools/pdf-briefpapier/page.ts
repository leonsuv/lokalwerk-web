/**
 * Werkzeugseite „Briefpapier überlagern“. Gemeinsamer Ablauf: ui/pdf-tool.ts. Das Briefpapier
 * wird als zweite Datei gewählt und zusammen mit den Einstellungen an den Worker gegeben.
 */

import { isPdf } from '../../core/files/classify.ts';
import type { LetterheadPick } from '../../core/pdf/letterhead-geometry.ts';
import { $ } from '../../ui/dom.ts';
import { wireDropzone } from '../../ui/dropzone.ts';
import { mountPdfTool } from '../../ui/pdf-tool.ts';
import { showToast } from '../../ui/toast.ts';
import type { BriefpapierOptions } from './letterhead.worker.ts';

const pickSelect = $<HTMLSelectElement>('#bp-pick');
const fitBox = $<HTMLInputElement>('#bp-fit');
const letterDrop = $('#bp-letter-drop');
const letterInput = $<HTMLInputElement>('#bp-letter-input');
const letterName = $('#bp-letter-name');
const letterClear = $<HTMLButtonElement>('#bp-letter-clear');

/** Das Briefpapier bleibt gewählt, auch wenn der Brief wechselt. */
let letterhead: File | null = null;

// Die Einstellungen werden erst beim Speichern gelesen; nur das Briefpapier braucht render().
const tool = mountPdfTool<BriefpapierOptions>({
  prefix: 'bp',
  worker: new Worker(new URL('./letterhead.worker.ts', import.meta.url), { type: 'module' }),
  busyLabel: 'Wird überlagert …',
  options: () =>
    letterhead === null
      ? null
      : {
          letterhead,
          pick: pickSelect.value as LetterheadPick,
          fit: fitBox.checked,
        },
  suffix: '-briefpapier',
  done: () => 'Fertig: Die neue PDF ist gespeichert.',
  messages: {
    'letterhead-invalid':
      'Das Briefpapier konnte nicht gelesen werden. Es darf nicht verschlüsselt oder beschädigt sein. Speichere es im Ursprungsprogramm erneut als PDF.',
  },
});

function setLetterhead(file: File | null): void {
  letterhead = file;
  letterName.textContent = file ? file.name : 'Noch keine PDF';
  letterClear.disabled = file === null;
  tool.render();
}

function openLetterhead(files: File[]): void {
  const [file] = files.filter(isPdf);
  if (!file) {
    showToast('Nur PDF-Dateien werden übernommen.');
    return;
  }
  if (files.length > 1) showToast('Es wird ein Briefpapier auf einmal verwendet: das erste.');
  setLetterhead(file);
}

wireDropzone(letterDrop, letterInput, openLetterhead);
letterClear.addEventListener('click', () => {
  setLetterhead(null);
  letterInput.focus();
});

export const { openFiles } = tool;
