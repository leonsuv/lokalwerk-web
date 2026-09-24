# Quellen der Testdaten und Spezifikationen

Offizielle Dokumente, auf die sich Tests und `docs/sepa-entscheidungen.md` stützen (AGENTS.md Abschnitt 5, plan.md S1). Dateien, deren Nutzungsbedingungen eine Weitergabe ausschließen oder nur für nicht-kommerzielle Zwecke erlauben, liegen **nicht** im Repo. Hier stehen dann nur Adresse, Version, Abrufdatum und SHA-256, damit sich prüfen lässt, ob eine lokal geladene Datei dieselbe ist.

Abgerufen am 24.09.2026.

## Im Repo

| Datei | Herkunft |
|---|---|
| `pdf/*.pdf` | Selbst erzeugt mit macOS CoreGraphics, Skript `pdf/erzeuge-fixtures.swift` |
| `images/*.jpg` | Selbst erzeugt mit macOS ImageIO, Skript `images/erzeuge-fixtures.swift` |

## Nicht im Repo: Deutsche Kreditwirtschaft (ebics.de)

Nutzungsbedingungen ebics.de, „Schutzrechte“: „Der Nutzer darf die Inhalte nur im Rahmen der angebotenen Funktionalitäten der Web-Seiten für seinen persönlichen Gebrauch nutzen … Die Rechte liegen beim SIZ und den Verbänden der DK.“

Die Download-Adressen auf ebics.de sind zeitlich begrenzte Links. Deshalb steht hier die Seite, auf der die Datei angeboten wird.

| Dokument | Version / Stand | Seite | SHA-256 |
|---|---|---|---|
| Anlage 3 „Spezifikation der Datenformate“ (`Anlage_3_Datenformate_V26.11.pdf`) | 26.11 vom 09.04.2026, gültig ab 15.11.2026 | https://www.ebics.de/de/datenformate | `f24aa4b83665155c4a744970b7ed71e6dd827e39b8d7f47ea34a7ed4dcc75f3e` |
| Anlage 3 mit Änderungsmarkierung (`Anlage_3_Datenformate_V26.11mAE.pdf`) | 26.11 | https://www.ebics.de/de/datenformate | `7f672af13b264af5e6fc1c876c304dc4e4fb446840f403736218e3e0e7d68eb5` |
| Archiv Anlage 3 V3.9 inkl. CRs für 26.11 (`Anlage3_Archiv_V3_9.zip`) | 3.9 vom 12.03.2025 | https://www.ebics.de/de/datenformate/archiv | `9bc53b320961d13ba8ad733246376bbc5d706da731872e78f49d88854335c3a2` |
| DK-TVS SEPA (`DK-TVS_SEPA_GBIC_5zzglISO_Originale.zip`) | GBIC_5 | https://www.ebics.de/de/datenformate/ergaenzende-dokumente | `dabcb6e0329a746726bad92dda2a6f7aec1ddad0d5796d643bbc40d896206ace` |
| darin `pain.001.001.09_GBIC_5.xsd` | „vom 01.04.2025“, „ab Version V 3.9“ | (im ZIP) | `d64da6e1553cf8dd38f98818fe3234fb79daec792d0a69483a1ab8e90dec8b8c` |
| XML-Beispiele SEPA (`XML-Beispiele_SEPA.zip`) | ISO-Version 2019 | https://www.ebics.de/de/datenformate/ergaenzende-dokumente | `07ce3e5c3c0fa7ee3436ea7ca5c3d62a595e53f3dd5a101caad8f322f87718d3` |
| darin `pain.001.001.09.xml` | – | (im ZIP) | `8a4dd9d04dee9286090cebc9263bad4b5ffdbfdfc8f21eccbe70c85d1c8df016` |

## Nicht im Repo: European Payments Council (europeanpaymentscouncil.eu)

Copyright-Vermerk der EPC-Dokumente: „Reproduction for non-commercial purposes is authorised, with acknowledgement of the source.“ Solange offen ist, ob das für Lokalwerk passt (`docs/sepa-entscheidungen.md`, O8), kommen die Dateien nicht ins Repo.

