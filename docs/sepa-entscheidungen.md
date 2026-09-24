# SEPA-Entscheidungen (Schritt 6, Teil 1)

Stand: 24.09.2026. Grundlage: plan.md S1–S10. Die offizielle Quelle entscheidet, nicht der Prototyp. Alle Fundstellen beziehen sich auf die gedruckten Seitenzahlen der Dokumente. Quellen mit Version, Adresse, Abrufdatum und SHA-256 stehen in `tests/fixtures/SOURCES.md`.

Abkürzungen: **A3** = DFÜ-Abkommen Anlage 3 „Spezifikation der Datenformate“ der Deutschen Kreditwirtschaft (DK). **TVS** = DK-Schema `pain.001.001.09_GBIC_5.xsd`. **RB** = EPC SCT Rulebook 2025 v1.1 (EPC125-05). **IG** = EPC SCT Customer-to-PSP Implementation Guidelines 2025 v1.0 (EPC132-08).

## Entscheidungen des Betreibers (24.09.2026)

Die offenen Fragen aus Abschnitt 11 sind entschieden. Maßgeblich ist diese Liste; sie steht auch in plan.md („Entscheidungen nach Schritt 6 Teil 1“).

- **Fassung:** Gebaut wird gegen Anlage 3 **Version 26.11**. Die Regel „kein Textfeld nur aus Leerzeichen“ wird umgesetzt und getestet.
- **O1/O8 Umschreibung:** Die EPC-Tabelle EPC217-08 wird **nicht** übernommen, auch nicht auszugsweise. Die Umschreibung in `src/core/sepa/charset.ts` ist **eigenständig erstellt**: Unicode-Normalisierung (NFD) mit Entfernen der Akzente und eine kurze, selbst geschriebene Liste (Æ→AE, æ→ae, Œ→OE, œ→oe, Ø→O, ø→o, Ł→L, ł→l, Đ→D, đ→d, Þ→TH, þ→th, ẞ→SS). Die EPC-Tabelle wurde nur zum Nachlesen verwendet; es wurden keine Werte oder Strukturen daraus kopiert.
- **O2:** – und — → `-`; „ “ ” ‘ ’ → `'`; … → `...`; geschütztes und andere Leerzeichen → normales Leerzeichen.
- **O3:** `"` → `'`; `<` und `>` → `.`; alle übrigen Zeichen ohne Entsprechung → `.`. Jede Ersetzung erscheint als Warnung in der Zeile.
- **O4:** Leon lädt die SWIFT IBAN Registry selbst nach `.local-specs/`. Bis dahin gelten die Längen aus dem Prototyp; die Stelle ist im Code als offen markiert.
- **O5:** Gibraltar (GI) wird wie die Nicht-EWR-Länder ausgeschlossen. Saint-Pierre-et-Miquelon wird nicht erwähnt.
- **O6:** Kein Kontrollkästchen. `BtchBookg` ist fest `true` (plan.md S8 korrigiert).
- **O7:** Warnung, kein Fehler: „Banken müssen Aufträge mit einem Datum mehr als 15 Tage in der Zukunft nicht annehmen.“
- **O9:** Hinweis, kein Fehler: „Manche Banken lehnen Dateien mit nur einer Überweisung ab. Für eine einzelne Überweisung nutzt du besser direkt dein Onlinebanking.“
- **O10:** Lokaler Ordner `.local-specs/` (in `.gitignore`). Der XSD-Test wird ohne die Dateien mit deutlich sichtbarem Hinweis übersprungen. Bezugsquellen: `docs/lokale-spezifikationen.md`.
- **Zusätzlich:** Jede umgesetzte Textregel aus Anlage 3 bekommt einen eigenen Test, weil das XSD allein nicht reicht.

## Kurzfassung (Stand der Recherche, vor den Entscheidungen)

