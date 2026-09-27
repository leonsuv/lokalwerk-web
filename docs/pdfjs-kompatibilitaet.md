# pdf.js 6.3: Browser-Kompatibilität

Stand: 27.09.2026. **Entschieden von Leon am 27.09.2026:** Legacy-Build für alle Seiten mit pdf.js (b), core-js als mitgelieferter Teil freigegeben (Lizenzseite, Build-Prüfung), die zwei core-js-Adressen als tote Adressen, Prüfung beim Laden mit den Texten aus Abschnitt 5, unterstützte Browser wie pdf.js für Legacy angibt, Nachstellungs-Skript `npm run compat:pdfjs`. Umsetzung siehe Abschnitt 6. Anlass: In Chromium 141 zeigen alle Werkzeuge mit Vorschau „Keine Vorschau möglich“ (plan-phase3.md Abschnitt 16).

Betroffen sind alle Werkzeuge, die pdf.js nutzen: PDF-Werkstatt, PDF-Seiten bearbeiten, PDF schwärzen, PDF zu Bildern, Unterschrift einfügen, PDF-Formular ausfüllen.

## Kurzfassung

- Der moderne Build von pdfjs-dist 6.3.289 wird **nicht übersetzt und nicht ergänzt** (`SKIP_BABEL: true`) und ist laut pdf.js für *die neuesten* Browser gedacht. Er ruft auf unserem Weg (PDF öffnen, Seiten zeichnen) APIs auf, die es erst seit Chrome/Edge 147, Firefox 144 und Safari 26.2 gibt.
- Ohne `Math.sumPrecise` (Chrome/Edge erst ab 147) werden PDFs mit eingebetteten TrueType-Schriften **ohne Fehlermeldung mit einer Ersatzschrift** gezeichnet; ohne `getOrInsertComputed` geht gar nichts.
- **Empfehlung: Legacy-Build von pdfjs-dist (b)** plus eine Prüfung beim Laden mit klarer Meldung (5). Er deckt unseren Weg in allen nachgestellten älteren Umgebungen ab und kostet etwa 35 KB (gzip) mehr je Seite mit pdf.js. Nötig sind dafür zwei Freigaben: core-js als mitgelieferter Teil von pdfjs-dist (Lizenzseite) und zwei core-js-Adressen für check-dist.

## 1. Was der moderne Build voraussetzt

### Quellen und Vorgehen

| Quelle | Was sie belegt |
|---|---|
| `gulpfile.mjs` im pdf.js-Quellcode, Tag `v6.3.289` (raw.githubusercontent.com/mozilla/pdf.js/v6.3.289/gulpfile.mjs), Zeilen 93–119 und 1492–1504 | Moderner Build mit `SKIP_BABEL: true` (keine Übersetzung, keine Ergänzungen); nur die Legacy-Builds laufen durch Babel mit core-js 3.50.0 und den Zielen `last 2 versions, Chrome >= 125, Firefox ESR, Safari >= 18, Node >= 22, > 1%, not dead` |
| pdf.js-Wiki „Frequently Asked Questions“, Abschnitt „Which browsers/environments are supported?“ (raw.githubusercontent.com/wiki/mozilla/pdf.js/Frequently-Asked-Questions.md, abgerufen 27.09.2026, nicht versioniert) | Moderner Build: „intended for *the latest* browsers“, Firefox und Chrome. Legacy: Firefox ESR+, Chrome 125+, Opera, Edge (nur Chromium), Safari 18+ („Mostly“) |
| Source-Map des Legacy-Builds (`legacy/build/pdf.mjs.map`, `pdf.worker.mjs.map`) | Liste der core-js-Ergänzungen, die Babel wegen Aufrufen im Code eingefügt hat: also die Kandidaten, die der moderne Build voraussetzt |
| Die gebauten Dateien `build/pdf.mjs` und `build/pdf.worker.mjs` | Fundstellen jeder API, geprüft, ob fest benötigt oder vorher abgefragt |
| Messung (Abschnitt 1.3) | welche APIs auf *unserem* Weg tatsächlich aufgerufen werden |
| MDN Browser Compat Data 8.1.3 vom 24.09.2026 (npm-Paket `@mdn/browser-compat-data`; das ist die Datenquelle der Kompatibilitätstabellen auf developer.mozilla.org, die Seiten selbst waren von hier nicht erreichbar) | Versionen je Browser und deren Erscheinungsdaten |

Release Notes von pdf.js konnte ich nicht lesen (GitHub-API und github.com liefern von hier 403); die Belege stammen deshalb aus Quellcode, gebauten Dateien und Wiki.

