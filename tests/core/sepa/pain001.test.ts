import { describe, expect, it } from 'vitest';
import { buildPain001 } from '../../../src/core/sepa/pain001.ts';
import { input, tx } from './pain001-input.ts';

const xml = buildPain001(input());
const elements = (text: string, tag: string) =>
  [...text.matchAll(new RegExp(`<${tag}>([^<]*)</${tag}>`, 'g'))].map((m) => m[1]);

describe('buildPain001: Referenzausgabe', () => {
  it('erzeugt genau diese Datei', () => {
    expect(xml).toBe(`<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.09">
  <CstmrCdtTrfInitn>
    <GrpHdr>
      <MsgId>LW2026092421300501AZ0Z</MsgId>
      <CreDtTm>2026-09-24T21:30:05</CreDtTm>
      <NbOfTxs>2</NbOfTxs>
      <CtrlSum>165.50</CtrlSum>
      <InitgPty><Nm>Förderverein Beispiel e.V.</Nm></InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>LW2026092421300501AZ0Z-P1</PmtInfId>
      <PmtMtd>TRF</PmtMtd>
      <BtchBookg>true</BtchBookg>
      <NbOfTxs>2</NbOfTxs>
      <CtrlSum>165.50</CtrlSum>
      <PmtTpInf><SvcLvl><Cd>SEPA</Cd></SvcLvl></PmtTpInf>
      <ReqdExctnDt><Dt>2026-09-25</Dt></ReqdExctnDt>
      <Dbtr><Nm>Förderverein Beispiel e.V.</Nm></Dbtr>
      <DbtrAcct><Id><IBAN>DE69234567891234567800</IBAN></Id></DbtrAcct>
      <DbtrAgt>
        <FinInstnId><Othr><Id>NOTPROVIDED</Id></Othr></FinInstnId>
      </DbtrAgt>
      <ChrgBr>SLEV</ChrgBr>
      <CdtTrfTxInf>
        <PmtId><EndToEndId>LW2026092421300501AZ0Z-1</EndToEndId></PmtId>
        <Amt><InstdAmt Ccy="EUR">120.00</InstdAmt></Amt>
        <Cdtr><Nm>Sportverein Musterstadt e.V.</Nm></Cdtr>
        <CdtrAcct><Id><IBAN>DE89370400440532013000</IBAN></Id></CdtrAcct>
        <RmtInf><Ustrd>Hallenmiete September</Ustrd></RmtInf>
      </CdtTrfTxInf>
      <CdtTrfTxInf>
        <PmtId><EndToEndId>LW2026092421300501AZ0Z-2</EndToEndId></PmtId>
        <Amt><InstdAmt Ccy="EUR">45.50</InstdAmt></Amt>
        <CdtrAgt>
          <FinInstnId><BICFI>COBADEFFXXX</BICFI></FinInstnId>
        </CdtrAgt>
        <Cdtr><Nm>Gärtnerei Grün &amp; Söhne</Nm></Cdtr>
        <CdtrAcct><Id><IBAN>AT611904300234573201</IBAN></Id></CdtrAcct>
      </CdtTrfTxInf>
    </PmtInf>
  </CstmrCdtTrfInitn>
</Document>
`);
  });
});

