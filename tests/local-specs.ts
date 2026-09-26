/**
 * Lokale Spezifikationsdateien (.local-specs/, nicht im Repo; docs/lokale-spezifikationen.md).
 * Gemeinsam genutzt von den Tests und vom globalSetup, das einen Hinweis ausgibt, wenn
 * Dateien fehlen.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const DK_XSD = fileURLToPath(
  new URL('../.local-specs/dk/pain.001.001.09_GBIC_5.xsd', import.meta.url),
);
export const DK_EXAMPLE = fileURLToPath(
  new URL('../.local-specs/dk/pain.001.001.09.xml', import.meta.url),
);

function hasXmllint(): boolean {
  try {
    execFileSync('xmllint', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/** Was für die XSD-Prüfung von pain.001 fehlt; leer, wenn alles da ist. */
export function missingForXsdCheck(): string[] {
  return [
    ...(existsSync(DK_XSD) ? [] : ['.local-specs/dk/pain.001.001.09_GBIC_5.xsd']),
    ...(existsSync(DK_EXAMPLE) ? [] : ['.local-specs/dk/pain.001.001.09.xml']),
    ...(hasXmllint() ? [] : ['Programm xmllint']),
  ];
}

/**
 * Beispiele aus EPC069-12 (QR-Code für Überweisungen) und EPC262-08 (Gläubiger-ID). Das EPC erlaubt
 * die Wiedergabe nur für nicht-kommerzielle Zwecke; deshalb lokal (Leon, 26.09.2026).
 */
export const EPC_EXAMPLES = fileURLToPath(
  new URL('../.local-specs/epc/beispiele.json', import.meta.url),
);

export interface EpcExamples {
  epc069_12: {
    quelle: string;
    beispiele: {
      fields: {
        version: '001' | '002';
        charset: number;
        bic: string;
        name: string;
        iban: string;
        amountCents: number | null;
        purposeCode: string;
        reference: string;
        text: string;
        info: string;
      };
      payload: string;
      zeichen: number;
      bytes: number;
      qrVersion: number;
    }[];
  };
  epc262_08: { quelle: string; land: string; national: string; pruefziffer: string; id: string };
}

/** Die EPC-Beispiele, oder null, wenn die Datei fehlt */
export function epcExamples(): EpcExamples | null {
  if (!existsSync(EPC_EXAMPLES)) return null;
  return JSON.parse(readFileSync(EPC_EXAMPLES, 'utf8')) as EpcExamples;
}

/** Was für die Tests mit den EPC-Beispielen fehlt; leer, wenn alles da ist. */
export function missingForEpcExamples(): string[] {
  return existsSync(EPC_EXAMPLES) ? [] : ['.local-specs/epc/beispiele.json'];
}
