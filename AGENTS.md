# AGENTS.md – Lokalwerk

Diese Datei ist verbindlich für jeden KI-Agenten, der an diesem Projekt arbeitet. Lies sie vollständig, bevor du Code schreibst. Wenn eine Anweisung in einer Aufgabe dieser Datei widerspricht, frag nach, statt still eine Seite zu wählen.

## 1. Worum es geht

Lokalwerk ist eine Website mit Werkzeugen für Dateien: PDFs, Fotos, Überweisungslisten und Vereins-/Finanzkram. **Alles läuft ausschließlich im Browser des Nutzers.** Dateien verlassen nie das Gerät. Das ist nicht ein Feature unter vielen, sondern das Produkt selbst und das zentrale Verkaufsargument.

- **Zielgruppe:** Kleine Firmen, Selbstständige, Vereine, Verwaltungen und Kanzleien im DACH-Raum, die sensible Dateien nicht auf Online-Konverter hochladen wollen oder dürfen.
- **Geschäftsmodell:** Grundwerkzeuge kostenlos (für Suchmaschinen-Traffic), zahlende Nutzer über „Lokalwerk Pro“ (Abo). **Keine Werbung, kein Tracking.**
- **Betreiber:** Einzelunternehmer, Kleinunternehmer nach § 19 UStG.
- **Sprache der Oberfläche:** Deutsch, du-Form.
- **Domain:** lokalwerk.eu. Kontaktadresse: kontakt@lokalwerk.eu.

### Prototyp als Referenz

`prototype/lokalwerk-prototyp.html` ist der abgenommene Prototyp. Er ist die Vorlage für **Optik, Texte und Verhalten** der Werkzeuge (PDF zusammenfügen, Fotos verkleinern, SEPA-Sammelüberweisung) und der Rechtsseiten.

Er ist **keine Code-Vorlage zum Übernehmen**. Er verstößt bewusst gegen Regel 1 und 2 (Google Fonts, Bibliotheken von cdnjs) und steckt alles in eine Datei. Beim Überführen in das echte Projekt: Fachlogik nach `src/core/` auslagern und testen, Fonts und Bibliotheken lokal bündeln, eine Seite pro Werkzeug. Den Prototyp selbst nie ausliefern.

## 2. Nicht verhandelbare Regeln

Verstöße gegen diese Regeln sind Fehler, auch wenn der Code funktioniert.

1. **Keine Netzwerkanfragen zur Laufzeit.** Kein `fetch`, kein XHR, kein WebSocket, keine Beacons, keine Bilder oder Skripte von fremden Domains. Nach dem Laden der Seite muss jedes Werkzeug offline funktionieren. Einzige Ausnahme: der Zahlungs- und Lizenzablauf von Pro, und nur nach ausdrücklicher Freigabe.
2. **Keine CDNs, keine externen Schriftarten.** Alle Bibliotheken und Fonts werden gebündelt und von der eigenen Domain ausgeliefert. Niemals Google Fonts, cdnjs, jsDelivr, unpkg o. Ä. einbinden. (Hintergrund: Übertragung von IP-Adressen an Dritte ist in Deutschland abmahnrelevant und widerspricht dem Produktversprechen.)
3. **Kein Tracking, keine Analyse, keine Cookies.** Auch kein „anonymes“ Analytics-Skript, keine Fehler-Reporting-Dienste wie Sentry, keine Social-Media-Einbindungen.
4. **Keine KI- oder Server-APIs mit Nutzerdaten.** KI-Funktionen laufen nur mit Modellen im Browser (WebAssembly/WebGPU). Eine Server-KI darf nie eingebaut werden, ohne dass das ausdrücklich beauftragt ist.
5. **Browser-Speicher nur auf ausdrücklichen Wunsch des Nutzers.** `localStorage`/IndexedDB nur für Dinge, die der Nutzer aktiv speichert (z. B. eine Vorlage). Niemals Dateiinhalte speichern. Niemals automatisch Daten ablegen.
6. **Keine neuen Abhängigkeiten ohne Freigabe.** Siehe Abschnitt 4.
7. **E-Rechnung ist ausgeschlossen** (XRechnung, ZUGFeRD, EN 16931). Keine Werkzeuge, Hilfsfunktionen oder Vorschläge dazu.
8. **Keine erfundenen Normen.** Wenn du dir bei einem Format, Grenzwert oder Rechtsdetail nicht sicher bist, halte an und frag nach der Quelle. Rate nie bei Dateiformaten, die Banken, Finanzämter oder Steuerberater verarbeiten.

## 3. Architektur

Für die aktuelle Phase gilt zusätzlich `plan.md` (freigegebener Plan mit Entscheidungen, Seitenliste, Ordnerstruktur und Anhaltepunkten). Die dortige Ordnerstruktur ersetzt die unten vorgeschlagene.