| Dokument | Version / Stand | Adresse | SHA-256 |
|---|---|---|---|
| EPC125-05 SCT Scheme Rulebook | 2025 v1.1, gültig ab 05.10.2025 | https://www.europeanpaymentscouncil.eu/sites/default/files/kb/file/2025-09/EPC125-05%202025%20SCT%20Rulebook%20version%201.1.pdf | `2440a89b09fc8799fe6d5cb7a065577c2cf9166d947dfa5550e5e8c2b1c354ea` |
| EPC132-08 SCT Customer-to-PSP Implementation Guidelines | 2025 v1.0, gültig ab 05.10.2025 | https://www.europeanpaymentscouncil.eu/sites/default/files/kb/file/2025-10/EPC132-08%20SCT%20C2PSP%20IG%202025%20V1.0.pdf | `0719e0fd8482b69dcbceec2f6e8aa70306e6a3d740317fa5819c83c63aa6ef95` |
| EPC409-09 EPC List of SEPA Scheme Countries | v8.0 vom 24.12.2025 | https://www.europeanpaymentscouncil.eu/sites/default/files/kb/file/2025-12/EPC409-09%20EPC%20List%20of%20SEPA%20Scheme%20Countries%20v8.0.pdf | `852aba867990351a28f822d8d796f01371ed111e5024db3102290ccf2adb2f93` |
| EPC217-08 Best Practices Extended Character Set | v1.1 | https://www.europeanpaymentscouncil.eu/sites/default/files/KB/files/EPC217-08%20Draft%20Best%20Practices%20SEPA%20Requirements%20for%20Character%20Set%20v1.1.pdf | `fff3c417a928a1a9e96a98f1554c0cac2de5dc40879f8a6b4db799767c2b77a2` |
| EPC217-08 SEPA Conversion Table | Excel, 1.089 Zeichen (U+0020–U+04FF, U+20AC) | https://www.europeanpaymentscouncil.eu/sites/default/files/KB/files/EPC217-08-SEPA-Conversion-Table.xls | `44d1bb47e3f47db6307e5db6828c73d29b31f2bc1a2d117303c04cdcb57be149` |
| EPC153-22 Guidance: Provision of Addresses | v2.1 vom 05.10.2025 | https://www.europeanpaymentscouncil.eu/sites/default/files/kb/file/2025-10/EPC153-22%20v2.1%20EPC%20guidance%20document%20-%20Provision%20of%20Addresses%20under%20the%20EPC%20Payment%20Schemes.pdf | `2eee3203fbf568a596a56c739e0c80ffc4d77f0d269ecc86451031061348f10a` |
| EPC230-15 Clarification Paper on the Use of Slashes | v2.0 vom 16.02.2023 | https://www.europeanpaymentscouncil.eu/sites/default/files/kb/file/2023-02/EPC230-15%20v2.0%20Clarification%20Paper%20on%20the%20Use%20of%20Slashes%20in%20References%20Identifications%20and%20Identifiers.pdf | `50fc8e206cc3090747224fcac6b722224871ab8f70264ec6022f7c12384a7687` |
| EPC008-26 SCT Rulebook, Public Consultation on 2026 Change Requests | v1.0 vom 13.03.2026 | https://www.europeanpaymentscouncil.eu/sites/default/files/kb/file/2026-03/EPC008-26%20SCT%20Scheme%20Rulebook%20-%20Public%20Consultation%20Document%20on%202026%20Change%20Requests.pdf | `349dc4a243d538eea867cf844170fa92522c4e1c8f4142568937bf26501d253f` |

Die Übersichtsseiten des EPC lassen sich nicht automatisch abrufen (Bot-Schutz). Die direkten PDF-Adressen oben funktionieren.

## Noch nicht vorhanden

| Dokument | Grund |
|---|---|
| SWIFT IBAN Registry (swift.com) | swift.com antwortet auf automatische Abrufe mit „403 – SWIFT site off-line“. Muss manuell im Browser geladen werden (`docs/sepa-entscheidungen.md`, O4). |
