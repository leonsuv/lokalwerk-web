/**
 * Formelschutz für CSV-Ausgabe (CSV-Injection). Excel und LibreOffice führen Zellen als Formel aus,
 * wenn sie mit =, +, @, Tabulator oder Zeilenumbruch beginnen; ein Minus gilt ebenso, außer die Zelle
 * ist eine negative Zahl. Solche Zellen bekommen ein Apostroph vorangestellt, alles andere bleibt
 * unverändert. Die Anzahl wird zurückgegeben, damit das Werkzeug sie anzeigen kann (nichts
 * geschieht stillschweigend). `toCsv` selbst verändert weiterhin keine Werte.
 */

const ALWAYS = /^[=+@\t\r]/;
const NEGATIVE_NUMBER = /^-\d+(?:[.,]\d+)*$/;

export function isFormulaStart(value: string): boolean {
  if (ALWAYS.test(value)) return true;
  return value.startsWith('-') && !NEGATIVE_NUMBER.test(value);
}

export function guardFormulas(rows: readonly (readonly string[])[]): {
  rows: string[][];
  count: number;
} {
  let count = 0;
  const out = rows.map((row) =>
    row.map((value) => {
      if (!isFormulaStart(value)) return value;
      count += 1;
      return `'${value}`;
    }),
  );
  return { rows: out, count };
}
