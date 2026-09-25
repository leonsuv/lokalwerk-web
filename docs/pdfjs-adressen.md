# pdf.js: Adressen im gebauten Bundle (zur Freigabe)

Stand: 25.09.2026, pdfjs-dist 6.3.289. **Noch nicht freigegeben, noch nicht in `scripts/check-dist.mjs` eingetragen.** Heute liefert keine Seite pdf.js aus, deshalb läuft der Build weiter ohne diese Einträge durch.

Erhoben aus zwei Testbuilds der Einbindung `src/ui/pdfjs/` (mit und ohne WebAssembly, Paket 4 Schritt 0). `scripts/check-dist.mjs` findet diese 19 Adressen in zwei Dateien:

- `assets/pdfjs-*.js`: der Teil im Hauptthread (`pdf.mjs`)
- `assets/pdfjs.worker-*.js`: der Worker (`pdf.worker.mjs`)

In den Ersatzdekodern (`pdfjs/openjpeg_nowasm_fallback.js`, `pdfjs/jbig2_nowasm_fallback.js`) und im WASM-Bundle (`assets/wasm-bytes-*.js`) steht keine Adresse. Die Apache-Lizenzadresse aus den Kopfkommentaren steht nicht im Build, weil der Minifier Kommentare entfernt.

Fundstelle: Zeile in `node_modules/pdfjs-dist/build/pdf.mjs` bzw. `pdf.worker.mjs`.

Keine der Adressen wird abgerufen. pdf.js enthält zwar `fetch` und `XMLHttpRequest`, aber nur für Wege, die die Einbindung abschaltet: PDFs von einer Adresse laden (wir übergeben immer Bytes), CMaps, Standardschriften, WASM und ICC-Profile nachladen (`useWorkerFetch: false`, keine Adressen, eigene `LocalBinaryDataFactory`). Die Content-Security-Policy (`connect-src 'none'`) würde es zusätzlich verhindern. Im Browsertest gab es nach dem Laden der Seite keine einzige Anfrage.

Vorschlag wie bei SheetJS: Die Einträge gelten nur für Dateien, die das Paket `pdfjs-dist` laut `build/shipped-packages.ts` enthalten (plan-phase2.md E14), nicht global.

## Gruppe P1: SVG-Namensraum (1)

Im Hauptthread legt pdf.js damit per `document.createElementNS` SVG-Filter im Speicher an, etwa für Transferfunktionen beim Zeichnen. Im Worker steht dieselbe Konstante im gemeinsamen Code; dort nutzt sie nur die XFA-Darstellung (Zeilen 45074–47426, bei `enableXfa: false` nicht aktiv). Es ist ein Name, keine Datei; es wird nichts geladen.

| # | Adresse | Datei | Zeile |
|---|---|---|---|
| P1.1 | `http://www.w3.org/2000/svg` | Hauptthread, Worker | 36 (beide) |

## Gruppe P2: XFA-, XDP-, XFDF-, XMP- und W3C-Namensräume (16)

XFA ist ein Formularformat von Adobe, das in PDFs eingebettet sein kann. Der XFA-Leser im Worker vergleicht die Namensräume der eingebetteten XML-Daten mit diesen Texten (`ns === "…"` bzw. `ns.startsWith("…")`). Wir schalten XFA ab (`enableXfa: false`); der Code ist trotzdem im Worker-Bundle, weil pdf.js ihn nicht getrennt ausliefert.

| # | Adresse | Zeile im Worker |
|---|---|---|
| P2.1 | `http://www.xfa.org/schema/xci/` | 42398 |
| P2.2 | `http://www.xfa.org/schema/xfa-connection-set/` | 42402 |
| P2.3 | `http://www.xfa.org/schema/xfa-data/` | 42406 |
| P2.4 | `http://www.xfa.org/schema/xfa-form/` | 42410 |
| P2.5 | `http://www.xfa.org/schema/xfa-locale-set/` | 42414 |
| P2.6 | `http://ns.adobe.com/xdp/pdf/` | 42418 |
| P2.7 | `http://www.w3.org/2000/09/xmldsig#` | 42422 |
| P2.8 | `http://www.xfa.org/schema/xfa-source-set/` | 42426 |
| P2.9 | `http://www.w3.org/1999/XSL/Transform` | 42430 |
| P2.10 | `http://www.xfa.org/schema/xfa-template/` | 42434 |
| P2.11 | `http://www.xfa.org/schema/xdc/` | 42438 |
| P2.12 | `http://ns.adobe.com/xdp/` | 42442 |
| P2.13 | `http://ns.adobe.com/xfdf/` | 42446 |
| P2.14 | `http://www.w3.org/1999/xhtml` | 42450 |
| P2.15 | `http://ns.adobe.com/xmpmeta/` | 42454 |

Dazu gehört ein Namensraum, den pdf.js nicht vergleicht, sondern schreibt:

| # | Adresse | Zeile im Worker | Zweck |
|---|---|---|---|
| P2.16 | `http://www.xfa.org/schema/xfa-data/1.0/` | 50100 | Kopf der XFA-Formulardaten, wenn pdf.js ein ausgefülltes XFA-Formular speichert (`saveDocument`). Die Einbindung ruft `saveDocument` nicht auf; gespeichert wird mit pdf-lib. |

## Gruppe P3: Basisadressen zum Zerlegen von Adressen (2)

pdf.js zerlegt Adresstexte mit `new URL(text, basis)`. Die Basis ist ein Platzhalter, damit auch relative Angaben zerlegt werden können. Dabei wird nichts abgerufen; `new URL` ist reine Textverarbeitung.

| # | Adresse | Datei | Zeile |
|---|---|---|---|
| P3.1 | `http://example.com` | Hauptthread, Worker | 396 (beide), `updateUrlHash`: Sprungmarke an eine Adresse hängen |
| P3.2 | `https://foo.bar` | Hauptthread | 1325, 1328, `getPdfFilenameFromUrl`: Dateinamen aus einer Adresse ableiten |

## Zusammenfassung

| Gruppe | Anzahl | Art | Wird abgerufen? |
|---|---|---|---|
| P1 SVG-Namensraum | 1 | Name für `createElementNS` | nein |
| P2 XFA/XDP/XFDF/XMP/W3C | 16 | Namensräume (15 verglichen, 1 geschrieben) | nein |
| P3 Basisadressen | 2 | Platzhalter für `new URL` | nein |
| Lizenzadresse | 0 | nicht im Build (Kommentare entfernt) | – |
| **Summe** | **19** | | |

Nach Freigabe: Einträge in `scripts/allowed-urls-pdfjs.mjs` (wie `allowed-urls-sheetjs.mjs`) mit `package: 'pdfjs-dist'` und Fundstelle, plus Test, dass jede Adresse in der genannten Zeile steht.
