/**
 * SEPA-Überweisung als pain.001.001.09 nach DFÜ-Abkommen Anlage 3 Version 26.11, Kap. 2.2.1,
 * und DK-Schema pain.001.001.09_GBIC_5 (docs/sepa-entscheidungen.md).
 *
 * Erwartet geprüfte und bereinigte Daten (transfers.ts). Verstöße gegen die Regeln sind
 * Programmierfehler und werfen sofort, damit nie eine fehlerhafte Datei entsteht.
 *
 * Umgesetzte Regeln aus Anlage 3 26.11 (je Regel ein Test in tests/core/sepa/pain001.test.ts):
 * - UTF-8 ohne BOM, Namensraum ohne Präfix (S. 84, 88)
 * - NbOfTxs und CtrlSum auf Datei- und Sammlerebene, höchstens zwei Nachkommastellen (S. 84, 96, 100)
 * - InitgPty nur mit Name (S. 96–97); Dbtr ohne Postadresse (S. 103)
 * - BtchBookg fest true (S. 99, plan.md S8); PmtTpInf/SvcLvl/Cd = SEPA und ChrgBr = SLEV nur
 *   auf Sammlerebene (S. 100, 105); kein LclInstrm (S. 101)
 * - ReqdExctnDt nur mit Dt, nicht DtTm (S. 102)
 * - DbtrAgt: BICFI oder Othr/Id = NOTPROVIDED (S. 104)
 * - CdtrAgt nur mit BIC, sonst weglassen (EPC IG 2.114)
 * - Kennungen nach Muster und ohne Schrägstrich am Rand bzw. „//“ (S. 84, 253)
 * - Namen höchstens 70, Verwendungszweck höchstens 140 Zeichen, nur unstrukturiert (S. 86, 114)
 * - Textfelder nie leer bzw. nur aus Leerzeichen (S. 84); leerer Zweck wird weggelassen
 */

import { centsToXmlDecimal, MAX_CENTS, MIN_CENTS } from './amount.ts';
import { isAllowedChar, NAME_MAX_LENGTH, PURPOSE_MAX_LENGTH } from './charset.ts';
import { isValidReference } from './ids.ts';
import { escapeXml } from '../xml/escape.ts';

export const PAIN001_NAMESPACE = 'urn:iso:std:iso:20022:tech:xsd:pain.001.001.09';

export interface Pain001Transaction {
  endToEndId: string;
  cents: number;
  name: string;
  iban: string;
  /** leer = ohne BIC */
  bic: string;
  /** leer = ohne Verwendungszweck */
  purpose: string;
}

export interface Pain001Input {
  messageId: string;
  paymentInformationId: string;
  /** Erstellungszeitpunkt, wird als Ortszeit ohne Zeitzone geschrieben (plan.md S7) */
  createdAt: Date;
  /** Ausführungsdatum JJJJ-MM-TT */
  executionDate: string;
  debtor: { name: string; iban: string; bic: string };
  transactions: readonly Pain001Transaction[];
}

const pad = (n: number) => String(n).padStart(2, '0');

function localDateTime(d: Date): string {
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`pain.001: ${message}`);
}

function assertText(text: string, maxLength: number, label: string): void {
  assert(text.trim() !== '', `${label} ist leer`);
  assert(text === text.trim(), `${label} hat Leerzeichen am Rand`);
  assert(text.length <= maxLength, `${label} ist länger als ${maxLength} Zeichen`);
  assert([...text].every(isAllowedChar), `${label} enthält unerlaubte Zeichen`);
}

const assertIban = (iban: string, label: string) =>
  assert(/^[A-Z]{2}[0-9]{2}[A-Z0-9]{1,30}$/.test(iban), `${label}: ungültiges IBAN-Format`);
const assertBic = (bic: string, label: string) =>
  assert(
    bic === '' || /^[A-Z0-9]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(bic),
    `${label}: ungültiges BIC-Format`,
  );