### 1.1 Syntax

Beide Dateien (auch die Legacy-Dateien und die JS-Ersatzdekoder für JPEG 2000 und JBIG2) lassen sich erst als ECMAScript 2022 parsen (geprüft mit espree, ab ES2021 Fehler bei `#`): private Methoden und statische Initialisierungsblöcke. Dazu kommen Module-Worker (`new Worker(…, { type: 'module' })`, eigener Code).

| Merkmal | Chrome / Edge | Firefox | Safari / iOS |
|---|---|---|---|
| Statische Initialisierungsblöcke (`static { }`) | 94 | 93 | 16.4 |
| Private Methoden, `#x in obj` | 84 bzw. 91 | 90 | 15 |
| Module-Worker | 80 | 114 | 15 |

### 1.2 APIs

„Unser Weg“ = Messung in Abschnitt 1.3. Versionen nach MDN BCD 8.1.3; in Klammern das Erscheinungsdatum der höchsten Version.

**Fest benötigt, auf unserem Weg aufgerufen**

| API | Wo in pdf.js | Chrome | Edge | Firefox | Safari / iOS |
|---|---|---|---|---|---|
| `Map/WeakMap.prototype.getOrInsertComputed`, `getOrInsert` | Hauptthread: Zeichenaufträge je Seite, Objektspeicher, API-Aufrufe; Worker: Schriften, Ressourcen, Verschlüsselung (33 Stellen) | 145 (10.02.2026) | 145 | 144 (14.10.2025) | 26.2 (12.12.2025) |
| `Math.sumPrecise` | Worker: Umwandlung von TrueType-Schriften (Glyphgrößen, Namens-Tabelle) | **147** (07.04.2026) | 147 | 137 | 26.2 |
| `Promise.try` | Worker: Nachrichtenverteilung (`MessageHandler`), jeder Auftrag | 128 | 128 | 134 | 18.2 |
| `Uint8Array.prototype.toHex` | Worker: Fingerabdruck der Datei, bei jedem Öffnen | 140 | 140 | 133 | 18.2 |
| `URL.parse` | Worker: Adressen in der PDF (Basisadresse, Link-Ziele, `createValidAbsoluteUrl`) | 126 | 126 | 126 | 18 |
| `Promise.withResolvers` | Haupt- und Worker, überall | 119 | 119 | 121 | 17.4 |
| `Object.hasOwn`, `Array.prototype.at` | Haupt- und Worker | 93 / 92 | 93 / 92 | 92 / 90 | 15.4 |

**Im Code, aber auf unserem Weg nicht aufgerufen** (Bearbeiten von Anmerkungen, Laden übers Netz, Speichern, XFA; die Werkzeuge nutzen nur `openPdf`, `pageSize`, `renderPage(At)` und `closePdf` aus `src/ui/pdfjs/pdfjs.ts`)

| API | Wo | Chrome | Firefox | Safari |
|---|---|---|---|---|
| Iterator-Methoden (`.values().some()`, `.keys().filter().toArray()`) | Anmerkungs-Editor, Textebene, Laden übers Netz, XFA | 122 | 131 | 18.4 |
| `Set.prototype.intersection` | Seiten zusammenstellen im pdf.js-Editor (`PDFEditor`) | 122 | 127 | 17 |
| `Uint8Array.fromBase64`, `toBase64` | Unterschriften im Editor, XFA-Bilder | 140 | 133 | 18.2 |
| `AbortSignal.any` | Editor, Touch-Bedienung des Viewers | 116 | 124 | 17.4 |
| `Response.bytes`, `Blob.bytes` | Laden übers Netz, Speichern von Bildern | 132 / 144 | 128 | 18 |

**Vorher abgefragt, mit Ausweichweg** (fehlen schadet nicht): `Float16Array`, `OffscreenCanvas`, `ImageDecoder`, `crypto.randomUUID`, `DecompressionStream` (auch für Brotli).

### 1.3 Messung: was wird auf unserem Weg aufgerufen?

Ein kleines Mess-Skript vor den pdf.js-Dateien eines Experiment-Builds zeichnet jeden Aufruf der Kandidaten auf, im Hauptthread und im pdf.js-Worker (DevTools-Protokoll). Geöffnet und gezeichnet wurden fünf PDFs: die drei Beispiel-PDFs der README-Aufnahme, ein Chromium-Druck mit eingebetteten TrueType-Teilschriften (DejaVu, FreeSans), Link und JPEG, und eine pdf-lib-Datei mit Formularfeldern, Link-Anmerkung und gedrehter Seite.

