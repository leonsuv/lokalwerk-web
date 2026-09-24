/** Kleine DOM-Helfer. Ein fehlendes Element ist ein Programmierfehler und wirft sofort. */

export function $<T extends Element = HTMLElement>(
  selector: string,
  root: ParentNode = document,
): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Element fehlt: ${selector}`);
  return element;
}

export function $$<T extends Element = HTMLElement>(
  selector: string,
  root: ParentNode = document,
): T[] {
  return [...root.querySelectorAll<T>(selector)];
}
