# vendor/

Bibliotheken, die nicht aus der npm-Registry kommen (plan.md A4).

## SheetJS Community Edition

| Angabe | Wert |
|---|---|
| Datei | `xlsx-0.20.3.tgz` |
| Version | 0.20.3 (laut https://cdn.sheetjs.com/xlsx.lst am 24.09.2026 die aktuelle Version) |
| Quelle | https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz |
| Abgerufen | 24.09.2026 |
| Veröffentlicht | laut Websuche 12.07.2024; auf den offiziellen Seiten nicht bestätigt (das Git-Changelog liegt hinter einem Login, das Archiv enthält keine Datumsangaben) |
| SHA-256 | `8dc73fc3b00203e72d176e85b50938627c7b086e607c682e8d3c22c02bb99fe8` |
| Lizenz | Apache-2.0 (`package/LICENSE` im Archiv) |
| Abhängigkeiten | keine |
| Netzwerk | `xlsx.mjs` enthält weder `fetch` noch `XMLHttpRequest` (geprüft am 24.09.2026) |

Warum nicht von npm: Die npm-Version `xlsx@0.18.5` ist veraltet und hat bekannte Sicherheitslücken (u. a. CVE-2024-22363, behoben in 0.20.2 laut CHANGELOG im Archiv). SheetJS verteilt neue Versionen nur über cdn.sheetjs.com (AGENTS.md Abschnitt 4).

Eingebunden in `package.json` als `"xlsx": "file:vendor/xlsx-0.20.3.tgz"`. Prüfen:

```sh
shasum -a 256 vendor/xlsx-0.20.3.tgz
```

Update: neue Version nur nach Rückfrage (plan.md, „Freigegebene Abhängigkeiten“); Archiv ersetzen, diese Tabelle und `package.json` anpassen.
