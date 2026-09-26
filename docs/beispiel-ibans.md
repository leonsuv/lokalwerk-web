# Beispiel-IBANs im Repo

Stand: 26.09.2026. Vorgabe von Leon (26.09.2026): Im Repo stehen nur dokumentierte Musternummern oder IBANs mit einer Bankleitzahl, die laut aktueller Bankleitzahlendatei der Deutschen Bundesbank nicht vergeben ist. Jede Beispiel-IBAN in Code, Tests und docs steht in dieser Liste mit ihrer Herkunft. Neue Beispiel-IBANs nur nach denselben Regeln und mit Eintrag hier.

Geprüft mit der Bankleitzahlendatei der Bundesbank (TXT, gültig vom 07.09.2026 bis 06.12.2026, abgerufen am 26.09.2026 von bundesbank.de, SHA-256 `5872bf19298f55cc0594d22656b72e0f8ff277faedbf5b18f9b7f3bcae4c606b`, 3.507 Bankleitzahlen). Die Datei liegt nicht im Repo. Die Liste der Bankleitzahl-Löschungen zum 07.09.2026 enthält keine Einträge.

## Dokumentierte Musternummern

| IBAN | Herkunft | Verwendet in |
|---|---|---|
| DE89 3704 0044 0532 0130 00 | Landesbeispiel für Deutschland in der SWIFT IBAN Registry; von Leon als weithin veröffentlichtes Beispiel freigegeben (26.09.2026). Nachweis in der Registry offen, bis sie in `.local-specs/swift/` liegt (plan.md O4) | Beispieldaten SEPA, viele Tests |
| DE87 2005 0000 1234 5678 90 | DFÜ-Abkommen Anlage 3, Version 26.11 (PDF-Seiten 98, 110, 131 u. a.) und DK-Beispieldatei `pain.001.001.09.xml` | `tests/core/sepa/iban.test.ts`, `pain001-xsd.test.ts` |
| DE21 5005 0000 9876 5432 10 | Anlage 3, Version 26.11 (PDF-Seiten 98, 111, 132 u. a.) und DK-Beispieldatei | `tests/core/sepa/iban.test.ts` |
| DE21 5005 0000 1234 5678 97 | Anlage 3, Version 26.11 (PDF-Seiten 98, 111, 133, 146) und DK-Beispieldatei | `tests/core/sepa/iban.test.ts` |
| DE25 3705 0299 1000 1223 43 | Anlage 3, Version 26.11 (PDF-Seite 117) | `tests/core/sepa/iban.test.ts` |
| AT61 1904 3002 3457 3201 | Landesbeispiel für Österreich in der SWIFT IBAN Registry; Nachweis offen (O4) | Beispieldaten SEPA, `pain001`- und `transfers`-Tests |
| CH93 0076 2011 6238 5295 7 | Landesbeispiel für die Schweiz in der SWIFT IBAN Registry; Nachweis offen (O4) | `iban-list`- und `transfers`-Tests |
| GB29 NWBK 6016 1331 9268 19 | Landesbeispiel für das Vereinigte Königreich in der SWIFT IBAN Registry; Nachweis offen (O4) | `tests/core/sepa/transfers.test.ts` |

Die Seitenangaben zur Anlage 3 zählen die Seiten der PDF-Datei; der Testkommentar in `iban.test.ts` nennt die gedruckten Seitenzahlen. Die Anlage 3 selbst liegt nicht im Repo (Nutzungsbedingungen ebics.de).

## Absichtlich ungültige Abwandlungen

Für Tests, die Fehler erkennen sollen; jeweils aus einer Nummer oben abgeleitet.

| Wert | Abwandlung von | Zweck |
|---|---|---|
| DE89 3704 0044 0532 0130 01 | DE89 … 0130 00 | letzte Ziffer geändert, Prüfziffer falsch |
| DE89 3704 0044 0532 0310 00 | DE89 … 0130 00 | zwei Ziffern vertauscht |
| DE89 3704 0044 0532 0130 0 | DE89 … 0130 00 | eine Stelle zu kurz |
| DE89 3704 0044 | DE89 … 0130 00 | unvollständige Eingabe, Anzeigebeispiel im Kommentar von `src/core/sepa/iban.ts` |
| CH94 0076 2011 6238 5295 7 | CH93 … | Prüfziffer geändert |
| DE69 2345 6789 1234 5678 01 | DE69 2345 6789 1234 5678 00 | letzte Ziffer geändert; steht bewusst als fehlerhafte Zeile in den SEPA-Beispieldaten |

## Eigene IBANs mit nicht vergebener Bankleitzahl

Prüfziffer nach ISO 13616 (Mod 97-10) berechnet. Die Bankleitzahlen stehen nicht in der Bankleitzahlendatei (Stand oben). Ersetzen seit 26.09.2026 frühere Beispiele mit vergebenen Bankleitzahlen, auch in der Git-Historie.

| IBAN | Bankleitzahl | Verwendet in |
|---|---|---|
| DE89 1234 5678 1049 6387 12 | 12345678 | SEPA-Beispieldaten („Kiosk am Markt GmbH“), Prototyp, Tests |
| DE69 2345 6789 1234 5678 00 | 23456789 | Auftraggeber in den SEPA-Beispieldaten, Prototyp, Tests, eigenes EPC-QR-Beispiel |
| DE50 3456 7890 0123 4567 89 | 34567890 | SEPA-Beispieldaten („Anna Beispiel“), Prototyp, Tests, eigenes EPC-QR-Beispiel |
| DE15 8765 4321 0000 2020 51 | 87654321 | `tests/core/sheet/values.test.ts` (IBAN-Text wird nicht als Zahl gelesen) |

## Kein IBAN, aber ähnlich aufgebaut

| Wert | Herkunft |
|---|---|
| DE00ZZZ00000000000 | Platzhalter im Eingabefeld „Gläubiger-ID prüfen“, zeigt nur den Aufbau; absichtlich ungültig |
| DE79ZZZ01234567890 | eigene Gläubiger-ID, Prüfziffer unabhängig nachgerechnet (`tests/core/sepa/creditor-id.test.ts`) |

Weitere Test-IBANs erzeugen die Tests zur Laufzeit mit berechneter Prüfziffer (z. B. `withCheckDigits` in `tests/core/sepa/iban.test.ts`); sie stehen nicht wörtlich im Repo.

## Nicht mehr im Repo

Die Beispiele aus EPC069-12 (QR-Code für Überweisungen, Kap. 2.3) und EPC262-08 (Gläubiger-ID, Kap. 8.1.15) mit ihren IBANs und Namen liegen seit 26.09.2026 nur lokal in `.local-specs/epc/beispiele.json` (docs/lokale-spezifikationen.md). Das EPC erlaubt die Wiedergabe nur für nicht-kommerzielle Zwecke.