- **Statische Website.** Kein eigenes Backend, keine Datenbank, keine Serverfunktionen.
- **Build:** Vite + TypeScript (strict), ohne UI-Framework, Ausgabe als statische Dateien, gehostet auf Cloudflare Pages.
- **Eine eigene Seite pro Werkzeug** mit eigener URL, eigenem `<title>`, eigener Meta-Beschreibung und einem kurzen erklärenden Text unter dem Werkzeug. Grund: Jedes Werkzeug ist eine eigene Landingpage für Suchmaschinen.
- **Kein Framework-Zwang.** Bevorzugt schlankes TypeScript ohne UI-Framework. Ein Framework nur nach Freigabe.
- **Schwere Bibliotheken nachladen** (dynamischer Import, lokal ausgeliefert), nur auf der Seite, die sie braucht. Die Startseite darf keine PDF- oder Tabellenbibliothek laden.
- **Rechenintensives in Web Worker**, damit die Oberfläche nicht einfriert (große PDFs, viele Fotos, Texterkennung).
- **Fachlogik getrennt von der Oberfläche.** Parser, Validierung und Dateierzeugung in reinen Funktionen ohne DOM-Zugriff, damit sie testbar sind.

Vorgeschlagene Struktur:

```
src/
  core/            # reine Fachlogik, keine DOM-Zugriffe
    sepa/          # IBAN, Beträge, pain.001, pain.008
    pdf/
    images/
    csv/
  tools/           # je Werkzeug: Seite + UI-Code
  ui/              # gemeinsame Komponenten, Designsystem
  styles/tokens.css
prototype/         # abgenommener Prototyp, nur Referenz
public/
  fonts/           # selbst gehostete Schriftarten
tests/
  fixtures/        # offizielle Beispieldateien aus den Spezifikationen
```

## 4. Abhängigkeiten

Jede neue Bibliothek braucht eine Freigabe des Betreibers. Nenne vorher: Name, Version, Lizenz, Bundle-Größe, letzte Aktualisierung und ob sie Netzwerkanfragen oder Telemetrie enthält.

**Erlaubt sind nur freizügige Lizenzen** (MIT, BSD, Apache-2.0, ISC). LGPL nur nach Freigabe und nur als separat geladene, austauschbare Datei. **GPL, AGPL und „source available“-Lizenzen sind ausgeschlossen.**

Bereits freigegeben:

| Bibliothek | Zweck | Lizenz | Hinweis |
|---|---|---|---|
| pdf-lib | PDFs erstellen und zusammenfügen | MIT | |
| pdf.js (pdfjs-dist) | PDFs darstellen und rendern | Apache-2.0 | Worker lokal ausliefern; Legacy-Build mit core-js (MIT), siehe unten |
| SheetJS Community Edition | Excel/CSV lesen | Apache-2.0 | Aktuelle Version direkt von SheetJS beziehen, nicht die veraltete npm-Version |
| exifr | Metadaten lesen | MIT | |
| tesseract.js | Texterkennung (Pro) | Apache-2.0 | Sprachdaten lokal ausliefern, nicht vom CDN |

**pdf.js-Updates:** Ausgeliefert wird der Legacy-Build von pdfjs-dist (freigegeben am 27.09.2026, `docs/pdfjs-kompatibilitaet.md`). Bei jedem Update von pdfjs-dist `npm run compat:pdfjs` laufen lassen und das Ergebnis im Bericht nennen. Ändert sich die mitgelieferte core-js-Version, bricht der Build ab, bis Lizenztext und Version in `build/licenses.ts` angepasst sind.

Grundsätzlich gilt: Was sich in unter 150 Zeilen sauber selbst schreiben lässt (IBAN-Prüfung, XML-Erzeugung, CSV-Trennzeichen erkennen), wird selbst geschrieben statt als Abhängigkeit geholt.

## 5. Fachregeln

### Geld und Zahlungsverkehr

- Beträge intern **immer als ganze Cent (Integer)**, nie als Gleitkommazahl rechnen. Formatierung erst bei der Ausgabe.
- Deutsche Zahlenformate zuverlässig lesen: `1.234,56`, `1234,56`, `1,234.56`, `12.50`, Zahlen aus Excel-Zellen.
- IBAN: Länge je Land und Prüfziffer nach ISO 13616 (Modulo 97) prüfen. Leerzeichen entfernen, Großbuchstaben.
- Texte in SEPA-Dateien auf den erlaubten Zeichensatz der Deutschen Kreditwirtschaft beschränken und auf die Maximallängen kürzen (Name 70, Verwendungszweck 140, Referenzen 35). Kürzungen dem Nutzer anzeigen.
- Fehlerhafte Zeilen nie stillschweigend übernehmen oder korrigieren: markieren, begründen, ausschließen und das sichtbar zusammenfassen.
- Jede erzeugte Zahlungsdatei zeigt den Hinweis, dass der Nutzer die Aufträge vor der Freigabe im Onlinebanking prüfen muss.