- Hauptthread: `Map.getOrInsertComputed`, `Promise.withResolvers`, `Object.hasOwn` (dazu alte APIs wie `FontFace`, `Path2D`)
- Worker: `Map.getOrInsertComputed`, `Math.sumPrecise`, `Promise.try`, `Promise.withResolvers`, `URL.parse`, `Uint8Array.toHex`, `Array.at`; mit Abfrage vorher: `ImageDecoder`, `DecompressionStream`

Andere PDFs können andere Wege in pdf.js nehmen; die Tabellen oben nennen deshalb alle Fundstellen.

### 1.4 Mindestversionen

| Build | Chrome | Edge | Firefox | Safari / iOS |
|---|---|---|---|---|
| Modern, wie heute (fest benötigte APIs) | 147 (April 2026) | 147 | 144 | 26.2 (Dezember 2025) |
| Modern, ohne Schriften-Fehler in Chrome 145/146 in Kauf zu nehmen | 145 | 145 | 144 | 26.2 |
| Legacy, laut pdf.js unterstützt | 125 | Chromium-Edge, ohne Version | ESR (laut MDN-Daten derzeit 153) | 18, „mostly“ |
| Legacy, auf unserem Weg nachgestellt (Abschnitt 3.4) | 119 | 119 | 121 | 17.4 |

Aktuell laut MDN-Daten: Chrome 154, Edge 153, Firefox 156, Firefox ESR 153, Safari 27 (alle September 2026). Safari auf iPhone und iPad hängt an der iOS-Version: Wer iOS 26.2 nicht installieren kann, bekommt mit dem modernen Build keine Vorschau. Welche Geräte das sind, habe ich nicht nachgeschlagen.

Zum Vergleich: Unser eigener Code wird mit dem Vite-Vorgabeziel gebaut („baseline widely available“: Chrome/Edge 111, Firefox 114, Safari 16.4). Eine eigene Festlegung der unterstützten Browser gibt es im Projekt nicht.

## 2. Beobachtung in dieser Umgebung

Chromium 141 (September 2025) hat `getOrInsertComputed`, `getOrInsert` und `Math.sumPrecise` nicht (MDN: Chrome 145 bzw. 147). Folge:

- Alle sechs Werkzeuge: Zeichnen scheitert mit `TypeError: this[#t].getOrInsertComputed is not a function`.
- PDF schwärzen und PDF zu Bildern melden das als „Die Datei ist beschädigt oder keine gültige PDF.“, weil jeder Fehler von pdf.js dort als beschädigte Datei gilt. Das ist für den Nutzer irreführend.
- Mit einer Ergänzung nur für `getOrInsertComputed` erscheinen die Vorschauen, aber der Chromium-Druck mit TrueType-Schriften sieht auf beiden Seiten anders aus als die Referenz (weniger Tinte: 31.469 → 30.497 und 1.912 → 1.831 Pixel), also Ersatzschrift. Ohne Fehlermeldung.

## 3. Legacy-Build geprüft

Im Experiment ersetzt: `pdfjs-dist` → `pdfjs-dist/legacy/build/pdf.mjs` in `src/ui/pdfjs/pdfjs.ts` und `pdfjs-dist/build/pdf.worker.mjs` → `pdfjs-dist/legacy/build/pdf.worker.mjs` in `pdfjs.worker.ts`. Zwei Zeilen; die Typen sind dieselben (`legacy/build/pdf.d.mts` gibt die von `pdfjs-dist` weiter).

### 3.1 Größe je Seite mit pdf.js

| Datei | Modern | Legacy | Mehr |
|---|---|---|---|
| pdf.js im Hauptthread | 431 KB, gzip 127 KB, Brotli 106 KB | 488 KB, gzip 146 KB, Brotli 123 KB | +57 KB, gzip +19 KB |
| pdf.js-Worker | 1.194 KB, gzip 367 KB, Brotli 304 KB | 1.244 KB, gzip 383 KB, Brotli 319 KB | +49 KB, gzip +16 KB |
| Ersatzdekoder JPEG 2000 / JBIG2 | 452 KB / 146 KB | unverändert (dieselben Dateien) | – |

Zusammen etwa +35 KB gzip (+7 %) je Seite mit pdf.js; Seiten ohne pdf.js ändern sich nicht.

### 3.2 eval und new Function