| Nr. | Frage | Ergebnis | Status |
|---|---|---|---|
| – | Welche Fassung von A3? | Heute gilt 3.9. Ab **15.11.2026** gilt **26.11**. Für pain.001 bei SEPA-Überweisungen sind beide inhaltlich gleich, das Schema GBIC_5 ist dasselbe. Empfehlung: gegen 26.11 bauen. | geklärt |
| S2 | Eigene Bank ohne BIC | `<DbtrAgt>` ist Pflicht. Ohne BIC: `<FinInstnId><Othr><Id>NOTPROVIDED</Id></Othr></FinInstnId>`. Der Prototyp macht das richtig. Die BIC bleibt optional. | geklärt |
| S3 | Zeichensatz | Erlaubt: `A–Z a–z 0–9 ' : ? , - ( + . ) /`, Leerzeichen, dazu `Ä Ö Ü ä ö ü ß & * $ %`. Umschreibung aller anderen Zeichen: offizielle EPC-Tabelle EPC217-08. Sie weicht in Details vom Beispiel in plan.md ab (z. B. Æ→A statt AE). Offene Fragen: O1, O2, O3. | teilweise offen |
| S5 | Länder, IBAN-Längen | Länderliste EPC409-09 v8.0: 30 Länder in EU/EWR, 11 Länder außerhalb des EWR sowie Gebiete. Die SWIFT IBAN Registry konnte ich nicht laden, weil der Server automatische Abrufe blockiert (O4). Gibraltar ist nicht eindeutig zugeordnet (O5). | teilweise offen |
| S6 | Höchstbetrag | 999.999.999,99 € ist bestätigt durch RB und TVS. Mindestbetrag 0,01 €. | geklärt |
| S7 | `CreDtTm` | Ortszeit ohne Zeitzone und ohne Millisekunden ist zulässig. Das Schema hat es mit `xmllint` bestätigt, eine Vorgabe dagegen gibt es nicht. | geklärt |
| S8 | `BtchBookg` | `false` (Einzelbuchung) wirkt nur, wenn die Bank das mit dem Kunden vereinbart hat. Sonst bucht die Bank immer als Sammelbuchung. Das betrifft den Text beim Kontrollkästchen (O6). | Hinweis nötig |
| S9 | Ausführungsdatum | Die Regel aus plan.md passt. Neu: Banken müssen Aufträge nicht verarbeiten, die mehr als 15 Kalendertage vor dem Ausführungsdatum eingehen (O7). | Ergänzung vorgeschlagen |
| – | Anstehende Änderungen im Rulebook | Ab 15.11.2026 sind unstrukturierte Adressen verboten. Das betrifft uns nicht, weil wir im EWR keine Adressen senden. Längere Namen (140 statt 70 Zeichen) sind vorgeschlagen, frühestens ab November 2027, und noch nicht beschlossen. | kein Handlungsbedarf |
| – | Nutzungsbedingungen | Von ebics.de darf nichts ins Repo („nur für persönlichen Gebrauch“). EPC-Dokumente sind nur „für nicht-kommerzielle Zwecke“ frei (O8). | Entscheidung nötig |

---

## 1. Quellen und gültige Fassungen

**Anlage 3 (ebics.de, Seite „Datenformate“, abgerufen 24.09.2026):**
- „Die ab dem 15. November 2026 gültige Spezifikation der Datenformate (Version 26.11 der Anlage 3 des DFÜ-Abkommens)“. Das Dokument ist datiert „Version 26.11 vom 09.04.2026 (Final Version)“.
- Die bis dahin gültige Fassung **3.9** (Final Version vom 12.03.2025) liegt im Archiv. Nach dem Archiv-Hinweis enthält sie auch die CRs, die in 26.11 eingeflossen sind.
- Laut A3 26.11, S. 83, gelten die EPC-Rulebooks von 2025 seit dem 05.10.2025.

**DK-Schema (ebics.de, „Ergänzende Dokumente“):** `pain.001.001.09_GBIC_5.xsd`. Der Kopf der Datei sagt: „SEPA-Überweisungen und Echtzeitüberweisungen gemäß Kapitel 2 der Anlage 3 des DFÜ-Abkommens ab Version V 3.9“, „Diese xsd vom 01.04.2025 wird unter dem Namen CCU_GBIC_5 geführt“. Eine neuere SEPA-TVS-Fassung für 26.11 gibt es nicht.