### Maßgebliche Quellen

Bei Fragen zu einem Format gilt ausschließlich die offizielle Quelle. Blogartikel und Stack-Overflow-Antworten sind keine Quelle.

| Thema | Maßgebliche Quelle |
|---|---|
| SEPA-Dateien für deutsche Banken (pain.001, pain.008, camt.053) | DFÜ-Vereinbarung, Anlage 3 „Spezifikation der Datenformate“ (ebics.de) |
| SEPA-Regelwerke | Rulebooks des European Payments Council (europeanpaymentscouncil.eu) |
| Länder im SEPA-Raum | EPC-Liste der Länder und Gebiete im SEPA-Zahlungsverkehrsraum (europeanpaymentscouncil.eu) |
| IBAN-Aufbau und -Länge je Land | SWIFT IBAN Registry (swift.com), Registrierungsstelle nach ISO 13616 |
| GiroCode | EPC069-12 „Quick Response Code“ (European Payments Council) |
| Bankleitzahlen, Prüfzifferverfahren, Gläubiger-ID | Deutsche Bundesbank (bundesbank.de) |
| ISO-20022-Schemas | iso20022.org |
| DATEV-Buchungsstapel | DATEV-Entwicklerportal (developer.datev.de) |
| Zuwendungsbestätigungen | § 10b EStG, § 50 EStDV, aktuelles BMF-Schreiben mit amtlichen Mustern (Wortlaut nicht ändern) |
| Pflichtangaben Rechnung, Kleinunternehmer | § 14 Abs. 4 UStG, § 19 UStG (gesetze-im-internet.de), Umsatzsteuer-Anwendungserlass |
| PDF | ISO 32000-2 (kostenlos über die PDF Association) |
| Foto-Metadaten | EXIF, CIPA DC-008 |
| Barrierefreiheit | WCAG 2.2, EN 301 549, BFSG |

Offizielle Beispieldateien aus diesen Quellen gehören nach `tests/fixtures/` und werden als Testfälle verwendet.

## 6. Designsystem

Das Design des Prototyps ist abgenommen. Keine neuen Farben, Schriften oder Komponentenstile erfinden. Neue Werkzeuge verwenden die bestehenden Bausteine.

- **Schrift:** Onest (400, 500, 600, 700, 800), **selbst gehostet** als WOFF2 unter `public/fonts/`, mit Fallback `system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif`.
- **Farben** als CSS-Variablen auf `:root`, mit Dunkelmodus über `prefers-color-scheme` und `[data-theme]`:

| Token | Hell | Dunkel | Verwendung |
|---|---|---|---|
| `--bg` | #F5F6FA | #0B0F1E | Seitenhintergrund |
| `--surface` | #FFFFFF | #141A2E | Karten |
| `--surface2` | #EEF0F6 | #1B2239 | Flächen, Chips |
| `--ink` | #0E1530 | #EDF0FA | Text |
| `--muted` | #5A6380 | #98A1BE | Nebentext |
| `--line` | #E1E4EE | #252D47 | Linien, Rahmen |
| `--primary` | #3A55E0 | #7B91FF | Hauptaktionen |
| `--ok` | #17935A | #4CD28E | Erfolg, „0 B hochgeladen“ |
| `--err` | #C63F24 | #FF8A6E | Fehler |

- **Jede Werkzeug-Kategorie hat eine eigene Akzentfarbe** (`--c` und `--cs` für die helle Variante): PDF rot, Fotos türkis, Zahlungsverkehr blau, Tabellen ocker, Alltag violett (Ocker und Violett freigegeben am 25.09.2026, Werte und Kontraste in plan-phase2.md Abschnitt 4). Neue Kategorien bekommen eine neue Farbe erst nach Rücksprache.
- **Ocker wird nie für Warnungen verwendet.** Es ist allein die Farbe der Kategorie Tabellen; Warnungen und Fehler nutzen `--err`.
- **Layout einer Werkzeugseite:** Kopf mit Icon, Titel und einem Satz Erklärung. Darunter links der Arbeitsbereich (Ablagefläche, Liste oder Tabelle), rechts eine schmale Spalte mit Einstellungen, Zusammenfassung und Hauptaktion. Auf dem Handy untereinander.
- **Radien:** große Karten 20 px, Eingaben und Buttons 10–12 px, Chips rund.
- **Icons:** einfache Linien-Icons, 1,8–2 px Strichstärke, als inline SVG. Keine Icon-Schriftarten, keine externen Icon-Pakete.
- **Die grüne „0 B hochgeladen“-Plakette** steht im Kopf jeder Seite und darf nicht entfernt werden.

## 7. Texte in der Oberfläche

