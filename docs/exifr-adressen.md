# exifr: Adressen im gebauten Bundle

Stand: 26.09.2026, exifr 7.1.3, Fassung lite. **Freigegeben von Leon am 26.09.2026** (plan.md N3), eingetragen in `scripts/allowed-urls-exifr.mjs`. Gilt nur für Dateien, die exifr laut `build/shipped-packages.ts` enthalten (E14), hier nur der Worker von „Foto-Metadaten anzeigen“.

Fundstelle: `node_modules/exifr/dist/lite.esm.mjs` (eine einzige Zeile, minifiziert).

| # | Adresse | Art | Zweck |
|---|---|---|---|
| X1 | `http://ns.adobe.com/` | Namensraum-Anfang | exifr erkennt daran XMP-Blöcke in JPEG (APP1-Kennung). Vergleich von Bytes, wird nie abgerufen. |
| X2 | `http://ns.adobe.com/xap/1.0/` | XMP-Namensraum | wie X1, Kennung des XMP-Hauptblocks |
| X3 | `http://ns.adobe.com/xmp/extension/` | XMP-Namensraum | wie X1, Kennung erweiterter XMP-Blöcke |
| X4 | `https://github.com/MikeKovarik/exifr` | tote Adresse | Text einer Warnung in `console.warn`, wenn eine HEIC-Datei mehrere Teile hat. Wird nie abgerufen. Da wir nur JPEG, PNG und WebP annehmen, wird die Warnung nicht ausgelöst. |

Kein Netzwerkcode wird ausgeführt: `fetch` steckt nur im Ladeweg für Adressen, den wir nicht benutzen (docs/exifr.md Nr. 3).
