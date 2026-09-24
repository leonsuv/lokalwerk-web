/**
 * Ablagefläche: ein <label> mit versteckter Datei-Eingabe, dazu Ziehen und Ablegen.
 * Der sichtbare Tastaturfokus kommt aus components.css (:has(input:focus-visible)).
 */

export function wireDropzone(
  zone: HTMLElement,
  input: HTMLInputElement,
  onFiles: (files: File[]) => void,
): void {
  input.addEventListener('change', () => {
    const files = [...(input.files ?? [])];
    input.value = '';
    if (files.length > 0) onFiles(files);
  });

  // Zähler statt einfachem dragleave, sonst flackert die Markierung über Kindelementen.
  let depth = 0;
  zone.addEventListener('dragenter', (event) => {
    event.preventDefault();
    depth += 1;
    zone.classList.add('over');
  });
  zone.addEventListener('dragover', (event) => {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  });
  zone.addEventListener('dragleave', () => {
    depth = Math.max(0, depth - 1);
    if (depth === 0) zone.classList.remove('over');
  });
  zone.addEventListener('drop', (event) => {
    event.preventDefault();
    event.stopPropagation();
    depth = 0;
    zone.classList.remove('over');
    const files = [...(event.dataTransfer?.files ?? [])];
    if (files.length > 0) onFiles(files);
  });
}

/**
 * Verhindert, dass der Browser eine knapp neben der Ablagefläche fallen gelassene Datei
 * selbst öffnet und die Seite samt Arbeitsstand verlässt.
 */
export function preventAccidentalFileOpen(): void {
  window.addEventListener('dragover', (event) => event.preventDefault());
  window.addEventListener('drop', (event) => event.preventDefault());
}