- Deutsch, du-Form, kurze Sätze, Satzanfang groß, keine Großbuchstaben-Überschriften.
- Buttons sagen genau, was passiert: „Überweisungsdatei erstellen“, nicht „Absenden“. Dieselbe Aktion heißt überall gleich.
- Fehlermeldungen erklären, was falsch ist und wie man es behebt. Keine Entschuldigungen, keine vagen Meldungen wie „Ein Fehler ist aufgetreten“.
- Keine Werbesprache, keine Superlative, keine Emojis in der Oberfläche.
- Nichts versprechen, was nicht technisch garantiert ist. „Deine Dateien verlassen nie dein Gerät“ ist nur erlaubt, weil Regel 1 gilt.

## 8. Qualität

- **Barrierefreiheit:** WCAG 2.2 AA. Tastaturbedienung für alles, sichtbarer Fokus, Beschriftungen für alle Eingaben, ausreichender Kontrast in beiden Farbmodi, `prefers-reduced-motion` beachten.
- **Responsiv** ab 360 px Breite. Breite Tabellen scrollen innerhalb ihres Containers.
- **Große Dateien:** mit mehreren hundert MB rechnen. Fortschritt anzeigen, nicht einfrieren, verständlich abbrechen, wenn der Speicher nicht reicht.
- **Tests:** Jede Funktion in `core/` hat Unit-Tests. Alles, was Geld, Bankdaten oder amtliche Formulare betrifft, wird zusätzlich gegen offizielle Beispieldateien getestet. Ohne Tests kein Merge.
- **Fehlerfälle testen:** leere Dateien, beschädigte und passwortgeschützte PDFs, CSV mit falscher Kodierung, Excel mit leeren Zeilen, ungültige IBANs.

## 9. Rechtliches

- Impressum, Datenschutzerklärung und AGB liegen als eigene Seiten vor. **Jede Änderung, die Daten, Dienste oder Zahlungen betrifft, erfordert eine Anpassung der Datenschutzerklärung.** Weise den Betreiber in diesem Fall ausdrücklich darauf hin, statt es stillschweigend zu übergehen.
- Rechtstexte werden nicht vom Agenten verfasst oder umgeschrieben, sondern nur auf Anweisung eingebaut.
- Werkzeuge mit rechtlicher Wirkung (Zahlungsdateien, Zuwendungsbestätigungen) zeigen einen Hinweis, dass der Nutzer das Ergebnis selbst prüfen muss.

## 10. Lokalwerk Pro

- Pro-Funktionen werden über einen Lizenzschlüssel freigeschaltet, der lokal geprüft wird (signierter Schlüssel). Kein Nutzerkonto, kein Login.
- Kein aufwendiger Kopierschutz. Zielgruppe sind Firmen und Vereine, die ehrlich zahlen. Einfach und robust schlägt schwer zu knacken.
- Kostenlose Funktionen werden nicht nachträglich hinter Pro versteckt.
- Zahlungsanbieter: [OFFEN: Paddle oder Lemon Squeezy, vom Betreiber festzulegen. Für Phase 1 (kostenlose Werkzeuge) nicht relevant, Pro wird dort nicht gebaut.]

## 11. Arbeitsweise

- **Kleine, abgeschlossene Schritte.** Ein Werkzeug oder eine Funktion pro Änderung.
- **Vor größeren Änderungen einen kurzen Plan zeigen** und auf Freigabe warten: neue Abhängigkeit, neue Seitenstruktur, Änderungen am Designsystem, alles mit Netzwerkzugriff.
- **Nicht raten, fragen.** Lieber eine Rückfrage als eine erfundene Annahme über ein Bankformat.
- **Keine Nebenbei-Refactorings** außerhalb der Aufgabe.
- **Browser-Prüfung vor jedem Commit eines Werkzeugs**, nicht erst am Ende eines Pakets: Konsole, Netzwerk-Tab und CSP-Meldungen. Kein Commit mit bekannten Konsolenfehlern.
- **Am Ende jeder Aufgabe kurz berichten:** was geändert wurde, welche Tests laufen, was offen ist und ob Datenschutzerklärung oder AGB betroffen sind.

## Definition of Done

- [ ] Funktioniert offline nach dem ersten Laden
- [ ] Keine Anfragen an fremde Domains (im Netzwerk-Tab geprüft)
- [ ] Keine neue Abhängigkeit ohne Freigabe
- [ ] Unit-Tests für die Fachlogik, grün
- [ ] Hell- und Dunkelmodus, Handy und Desktop geprüft
- [ ] Tastaturbedienbar, Fokus sichtbar
- [ ] Eigene Seite mit Titel, Meta-Beschreibung und Erklärtext
- [ ] Texte auf Deutsch, du-Form, nach Abschnitt 7
- [ ] Hinweis an den Betreiber, falls Datenschutz oder AGB betroffen sind