**EPC:**
- RB 2025 v1.1: ausgegeben und gültig seit 05.10.2025.
- IG 2025 v1.0: gültig seit 05.10.2025.
- Das Rulebook 2027 erscheint laut EPC im November 2026 und gilt ab November 2027. Veröffentlicht ist es noch nicht. Die Konsultation zu den Änderungsanträgen (EPC008-26) habe ich ausgewertet, siehe Abschnitt 9.

## 2. Fassung 3.9 oder 26.11?

Ich habe den Text von Kapitel 2.1 („Festlegungen zu allen Datenformaten“) und Abschnitt 2.2.1 (pain.001.001.09) beider Fassungen automatisch Wort für Wort verglichen. Außerdem habe ich die Change Requests FS-25-02, -04, -07 und -11 gelesen, die in 26.11 umgesetzt wurden.

**Unterschiede für pain.001 (SEPA-Überweisung):**
1. **Neu in 26.11, Kap. 2.1, S. 84, „Belegung von Textfeldern“:** „Sofern Textfelder belegt werden, dürfen diese nicht ausschließlich mit reinen Leerzeichen belegt werden … Der Zahlungsdienstleister behält sich in diesem Fall vor, die gesamte Datei abzuweisen.“
2. Sonst nur redaktionelle Änderungen: Kapitelverweise („2.3.1“ → „2.3.1.1“), die Lage eines Beispiels und „Das Kreditinstitut“ → „Der Zahlungsdienstleister“.
3. Die CRs betreffen den Status-Report (pain.002), den VOP-Status-Report und den Auslandszahlungsverkehr (Kap. 3), nicht die pain.001-Einreichung für SEPA.

**Empfehlung: gegen 26.11 bauen.** Die erzeugten Dateien sind für beide Fassungen gleich. Die Regel aus Punkt 1 ist auch unter 3.9 sinnvoll, weil Banken sonst Clearing-Fehler riskieren. Ab dem 15.11.2026 gilt ohnehin nur noch 26.11.

## 3. S2: Kreditinstitut des Auftraggebers ohne BIC

- **A3 26.11, Kap. 2.2.1.5, S. 104:** `<DbtrAgt>` [1..1]. Zu `<FinInstnId>`: „Diese Gruppe ist im DK-TVS als Choice spezifiziert, da gemäß EPC entweder `<BICFI>` oder `<Othr><Id>` belegt werden muss.“ Zu `<Othr><Id>`: „Falls das BICFI-Feld nicht genutzt wird, ist hier die Konstante NOTPROVIDED anzugeben.“
- **TVS, Typ `BranchAndFinancialInstitutionIdentification6_SCT_SCTinst`:** „Either 'BICFI' or ‘Other/Identification’ must be used.“
- **Geprüft mit `xmllint` gegen das TVS:** Mit `NOTPROVIDED` ist die Datei gültig. Ein leeres `<FinInstnId>` wird abgelehnt.

**Entscheidung nach plan.md:** Die DK sieht eine Form ohne BIC vor, also verwenden wir genau diese. Die BIC des Auftraggebers bleibt optional.

**Empfänger:** Für `<CdtrAgt>` gilt laut IG 2.114 (S. 29): „Only 'BICFI' is allowed. If the BIC is not indicated 'Creditor Agent' structure is not to be used.“ Nach RB AT-C002 (S. 58) ist die BIC des Empfängers nur nötig, wenn eine der beiden Banken außerhalb des EWR sitzt und die Bank sie anfordert. Solche Empfänger schließen wir in Phase 1 aus (S4). Der Prototyp lässt `<CdtrAgt>` ohne BIC weg, das ist richtig.

## 4. S3: Zeichensatz und Umschreibung

### Erlaubte Zeichen

