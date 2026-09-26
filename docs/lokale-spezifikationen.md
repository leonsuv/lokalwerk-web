# Lokale Spezifikationen (`.local-specs/`)

Einige Tests brauchen offizielle Dateien, die wegen ihrer Nutzungsbedingungen nicht ins Repo dürfen (plan.md O10, `docs/sepa-entscheidungen.md` Abschnitt 10). Sie liegen lokal im Ordner `.local-specs/` im Projektordner. Der Ordner steht in `.gitignore`.

Fehlen die Dateien, werden die betroffenen Tests übersprungen. Die Testausgabe zeigt das deutlich an. Alle übrigen Tests laufen normal.

Mit SHA-256 prüfst du, ob eine geladene Datei dieselbe ist, gegen die entwickelt wurde (Werte in `tests/fixtures/SOURCES.md`):

```sh
shasum -a 256 .local-specs/dk/*
```

## Aufbau

```
.local-specs/
├─ dk/
│  ├─ pain.001.001.09_GBIC_5.xsd   DK-Schema (TVS) für SEPA-Überweisungen
│  └─ pain.001.001.09.xml          DK-Beispieldatei
├─ epc/
│  └─ beispiele.json               Beispiele aus EPC069-12 Kap. 2.3 und EPC262-08 Kap. 8.1.15
├─ swift/
│  └─ iban-registry.txt            SWIFT IBAN Registry (TXT-Fassung)
└─ ecma376/                        ECMA-376 Teil 1 und 4, 5. Ausgabe, nur zum Nachlesen (kein Test)
```

## Bezugsquellen

### DK-Schema und Beispiel (Deutsche Kreditwirtschaft)

1. https://www.ebics.de/de/datenformate/ergaenzende-dokumente öffnen.
2. Unter „Zu den Kapiteln 2, 9 und 11: SEPA-Zahlungsverkehr“:
   - `DK-TVS_SEPA_GBIC_5zzglISO_Originale.zip` laden, daraus `pain.001.001.09_GBIC_5.xsd` nach `.local-specs/dk/` kopieren.
   - `XML-Beispiele_SEPA.zip` laden, daraus `pain.001.001.09.xml` nach `.local-specs/dk/` kopieren.
3. Nutzung laut ebics.de nur für den persönlichen Gebrauch. Nicht weitergeben, nicht ins Repo.

Stand 24.09.2026: Das TVS ist „vom 01.04.2025“ und gilt „ab Version V 3.9“ der Anlage 3, unverändert auch für Version 26.11.

### SWIFT IBAN Registry

1. https://www.swift.com/standards/data-standards/iban-international-bank-account-number im Browser öffnen. Automatische Abrufe blockiert swift.com.
2. „IBAN Registry“ als TXT laden und als `.local-specs/swift/iban-registry.txt` ablegen. Die PDF-Fassung kann zum Nachlesen daneben liegen.
3. Release-Nummer und Datum der Registry sowie ihre Nutzungsbedingungen in `tests/fixtures/SOURCES.md` eintragen.

Sobald die Datei da ist, werden die IBAN-Längen in `src/core/sepa/iban-countries.ts` gegen die Registry geprüft und die Markierung „offen“ entfernt (plan.md O4).

### EPC-Dokumente und -Beispiele

Adressen und Versionen der Dokumente stehen in `tests/fixtures/SOURCES.md`; die PDFs selbst werden für Tests nicht gebraucht.

Die Beispiele aus EPC069-12 (QR-Code für Überweisungen, Kap. 2.3, zwei Beispiele) und EPC262-08 (Gläubiger-ID, Kap. 8.1.15) liegen seit 26.09.2026 nicht mehr im Repo, sondern in `.local-specs/epc/beispiele.json`, weil das EPC die Wiedergabe nur für nicht-kommerzielle Zwecke erlaubt (Leon, 26.09.2026). Fehlt die Datei, werden die Tests damit übersprungen (Hinweis beim Testlauf); eigene Beispiele in `tests/core/sepa/epc-qr.test.ts` und `creditor-id.test.ts` laufen immer.

Aufbau der Datei (Werte aus den Dokumenten übertragen, Typen in `tests/local-specs.ts`, `EpcExamples`):

```json
{
  "epc069_12": {
    "quelle": "EPC069-12 Version 3.1, Kap. 2.3",
    "beispiele": [
      {
        "fields": { "version": "001", "charset": 1, "bic": "…", "name": "…", "iban": "…",
                    "amountCents": 1230, "purposeCode": "…", "reference": "…", "text": "", "info": "" },
        "payload": "BCD\n001\n1\nSCT\n…",
        "zeichen": 95, "bytes": 96, "qrVersion": 6
      }
    ]
  },
  "epc262_08": { "quelle": "EPC262-08 Version 12.0, Kap. 8.1.15", "land": "MT",
                 "national": "…", "pruefziffer": "…", "id": "…" }
}
```

### ECMA-376 (Office Open XML), nur zum Nachlesen

Von https://ecma-international.org/publications-and-standards/standards/ecma-376/ (geladen am 25.09.2026):
- `ECMA-376-1_5th_edition_december_2016.zip` (Teil 1, Normtext und Strict-Schemas)
- `ECMA-376-4_5th_edition_december_2016.zip` (Teil 4, Transitional-Schemas)

Verwendet für `docs/xlsx-programmangabe.md`. Kein Test hängt davon ab.