function validate(input: Pain001Input): void {
  assert(input.transactions.length > 0, 'keine Überweisungen');
  assert(isValidReference(input.messageId), 'MsgId ungültig');
  assert(isValidReference(input.paymentInformationId), 'PmtInfId ungültig');
  assert(/^\d{4}-\d{2}-\d{2}$/.test(input.executionDate), 'Ausführungsdatum ungültig');
  assertText(input.debtor.name, NAME_MAX_LENGTH, 'Name des Auftraggebers');
  assertIban(input.debtor.iban, 'Auftraggeber');
  assertBic(input.debtor.bic, 'Auftraggeber');
  const ids = new Set<string>();
  input.transactions.forEach((tx, i) => {
    const label = `Überweisung ${i + 1}`;
    assert(isValidReference(tx.endToEndId), `${label}: EndToEndId ungültig`);
    assert(!ids.has(tx.endToEndId), `${label}: EndToEndId doppelt`);
    ids.add(tx.endToEndId);
    assert(
      Number.isSafeInteger(tx.cents) && tx.cents >= MIN_CENTS && tx.cents <= MAX_CENTS,
      `${label}: Betrag`,
    );
    assertText(tx.name, NAME_MAX_LENGTH, `${label}: Name`);
    assertIban(tx.iban, label);
    assertBic(tx.bic, label);
    if (tx.purpose !== '') assertText(tx.purpose, PURPOSE_MAX_LENGTH, `${label}: Verwendungszweck`);
  });
}

function agent(bic: string, indent: string): string {
  const id = bic === '' ? '<Othr><Id>NOTPROVIDED</Id></Othr>' : `<BICFI>${bic}</BICFI>`;
  return `${indent}<FinInstnId>${id}</FinInstnId>`;
}

export function buildPain001(input: Pain001Input): string {
  validate(input);
  const count = String(input.transactions.length);
  const total = centsToXmlDecimal(input.transactions.reduce((sum, tx) => sum + tx.cents, 0));
  const x = escapeXml;

  const transactions = input.transactions.map((tx) => {
    const lines = [
      '      <CdtTrfTxInf>',
      `        <PmtId><EndToEndId>${x(tx.endToEndId)}</EndToEndId></PmtId>`,
      `        <Amt><InstdAmt Ccy="EUR">${centsToXmlDecimal(tx.cents)}</InstdAmt></Amt>`,
    ];
    if (tx.bic !== '')
      lines.push('        <CdtrAgt>', agent(tx.bic, '          '), '        </CdtrAgt>');
    lines.push(
      `        <Cdtr><Nm>${x(tx.name)}</Nm></Cdtr>`,
      `        <CdtrAcct><Id><IBAN>${tx.iban}</IBAN></Id></CdtrAcct>`,
    );
    if (tx.purpose !== '') lines.push(`        <RmtInf><Ustrd>${x(tx.purpose)}</Ustrd></RmtInf>`);
    lines.push('      </CdtTrfTxInf>');
    return lines.join('\n');
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<Document xmlns="${PAIN001_NAMESPACE}">`,
    '  <CstmrCdtTrfInitn>',
    '    <GrpHdr>',
    `      <MsgId>${x(input.messageId)}</MsgId>`,
    `      <CreDtTm>${localDateTime(input.createdAt)}</CreDtTm>`,
    `      <NbOfTxs>${count}</NbOfTxs>`,
    `      <CtrlSum>${total}</CtrlSum>`,
    `      <InitgPty><Nm>${x(input.debtor.name)}</Nm></InitgPty>`,
    '    </GrpHdr>',
    '    <PmtInf>',
    `      <PmtInfId>${x(input.paymentInformationId)}</PmtInfId>`,
    '      <PmtMtd>TRF</PmtMtd>',
    '      <BtchBookg>true</BtchBookg>',
    `      <NbOfTxs>${count}</NbOfTxs>`,
    `      <CtrlSum>${total}</CtrlSum>`,
    '      <PmtTpInf><SvcLvl><Cd>SEPA</Cd></SvcLvl></PmtTpInf>',
    `      <ReqdExctnDt><Dt>${input.executionDate}</Dt></ReqdExctnDt>`,
    `      <Dbtr><Nm>${x(input.debtor.name)}</Nm></Dbtr>`,
    `      <DbtrAcct><Id><IBAN>${input.debtor.iban}</IBAN></Id></DbtrAcct>`,
    '      <DbtrAgt>',
    agent(input.debtor.bic, '        '),
    '      </DbtrAgt>',
    '      <ChrgBr>SLEV</ChrgBr>',
    ...transactions,
    '    </PmtInf>',
    '  </CstmrCdtTrfInitn>',
    '</Document>',
    '',
  ].join('\n');
}