**A3 26.11, Kap. 2.1, S. 84–86:**
- **Grundzeichensatz:** Ziffern, A–Z, a–z, `'` `:` `?` `,` `-` Leerzeichen `(` `+` `.` `)` `/`.
- **Zusätzlich:** „weitere Zeichen zugelassen, für die folgende Regelung gilt: 1. Die Kreditinstitute verpflichten sich zu deren Annahme.“ Das sind die Umlaute `Ä Ö Ü ä ö ü`, `ß`, `&`, `*`, `$` und `%`.
- **Fehler in der Quelle:** Die Tabelle nennt bei `$` die Kodierung „U+0025“. Gemeint ist offensichtlich U+0024, weil U+0025 dort auch bei `%` steht. Wir behandeln `$` (U+0024) als erlaubt.
- **Kodierung:** „Zulässig ist ausschließlich eingeschränkt UTF-8.“ BOM ist nicht zulässig (S. 84).
- **Referenzen und Kennungen** „dürfen … weder mit einem Schrägstrich ‚/‘ beginnen oder enden, noch zwei aufeinanderfolgende Schrägstriche ‚//‘ beinhalten“ (S. 84, Fußnote 8, Verweis auf EPC230-15). Das betrifft MsgId, PmtInfId und EndToEndId. Für diese Kennungen gilt außerdem das Muster aus A3 Kap. 2.3.1.1, S. 253, bzw. dem TVS: nur der Grundzeichensatz, 1–35 Zeichen. Unsere erzeugten Kennungen verwenden nur `A–Z 0–9 -`.

**Ergebnis:** Der Zeichensatz des Prototyps stimmt genau mit A3 überein. Umlaute, `ß`, `& * $ %` **bleiben erhalten**, weil die Banken sie annehmen müssen.

### Umschreibung anderer Zeichen

A3 verweist für Zeichen außerhalb dieses Vorrats auf die „vom EPC bereitgestellten Best Practices als Konvertierungsregel“ (S. 86). Das ist **EPC217-08** mit der **SEPA Conversion Table** (Excel). Nach plan.md S3 hat eine offizielle Umschreibungstabelle Vorrang vor einer eigenen.

Was die Tabelle regelt (EPC217-08, Kap. 6.1, S. 7–8):
- Spalte „conversion to EPC Basic Character Set“ gibt je Zeichen den Ersatz an.
- „‘.’ … denotes that there is no restricted character set equivalent and hence a full stop is to be used“: Zeichen ohne Entsprechung werden also zu einem Punkt, **nicht entfernt**.
- Zeichen außerhalb der Tabelle („red entries“) „can be the basis for a reject or be replaced by a full stop“.

**Abweichungen vom Beispiel in plan.md S3:**

| Zeichen | plan.md (Beispiel) | EPC217-08 |
|---|---|---|
| é | e | e |
| Ł | L | L |
| Ø | O | O |
| **Æ** | **AE** | **A** |
| **Œ** | **OE** | **O** |
| Å | A | A |

Nach plan.md gilt die EPC-Tabelle. Ich melde die Abweichung trotzdem, weil `AE` besser lesbar wäre.

**Was die EPC-Tabelle nicht abdeckt:** Sie reicht von U+0020 bis U+04FF, dazu kommt das Euro-Zeichen (1.089 Einträge). Typografische Zeichen aus dem Bereich U+2000–206F fehlen, also `–` `—` `„` `“` `”` `‚` `‘` `’` `…` und das geschützte Leerzeichen U+00A0. Word und Excel erzeugen solche Zeichen oft automatisch. Nach der EPC-Regel würden sie zu einem Punkt, aus „Miete – März“ würde „Miete . März“. Siehe O2.

> **Entschieden (O1/O8, O2, O3):** Die Umschreibung ist eigenständig erstellt (NFD + eigene Liste, siehe „Entscheidungen des Betreibers“). Die EPC-Tabelle wurde nur zum Nachlesen genutzt.

**Doppelte Anführungszeichen `"`, `<` und `>`** stehen in der Tabelle als „N/A“ (XML-Sonderzeichen). Für `<` und `>` nennt sie U+002E als Ergebnis, für `"` nichts. Siehe O3.

## 5. S5: Länder und IBAN-Längen

