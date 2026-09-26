# exifr: Einsatz und Grenzen

exifr 7.1.3 (MIT, Mike Kovařík), freigegeben in AGENTS.md und plan-phase2.md E7, Variante lite (`exifr/dist/lite.esm.mjs`). Letzte Veröffentlichung 01.05.2022. Eingesetzt nur zum Lesen, nur im Worker des Werkzeugs „Foto-Metadaten anzeigen“.

| Nr. | Grenze | Folge bei uns |
|---|---|---|
| 1 | Die Lite-Fassung liest kein IPTC („segment parser 'iptc' was not loaded“). | IPTC wird über die eigene Prüfung `core/images/metadata-check.ts` als „vorhanden“ gemeldet, ohne Inhalt. |
| 2 | Mit `reviveValues: true` wandelt exifr Aufnahmezeiten in `Date` um und rechnet sie in die Zeitzone des Browsers um; Exif-Zeiten haben aber keine Zeitzone. | Wir lesen mit `reviveValues: false` und zeigen die Zeit so, wie sie in der Datei steht (Test mit der Fixture). |
| 3 | exifr kann Dateien auch über eine Adresse laden (`fetch`). | Wir übergeben immer Bytes. Die CSP (`connect-src 'none'`) würde einen Abruf zusätzlich blockieren. |
| 4 | Keine Pflege seit 2022. | Vertretbar, weil nur gelesen wird und das Exif-Format stabil ist (plan-phase2.md Frage 7). Bei Fehlern lässt sich der Lesecode durch einen eigenen JPEG-Leser ersetzen, ohne die Oberfläche zu ändern (`core/images/exif-read.ts` bekommt nur Rohdaten). |

Adressen im Bundle: `docs/exifr-adressen.md`.
