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
└─ swift/
   └─ iban-registry.txt            SWIFT IBAN Registry (TXT-Fassung)
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

### EPC-Dokumente

Adressen und Versionen stehen in `tests/fixtures/SOURCES.md`. Die Dateien werden für Tests nicht gebraucht, nur zum Nachlesen.