**EPC409-09 v8.0 vom 24.12.2025, Kap. 2 und 5, S. 1–5:**
- **EU/EWR (30):** AT BE BG HR CY CZ DK EE FI FR DE GR HU IS IE IT LV LI LT LU MT NL NO PL PT RO SK SI ES SE.
- **Außerhalb des EWR (11):** AL AD MD MC ME MK SM RS CH GB VA. Albanien und Montenegro seit 05.10.2025, Nordmazedonien und Moldau mit demselben Datum, Serbien frühestens ab Mai 2026 (S. 3).
- **Gebiete außerhalb des EWR:** Saint-Pierre-et-Miquelon, Guernsey, Jersey, Isle of Man (S. 2). Guernsey, Jersey und Isle of Man nutzen **GB**-IBANs, Saint-Pierre-et-Miquelon nutzt **FR**-IBANs (Tabelle S. 4–5).
- **Gibraltar (GI)** steht in der IBAN-Tabelle (S. 4), aber weder in der Liste der EU/EWR-Länder noch in der Liste der Länder außerhalb des EWR (S. 1–2). Siehe O5.

**Folgen für S4 (Nicht-EWR ausschließen):**
- Nach IBAN-Ländercode schließen wir AL AD MD MC ME MK SM RS CH GB VA aus, bei vorsichtiger Auslegung auch GI.
- Eine FR-IBAN aus Saint-Pierre-et-Miquelon lässt sich am Ländercode **nicht** erkennen. Dafür bräuchte es die BIC (Ländercode PM) oder die Bankleitzahl in der IBAN. Das ist ein seltener Randfall. Ich schlage vor, ihn im Erklärtext zu nennen, statt ihn technisch abzufangen (O5).

**IBAN-Längen:** Die SWIFT IBAN Registry (swift.com) antwortet auf automatische Abrufe mit „403 – SWIFT site off-line“, per curl und per WebFetch. Die Längen trage ich erst ein, wenn die Registry vorliegt (O4). Die Längen aus dem Prototyp übernehme ich nicht ungeprüft.

## 6. S6: Höchstbetrag

- **RB, AT-T002, S. 59:** „The first part must be larger than or equal to zero euro, and equal to or not larger than 999.999.999 euro. The second part must be … smaller than or equal to 99 euro cents. The combined value of 0,00 euro … is not allowed.“
- **A3 26.11, Kap. 2.3.3, S. 254:** `ActiveOrHistoricCurrencyAndAmount_SCT_SCTinst`, höchstens 11 Stellen, 2 Nachkommastellen, 0.01 bis 999999999.99. „Der Dezimaltrenner ist … ein Punkt.“
- **TVS:** `minInclusive 0.01`, `maxInclusive 999999999.99`, `fractionDigits 2`. Mit `xmllint` bestätigt: 999999999.99 ist gültig, 1000000000.00, 0.00 und drei Nachkommastellen werden abgelehnt.
- **`CtrlSum`:** „Es sind maximal zwei Nachkommastellen zulässig“ (A3 S. 96, S. 100). Eine Obergrenze nennt das TVS für die Summe nicht. Mehrere große Beträge dürfen also zusammen über 999.999.999,99 liegen.

**Ergebnis:** 999.999.999,99 € je Überweisung bleibt, mindestens 0,01 €.

## 7. S7: `CreDtTm`

- **A3 26.11, Kap. 2.2.1.3, S. 95:** `<CreDtTm>` [1..1], Typ ISODateTime, ohne weitere DK-Regel. Das Beispiel auf S. 92 und S. 96 verwendet UTC mit Millisekunden (`2023-11-11T09:30:47.000Z`).
- **A3 Kap. 2.3.4, S. 254:** „ISODateTime: xs:dateTime“.
- **TVS, Definition von ISODateTime:** „expressed in either UTC time format (YYYY-MM-DDThh:mm:ss.sssZ), local time with UTC offset format (YYYY-MM-DDThh:mm:ss.sss+/-hh:mm), or local time format (YYYY-MM-DDThh:mm:ss.sss)“.
- **Geprüft mit `xmllint` gegen das TVS:** Ortszeit ohne Zeitzone (`2026-09-24T21:30:00`), UTC mit Millisekunden und Ortszeit mit Zeitzonen-Angabe sind gültig. Nur ein Datum ohne Uhrzeit wird abgelehnt.