Der moderne Build enthält weder `eval` noch `new Function` (die einzige Fundstelle ist `new FunctionBasedShading`). Der Legacy-Build enthält aus core-js eine Stelle `Function('return this')()`, im Hauptthread und im Worker, als letzten Ausweg, um das globale Objekt zu finden. Sie wird nur erreicht, wenn es kein `globalThis` gibt (Chrome 71, Firefox 65, Safari 12.1), also nie in einem Browser, der die ES2022-Syntax des Builds überhaupt lesen kann. Unter unserer CSP (ohne `'unsafe-eval'`) würde sie scheitern. In allen Läufen gab es keine CSP-Meldung. Der Kommentar in `src/ui/pdfjs/pdfjs.ts` ist entsprechend angepasst.

**Dokumentierte Ausnahme (Leon, 27.09.2026):** `Function('return this')()` aus core-js (Modul `global-this`, Legacy-Build `pdf.mjs` Zeile 1476, `pdf.worker.mjs` Zeile 1418) bleibt im ausgelieferten Code. Warum sie nie läuft: Sie steht am Ende einer Kette `check(typeof globalThis == 'object' && globalThis) || check(typeof window …) || check(typeof self …) || … || (function () { return this; })() || Function('return this')()`. Schon der erste Teil liefert in jedem Browser mit `globalThis` ein Ergebnis (Chrome 71, Firefox 65, Safari 12.1 laut MDN), und jeder Browser, der den Build überhaupt lesen kann, braucht ES2022 (Chrome 94, Firefox 93, Safari 16.4). Selbst wenn sie liefe, würde unsere CSP (`script-src 'self'` ohne `'unsafe-eval'`) den Aufruf blockieren; es entstünde ein Fehler, kein ausgeführter Code.

### 3.3 check-dist, Abhängigkeiten, Lizenz

- **check-dist:** zwei neue fremde Adressen, je im Hauptthread- und im Worker-Teil: `https://github.com/zloirock/core-js` und `https://github.com/zloirock/core-js/blob/v3.50.0/LICENSE`. Das ist der Urheberrechts-Text, den core-js als Zeichenkette mitführt, keine Anfrage. Er müsste in die Adressliste von pdf.js (`scripts/allowed-urls-pdfjs.mjs`), mit Freigabe.
- **Abhängigkeiten:** keine neue npm-Abhängigkeit. Der Legacy-Build bringt aber **core-js 3.50.0** (MIT, Denis Pushkarev) als Teil der pdfjs-dist-Dateien mit. Nach AGENTS.md Abschnitt 4 ist das mitgelieferter fremder Code: Lizenzseite um core-js ergänzen (MIT verlangt den Urheberrechtshinweis), Freigabe nötig. Die Tests in Node nutzen den Legacy-Build schon heute (`tests/core/pdf/assemble.test.ts`).
- **CSP und Netzwerk:** In allen Läufen hinter unseren Produktions-Headern (`vite preview` mit `public/_headers`) keine CSP-Meldung, keine Konsolenmeldung, keine fremde Anfrage.

### 3.4 Nachgestellte ältere Browser

Chromium 141 ist der einzige Browser hier. Ältere Umgebungen habe ich nachgestellt, indem vor pdf.js (Hauptthread und Worker) genau die APIs entfernt wurden, die der Zielbrowser laut MDN noch nicht hat. Die Syntax lässt sich so nicht nachstellen, sie ist ab Safari 16.4, Chrome 94 und Firefox 93 vorhanden. Verglichen wurden alle 14 Seiten der fünf Test-PDFs Pixel für Pixel mit der Referenz.

| Umgebung (API-Stand) | Modern | Modern + eigene Ergänzung (a) | Legacy (b) |
|---|---|---|---|
| Chromium 141 | scheitert | gleich wie Referenz | gleich wie Referenz |
| Safari 18.0 | – | gleich wie Referenz | gleich wie Referenz |
| Chrome 125 | – | gleich wie Referenz | gleich wie Referenz |
| Chrome 119 / Safari 17.4 | – | gleich wie Referenz | gleich wie Referenz |

Was das nicht prüft: echte Unterschiede von Safari und Firefox beim Zeichnen (Canvas, Schriften). Das bleibt ein Gerätetest bei dir (Vorschlag: iPhone mit iOS 18, Mac mit Safari 18, Firefox ESR).

## 4. Gegenüberstellung

