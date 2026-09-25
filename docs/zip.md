# ZIP-Archive (eigene Implementierung)

Stand: 25.09.2026. Entscheidung: plan-phase2.md E3 (ZIP überall kostenlos, eigene Implementierung ohne Kompression).

Code: `src/core/zip/write.ts` (Verwaltungsdaten, CRC-32), `src/ui/zip.ts` (setzt das Archiv als Blob zusammen). Quelle: PKWARE, APPNOTE.TXT (ZIP File Format Specification), Abschnitte 4.3 (Aufbau) und 4.4 (Felder).

| Nr. | Grenze | Auswirkung | Umgang |
|---|---|---|---|
| 1 | Keine Kompression (Methode 0, „stored“) | Archiv ist so groß wie die Dateien zusammen | Gewollt: Fotos und PDFs sind schon komprimiert |
| 2 | Kein ZIP64 | Höchstens 65 535 Dateien und knapp 4 GiB je Archiv | Darüber Meldung „Die ZIP-Datei wäre zu groß …“ (ZipError) |
| 3 | Dateinamen in UTF-8 mit Bit 11 (APPNOTE 4.4.4) | Windows-Explorer, macOS-Archivierung und 7-Zip zeigen Umlaute richtig. Das mitgelieferte `unzip` von macOS zeigt sie falsch an, entpackt aber fehlerfrei | Geprüft am 25.09.2026 mit `unzip -t` und Python `zipfile` |
| 4 | Doppelte Namen | Werden durchnummeriert („foto (2).jpg“), Groß-/Kleinschreibung zählt als gleich | `uniqueNames`, Tests |
| 5 | Datum | Zeitpunkt des Speicherns in Ortszeit, MS-DOS-Format (2-Sekunden-Schritte) | – |
| 6 | Speicher | Inhalte werden nicht kopiert; für die Prüfsumme wird jede Datei einmal stückweise gelesen | – |

Tests: `tests/core/zip/write.test.ts` (Prüfwert „123456789“ = CBF43926, Abgleich mit zlib, Lesen des eigenen Archivs über das zentrale Verzeichnis, Grenzen).