**Ergebnis nach plan.md:** Ortszeit ohne Millisekunden und ohne Zeitzone. Die Spezifikation verlangt oder empfiehlt keine Zeitzone.

## 8. Weitere Befunde für pain.001

Diese Punkte waren nicht gefragt, betreffen aber die Umsetzung in Schritt 7 und 8.

| Thema | Fundstelle | Folge für uns |
|---|---|---|
| **Sammelbuchung (S8)** | A3 S. 99: „Nur wenn eine entsprechende Vereinbarung für Einzelbuchungen mit dem Kunden vorliegt, wird im Falle von Belegung mit false, jede Transaktion einzeln … dargestellt. Andernfalls immer Sammelbuchung (Default/pre-agreed: true).“ | Das Kontrollkästchen braucht einen Hinweis (O6). |
| **Ausführungsdatum (S9)** | A3 S. 102: Fällt der Termin nicht auf einen TARGET-Geschäftstag, darf die Bank den folgenden nehmen. „Banken sind nicht verpflichtet, Auftragsdaten zu verarbeiten, die mehr als 15 Kalendertage VOR dem Ausführungsdatum eingeliefert wurden.“ `<DtTm>` ist „Für SCT nicht zulässig“. | Wir verwenden nur `<Dt>`. Eine Grenze von 15 Tagen gab es in S9 bisher nicht (O7). |
| **Textfelder nur aus Leerzeichen** | A3 26.11 S. 84 (neu gegenüber 3.9) | Ist ein Name nach der Bereinigung leer, ist das ein Fehler. Ein leerer Verwendungszweck wird weggelassen, statt leer geschrieben. |
| **Namen 70, Verwendungszweck 140** | A3 S. 86, 97, 103, 111, 114 | Wie AGENTS.md. Das TVS lässt formal 140 Zeichen für Namen zu, die Begrenzung auf 70 steht nur im Text. |
| **Nur ein Verwendungszweck** | A3 S. 86, 112: entweder `<Ustrd>` oder `<Strd>`, `<Ustrd>` höchstens einmal | Wir schreiben nur `<Ustrd>`. |
| **`<InitgPty>`** | A3 S. 96–97: „Empfehlung: Nur das Unterelement Name sollte verwendet werden.“ | So wie im Prototyp. |
| **Adresse des Auftraggebers** | A3 S. 103: „Es wird empfohlen, diese Feldgruppe nicht zu belegen.“ | Wir senden keine. |
| **`<PmtTpInf>`, `<ChrgBr>`** | A3 S. 100, 105: nur auf Sammler-Ebene, `SEPA` bzw. `SLEV`. `<LclInstrm>` darf bei SCT nicht belegt sein (S. 101). | So wie im Prototyp. |
| **EndToEndId** | A3 S. 108: Empfehlung eindeutig. Ohne Referenz muss `NOTPROVIDED` stehen. | Wir erzeugen eindeutige Kennungen. |
| **Namensraum ohne Präfix** | A3 S. 88: individuelle Präfixe sind unzulässig. | So wie im Prototyp. |
| **XSD reicht nicht** | `xmllint`: `<DtTm>` statt `<Dt>` besteht das TVS, obwohl A3 es verbietet. | Die Textregeln aus A3 brauchen eigene Unit-Tests zusätzlich zum XSD-Test. |
| **Empfängerüberprüfung (VOP)** | A3 S. 91: „Als Opt Out eingereichte Sammler mit nur einer Zahlung können vom ZDL zurückgewiesen werden, da in diesem Falle eine VOP-Prüfung verpflichtend ist.“ | Das betrifft Dateien mit genau einer Überweisung. Wie das Onlinebanking beim Hochladen damit umgeht, entscheidet die Bank (O9). |