describe('buildPain001: Regeln aus Anlage 3 Version 26.11', () => {
  it('S. 84: UTF-8-Deklaration, kein BOM', () => {
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml.codePointAt(0)).not.toBe(0xfeff);
  });

  it('S. 88: Namensraum ohne Präfix, keine weiteren Namensräume', () => {
    expect(xml).toContain('<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.09">');
    expect(xml).not.toMatch(/xmlns:/);
    expect(xml).not.toMatch(/<\w+:\w+/);
  });

  it('S. 84, 96, 100: NbOfTxs und CtrlSum auf Datei- und Sammlerebene stimmen', () => {
    expect(elements(xml, 'NbOfTxs')).toEqual(['2', '2']);
    expect(elements(xml, 'CtrlSum')).toEqual(['165.50', '165.50']);
  });

  it('S. 96, 100, 110: Beträge mit Punkt und genau zwei Nachkommastellen', () => {
    for (const amount of [
      ...elements(xml, 'CtrlSum'),
      ...[...xml.matchAll(/Ccy="EUR">([^<]*)</g)].map((m) => m[1]),
    ]) {
      expect(amount).toMatch(/^\d+\.\d{2}$/);
    }
  });

  it('S. 96–97: InitgPty nur mit Name', () => {
    expect(xml).toMatch(/<InitgPty><Nm>[^<]+<\/Nm><\/InitgPty>/);
  });

  it('S. 99 und plan.md S8: BtchBookg fest true', () => {
    expect(elements(xml, 'BtchBookg')).toEqual(['true']);
  });

  it('S. 100, 105, 109–110: PmtTpInf und ChrgBr nur auf Sammlerebene, SEPA und SLEV', () => {
    expect(xml.match(/<PmtTpInf>/g)).toHaveLength(1);
    expect(xml.match(/<ChrgBr>/g)).toHaveLength(1);
    expect(xml.indexOf('<PmtTpInf>')).toBeLessThan(xml.indexOf('<CdtTrfTxInf>'));
    expect(xml.indexOf('<ChrgBr>')).toBeLessThan(xml.indexOf('<CdtTrfTxInf>'));
    expect(elements(xml, 'Cd')).toEqual(['SEPA']);
    expect(elements(xml, 'ChrgBr')).toEqual(['SLEV']);
  });

  it('S. 101: kein LocalInstrument bei SCT', () => {
    expect(xml).not.toContain('LclInstrm');
  });

  it('S. 102: Ausführungstermin nur mit Dt, nie DtTm (das DK-Schema würde DtTm zulassen)', () => {
    expect(xml).toContain('<ReqdExctnDt><Dt>2026-09-25</Dt></ReqdExctnDt>');
    expect(xml).not.toContain('<DtTm>');
  });

  it('S. 103: keine Postadresse des Auftraggebers', () => {
    expect(xml).not.toContain('PstlAdr');
  });

  it('S. 104: DbtrAgt ohne BIC mit NOTPROVIDED', () => {
    expect(xml).toContain(
      '<DbtrAgt>\n        <FinInstnId><Othr><Id>NOTPROVIDED</Id></Othr></FinInstnId>\n      </DbtrAgt>',
    );
  });

  it('S. 104: DbtrAgt mit BIC als BICFI', () => {
    const withBic = buildPain001(
      input({ debtor: { name: 'V', iban: 'DE89370400440532013000', bic: 'GENODEM1GLS' } }),
    );
    expect(withBic).toContain(
      '<DbtrAgt>\n        <FinInstnId><BICFI>GENODEM1GLS</BICFI></FinInstnId>',
    );
    expect(withBic).not.toContain('NOTPROVIDED');
  });

  it('EPC IG 2.114: CdtrAgt nur mit BIC, sonst weggelassen', () => {
    expect(xml.match(/<CdtrAgt>/g)).toHaveLength(1);
    expect(xml).toContain('<BICFI>COBADEFFXXX</BICFI>');
  });

  it('S. 108: jede EndToEndId eindeutig', () => {
    const ids = elements(xml, 'EndToEndId');
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('S. 84, 86, 112, 114: Verwendungszweck nur unstrukturiert, höchstens einmal, leerer Zweck weggelassen', () => {
    expect(xml).not.toContain('<Strd>');
    expect(xml.match(/<RmtInf>/g)).toHaveLength(1);
  });

  it('S. 84: XML-Sonderzeichen werden maskiert', () => {
    expect(xml).toContain('Gärtnerei Grün &amp; Söhne');
    const quoted = buildPain001(input({ transactions: [tx({ purpose: "Rechnung O'Neill" })] }));
    expect(quoted).toContain('<Ustrd>Rechnung O&apos;Neill</Ustrd>');
  });

  it('plan.md S7: CreDtTm als Ortszeit ohne Zeitzone und ohne Millisekunden', () => {
    expect(elements(xml, 'CreDtTm')).toEqual(['2026-09-24T21:30:05']);
  });
});

describe('buildPain001: verweigert fehlerhafte Eingaben (nie eine falsche Datei)', () => {
  it.each([
    ['keine Überweisungen', input({ transactions: [] })],
    ['leerer Name (S. 84)', input({ transactions: [tx({ name: '   ' })] })],
    ['Name mit Leerzeichen am Rand', input({ transactions: [tx({ name: ' A' })] })],
    ['Name länger als 70 (S. 86)', input({ transactions: [tx({ name: 'N'.repeat(71) })] })],
    ['Zweck länger als 140 (S. 114)', input({ transactions: [tx({ purpose: 'P'.repeat(141) })] })],
    ['unerlaubtes Zeichen (S. 85)', input({ transactions: [tx({ name: 'Café' })] })],
    ['Betrag 0', input({ transactions: [tx({ cents: 0 })] })],
    ['Betrag zu hoch', input({ transactions: [tx({ cents: 100_000_000_000 })] })],
    ['Betrag kein ganzer Cent', input({ transactions: [tx({ cents: 12.5 })] })],
    ['doppelte EndToEndId', input({ transactions: [tx(), tx()] })],
    ['EndToEndId mit // (S. 84)', input({ transactions: [tx({ endToEndId: 'a//b' })] })],
    ['MsgId zu lang', input({ messageId: 'M'.repeat(36) })],
    ['IBAN nicht normalisiert', input({ transactions: [tx({ iban: 'de89 3704' })] })],
    ['BIC falsch', input({ transactions: [tx({ bic: 'XYZ' })] })],
    ['Datum falsch', input({ executionDate: '25.09.2026' })],
  ])('%s', (_label, data) => {
    expect(() => buildPain001(data)).toThrow(/^pain\.001: /);
  });
});