| | (a) Eigene Ergänzung | (b) Legacy-Build | (c) Ältere pdfjs-dist-Version |
|---|---|---|---|
| Umfang | Für unseren Weg heute 7 APIs, im Test etwa 10 Zeilen, spezifikationstreu (z. B. `Math.sumPrecise` exakt, `toHex`) eher 60–100 Zeilen; in Hauptthread und Worker vor pdf.js laden | Zwei Importpfade ändern | Version festschreiben |
| Mindestversionen | wie Legacy, auf Wunsch tiefer (bis zur Syntaxgrenze Safari 16.4) | Chrome 125, Firefox ESR, Safari 18 laut pdf.js; unser Weg ab Chrome 119, Firefox 121, Safari 17.4 | siehe unten: keine Version hilft wirklich |
| Pflege | Bei jedem pdf.js-Update neu prüfen, welche APIs dazukommen (`getOrInsertComputed` kam mit 5.5, `sumPrecise` mit 5.2). Fehlt eine, kann das still falsch zeichnen (Abschnitt 2) | pdf.js pflegt die Ergänzungen selbst (core-js, breit getestet); Update wie bisher | Keine Sicherheits- und Fehlerkorrekturen mehr, sobald wir stehen bleiben |
| Größe | +1–3 KB | +35 KB gzip je Seite mit pdf.js | ähnlich wie heute |
| Freigaben | keine neue Bibliothek | core-js als mitgelieferter Code (Lizenzseite), 2 Adressen für check-dist | – |
| Risiko | eigener Code für Randfälle der Spezifikation; Lücken fallen erst im Gerät auf | pdf.js nennt Safari 18 „mostly“ | alt |

**Zu (c):** Ich habe die modernen Builds von 13 Versionen zwischen 4.10.38 (Januar 2025) und 6.3.289 durchsucht. `getOrInsertComputed` kam mit 5.5.207 (März 2026) und `Math.sumPrecise` mit 5.2.133 (April 2025). `Promise.try` und `toHex` sind schon in 4.10.38 enthalten (Chrome 128 bzw. 140, Safari 18.2). Auch ältere moderne Builds setzen also die jeweils neuesten Browser voraus. Wir müssten bis vor 4.10 zurück und auf ein Jahr Korrekturen verzichten.

**Empfehlung: (b) Legacy-Build**, zusammen mit der Prüfung beim Laden (5). Als unterstützte Browser für pdf.js-Werkzeuge nennen wir, was pdf.js selbst für Legacy nennt: Chrome und Edge ab 125, Firefox ESR, Safari ab 18. Ältere Browser bekommen die klare Meldung statt „Datei beschädigt“.

Zusätzlich schlage ich vor, die Nachstellung aus Abschnitt 3.4 als Skript ins Repository zu nehmen (wie `perf:werkstatt`, nicht Teil von `check`), damit jedes Update von pdfjs-dist gegen dieselben Umgebungen geprüft werden kann.

## 5. Prüfung beim Laden (Vorschlag, noch nicht umgesetzt)

**Was geprüft wird** (Stand für den Legacy-Build; was core-js ergänzt, muss nicht geprüft werden):

1. Laden von pdf.js schlägt fehl (z. B. `SyntaxError` in einem Browser ohne ES2022): heute wird das nicht unterschieden.
2. Vorhanden sind `Promise.withResolvers`, `Object.hasOwn`, `Array.prototype.at` und `structuredClone`. Module-Worker lassen sich ohne Versuch nicht abfragen; ein Fehler beim Start des pdf.js-Workers zählt deshalb ebenso.

Umsetzung: `openPdf` wirft dann `PdfOpenError('unsupported')` statt `'damaged'`, einmal ermittelt in `src/ui/pdfjs/pdfjs.ts`; die Werkzeuge zeigen die Meldung einmal oben statt auf jeder Kachel.

**Texte zur Freigabe**

| Wo | Text |
|---|---|
| Werkzeuge, in denen Speichern ohne Vorschau geht (PDF-Werkstatt, PDF-Seiten bearbeiten, PDF-Formular ausfüllen) | „Dein Browser ist zu alt für die Vorschau. Aktualisiere ihn und lade die Seite neu.“ Dazu, wenn eine Datei geladen ist: „Speichern funktioniert trotzdem.“ |
| Werkzeuge, die pdf.js für das Ergebnis brauchen (PDF schwärzen, PDF zu Bildern, Unterschrift einfügen) | „Dein Browser ist zu alt für dieses Werkzeug. Aktualisiere ihn und lade die Seite neu.“ |
| Kacheln ohne Bild | bleibt „Keine Vorschau möglich“ |

Die Meldung nennt keine Versionsnummern, weil die sich mit jedem pdf.js-Update ändern können. Datenschutzerklärung und AGB sind nicht betroffen.