## 9. Anstehende Änderungen im SCT-Rulebook

**Adressen (RB v1.1, S. 1, 56, 57; EPC153-22 v2.1, S. 9):**
- „as of 15 November 2026, only the use of a hybrid or a structured address will be allowed“. Das gilt für AT-P005 (Adresse des Auftraggebers) und AT-E004 (Adresse des Empfängers).
- AT-P005 ist nur Pflicht, „when the Originator PSP or the Beneficiary PSP is located in a non-EEA SEPA country or territory“ (RB S. 47, 56). AT-E004 ist „optional“ (RB S. 47).
- EPC153-22, S. 9: „For SEPA payment messages sent between PSPs whereby both … are based in an EEA SEPA country, the provision of the address of the payer is optional“.

**Folge für Phase 1:** Keine. Wir senden innerhalb des EWR gar keine Adressen. Das Verbot unstrukturierter Adressen betrifft uns erst, wenn wir Länder außerhalb des EWR unterstützen. Dann müssen Adressen strukturiert oder hybrid sein, mindestens mit Ort und Land (A3 S. 119–120).

**Konsultation zu den Änderungsanträgen 2026 (EPC008-26 vom 13.03.2026, S. 8–9):** Die Beschlüsse fallen laut EPC „towards the end of the summer of 2026“. Veröffentlicht werden sie mit dem Rulebook 2027 im November 2026, gültig wären sie ab November 2027. Für uns relevant:
- **#04 „Extension of Character Length for Name“:** 70 → 140 Zeichen für Namen. Die Arbeitsgruppe empfiehlt, das aufzunehmen. Wenn beschlossen, ändern sich nur die Implementation Guidelines (S. 13). Die DK müsste nachziehen, erst dann dürften wir längere Namen schreiben.
- **#06:** Wechsel auf eine neuere ISO-20022-Version, empfohlen ab November 2029.
- **#19:** Adressen für Referenzparteien. Diese Elemente nutzen wir nicht.

## 10. Nutzungsbedingungen und Ablage

- **ebics.de** (Nutzungsbedingungen, „Schutzrechte“): „Der Nutzer darf die Inhalte nur im Rahmen der angebotenen Funktionalitäten der Web-Seiten für seinen persönlichen Gebrauch nutzen … Die Rechte liegen beim SIZ und den Verbänden der DK.“ Jedes Dokument trägt „Alle Rechte vorbehalten“.
  - **Folge:** Weder A3 noch TVS noch die DK-Beispiele kommen ins Repo.
- **EPC:** „© … European Payments Council (EPC) AISBL: Reproduction for non-commercial purposes is authorised, with acknowledgement of the source“ (RB S. 1, EPC217-08 S. 1).
  - **Folge:** Keine EPC-Dokumente ins Repo, solange O8 offen ist.
- **SWIFT IBAN Registry:** Die Bedingungen konnte ich nicht lesen, weil die Seite blockiert war (O4).

**Umgesetzt:**
- `tests/fixtures/SOURCES.md` enthält alle Quellen mit Adresse, Version, Abrufdatum und SHA-256.
- Die Dateien selbst liegen nur außerhalb des Repos.
- Mein Vorschlag für Schritt 7 (O10): Das TVS liegt lokal in einem Ordner, den Git ignoriert. `scripts/validate-xsd.sh` überspringt den XSD-Test mit einem Hinweis, wenn die Datei fehlt.

## 11. Offene Fragen an Leon

