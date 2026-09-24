/** Beträge in Cent deutsch formatieren: 123456 → „1.234,56 €“. Rechnet nur mit ganzen Cent. */

export function formatEuro(cents: number): string {
  if (!Number.isSafeInteger(cents)) throw new RangeError(`Ungültiger Betrag: ${cents}`);
  const sign = cents < 0 ? '−' : '';
  const text = String(Math.abs(cents)).padStart(3, '0');
  const euros = text.slice(0, -2).replace(/\B(?=(\d{3})+$)/g, '.');
  return `${sign}${euros},${text.slice(-2)}\u00a0€`;
}
