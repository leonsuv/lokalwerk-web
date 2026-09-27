/**
 * Unterschrift erstellen: zeichnen oder Bild auswählen, Farbe, weißen Hintergrund entfernen.
 * Gemeinsam für die Werkzeugseite (page.ts) und die PDF-Werkstatt (embed.ts). Die Elemente
 * werden beim Einbinden gesucht, nicht beim Laden des Moduls (plan-phase3.md 7.1). Nichts wird
 * gespeichert (AGENTS.md Regel 5).
 */

import { SignaturePad, signatureFromFile, type SignatureImage } from '../../ui/signature-pad.ts';

export interface SignatureCreator {
  /** Die aktuelle Unterschrift, oder null, solange nichts gezeichnet oder gewählt ist */
  readonly signature: SignatureImage | null;
  /** Knöpfe und Bereiche an den Zustand anpassen */
  render(): void;
  focus(): void;
  /** blob:-Adressen freigeben */
  dispose(): void;
}

function find<T extends HTMLElement>(root: ParentNode, selector: string): T {
  const el = root.querySelector<T>(selector);
  if (!el) throw new Error(`Element ${selector} fehlt`);
  return el;
}

/** `onChange` nach jeder neuen oder entfernten Unterschrift; `notify` für Meldungen */
export function signatureCreator(
  root: ParentNode,
  onChange: (signature: SignatureImage | null) => void,
  notify: (message: string) => void,
): SignatureCreator {
  const sourceButtons = [...root.querySelectorAll<HTMLButtonElement>('button[data-source]')];
  const colorButtons = [...root.querySelectorAll<HTMLButtonElement>('button[data-color]')];
  const whiteButtons = [...root.querySelectorAll<HTMLButtonElement>('button[data-white]')];
  const drawPanel = find(root, '#sig-draw-panel');
  const imagePanel = find(root, '#sig-image-panel');
  const imageInput = find<HTMLInputElement>(root, '#sig-image');

  let source: 'draw' | 'image' = 'draw';
  let removeWhite = true;
  let chosenImage: SignatureImage | null = null;
  let signature: SignatureImage | null = null;

  const render = () => {
    for (const b of sourceButtons) {
      b.setAttribute('aria-pressed', String(b.dataset.source === source));
    }
    for (const b of colorButtons) {
      b.setAttribute('aria-pressed', String(b.dataset.color === pad.color));
    }
    for (const b of whiteButtons) {
      b.setAttribute('aria-pressed', String((b.dataset.white === 'remove') === removeWhite));
    }
    drawPanel.hidden = source !== 'draw';
    imagePanel.hidden = source !== 'image';
  };

  /** Unterschrift aus der gewählten Quelle neu erzeugen */
  const update = async () => {
    const next = source === 'draw' ? (pad.isEmpty ? null : await pad.toImage()) : chosenImage;
    if (signature && signature !== chosenImage && signature !== next) {
      URL.revokeObjectURL(signature.url);
    }
    signature = next;
    render();
    onChange(signature);
  };

  const pad = new SignaturePad(find<HTMLCanvasElement>(root, '#sig-pad'), () => void update());

  for (const b of sourceButtons) {
    b.addEventListener('click', () => {
      source = b.dataset.source === 'image' ? 'image' : 'draw';
      void update();
    });
  }
  for (const b of colorButtons) {
    b.addEventListener('click', () => {
      pad.color = b.dataset.color ?? pad.color;
      render();
    });
  }
  for (const b of whiteButtons) {
    b.addEventListener('click', () => {
      removeWhite = b.dataset.white === 'remove';
      render();
    });
  }
  find(root, '#sig-pad-clear').addEventListener('click', () => pad.clear());
  imageInput.addEventListener('change', () => {
    const [file] = [...(imageInput.files ?? [])];
    imageInput.value = '';
    if (!file) return;
    signatureFromFile(file, removeWhite).then(
      (image) => {
        if (!image) {
          notify('Auf dem Bild ist keine Unterschrift zu erkennen. Wähle ein anderes Bild.');
          return;
        }
        if (chosenImage) URL.revokeObjectURL(chosenImage.url);
        chosenImage = image;
        void update();
      },
      () => notify('Das Bild konnte nicht gelesen werden. Wähle ein PNG- oder JPEG-Bild.'),
    );
  });
  render();

  return {
    get signature() {
      return signature;
    },
    render,
    focus() {
      (
        sourceButtons.find((b) => b.getAttribute('aria-pressed') === 'true') ?? sourceButtons[0]
      )?.focus();
    },
    dispose() {
      for (const image of new Set([signature, chosenImage]))
        if (image) URL.revokeObjectURL(image.url);
      signature = null;
      chosenImage = null;
    },
  };
}