- **O1 Umschreibung nach EPC217-08:** Soll die Umschreibung genau der EPC-Tabelle folgen, also `Æ→A`, `Œ→O`, `@→.`, `#→.`, `!→.`, `_→-`, `~→-`, `€→E`, und Zeichen ohne Entsprechung werden zu `.`? Das entspricht plan.md S3. Oder willst du bei `Æ/Œ` bewusst `AE/OE`? Das wäre eine eigene Regel entgegen der Tabelle, zulässig wäre beides.
- **O2 Typografische Zeichen:** Die EPC-Tabelle kennt `– — „ “ ” ‚ ‘ ’ …` und das geschützte Leerzeichen nicht. Nach EPC würden sie zu `.`. Mein Vorschlag ist eine kleine, eigene und gekennzeichnete Ergänzung: `– —` → `-`, `„ “ ” ‚ ‘ ’` → `'`, `…` → `...`, geschütztes Leerzeichen → Leerzeichen. Jede Ersetzung wird wie vereinbart als Warnung angezeigt. Einverstanden?
- **O3 `"`, `<`, `>`:** Nicht im erlaubten Zeichensatz, in der EPC-Tabelle „N/A“. Vorschlag: `"` → `'`, `<` und `>` → `.` (wie die Tabelle für `<` und `>` in der Ergebnisspalte). Einverstanden?
- **O4 IBAN Registry:** Bitte lade die aktuelle SWIFT IBAN Registry im Browser als TXT und PDF herunter (swift.com, „IBAN Registry“; laut Websuche ist Release 103 vom September 2026 aktuell). Leg sie mir in den Scratchpad oder sag mir einen Pfad. Schau dabei bitte auch nach den Nutzungsbedingungen. Erst dann trage ich die Längen in `sepa/iban-countries.ts` ein.
- **O5 Randfälle Länder:**
  - Gibraltar ist in EPC409-09 keinem Bereich zugeordnet. Vorschlag: ausschließen wie die Länder außerhalb des EWR, weil Gibraltar seit dem Brexit nicht mehr zur EU gehört.
  - FR-IBANs aus Saint-Pierre-et-Miquelon lassen sich nicht erkennen. Vorschlag: im Erklärtext erwähnen, nicht technisch abfangen.
- **O6 Sammelbuchung (S8):** Das Kontrollkästchen bleibt. Darunter steht ein Hinweis wie „Einzelbuchungen zeigt deine Bank nur, wenn du das mit ihr vereinbart hast.“ Einverstanden, oder das Kontrollkästchen ganz weglassen und immer `true`?
- **O7 Ausführungsdatum mehr als 15 Tage in der Zukunft:** Vorschlag: eine Warnung, kein Fehler, etwa „Deine Bank muss Aufträge, die mehr als 15 Tage vor dem Ausführungstag eingehen, nicht annehmen.“ Einverstanden?
- **O8 EPC-Dokumente und die kommerzielle Nutzung:** Die EPC erlaubt die Vervielfältigung nur für nicht-kommerzielle Zwecke. Zwei Fragen dazu:
  - Dürfen wir die Umschreibungswerte aus EPC217-08 als Tabelle in den Code übernehmen? Ich halte einzelne Zuordnungen wie `é→e` für unproblematisch, eine vollständige Kopie der Tabelle mit 1.089 Einträgen aber für eine Vervielfältigung. Mein Vorschlag: nur die Zeichen übernehmen, die im DACH-Raum und in den EU-Sprachen mit lateinischer Schrift vorkommen, etwa 200 Einträge, mit Quellenangabe. Griechisch und Kyrillisch werden dann zu `.`, mit Warnung. Das ist eine rechtliche Einschätzung, keine Gewissheit. Bitte entscheide oder frag nach.
  - Die EPC-PDFs bleiben außerhalb des Repos. Einverstanden?
- **O9 Datei mit genau einer Überweisung:** Wegen der Empfängerüberprüfung (VOP) können Banken solche Dateien ablehnen, wenn sie ohne VOP eingereicht werden. Vorschlag: ein Hinweis in der Zusammenfassung, wenn nur eine gültige Zeile übrig ist, etwa „Für eine einzelne Überweisung nutzt du am besten direkt dein Onlinebanking.“ Einverstanden?
- **O10 XSD-Test ohne DK-Dateien im Repo:** Das TVS liegt lokal unter `tests/fixtures/sepa/local/`, den Git ignoriert. Du lädst es selbst von ebics.de herunter, eine Anleitung steht in SOURCES.md. Der XSD-Test läuft lokal und wird ohne die Datei übersprungen, im Cloudflare-Build läuft er nicht. Einverstanden?
