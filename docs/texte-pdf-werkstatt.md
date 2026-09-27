# Texte der PDF-Werkstatt

Stand: 27.09.2026, Anhaltepunkt B (plan-phase3.md). **Freigegeben von Leon am 27.09.2026** mit fünf Änderungen, die unten schon eingearbeitet sind: „PDFs und Bilder“ im Kopf und im ersten Satz des Erklärtexts; Ansage „Dokument 3 angelegt“; „Gut zu wissen“ beginnt mit „Beim neuen Zusammensetzen …“; der Hinweis vor dem Export endet ohne „wie beim Zusammenfügen“; der Satz mit Link zur Werkstatt steht in den Erklärtexten der 12 Einzelwerkzeuge. Alle sichtbaren Texte und Ansagen der Werkstatt, dazu der Knopf in den Einzelwerkzeugen und der Satz in ihren Erklärtexten.

Offen bei Leon (Gerätetests, plan-phase3.md Abschnitt 15, B1): NVDA-Prüfung der Kürzel R, D und M.

Fundorte: Register `build/pages.ts`, Seite `src/tools/pdf-werkstatt/main.html`, Meldungen und Ansagen `src/tools/pdf-werkstatt/texts.ts`, Menüs `src/tools/pdf-werkstatt/page.ts` und `mobile.ts`, Befehlsnamen `src/core/workshop/commands.ts`, Knopf `src/ui/workshop-link.ts`.

Tastenbezeichnungen passen sich dem System an: Windows und Linux „Strg“, „Umschalt“, „Alt“ (z. B. „Strg+V“), Mac „⌘“, „⇧“, „⌥“ (z. B. „⌘V“). Unten steht die Windows-Schreibweise.

## 1. Register (Suchmaschinen, Karten)

| Feld | Text |
|---|---|
| Titel | PDF-Werkstatt – mehrere PDFs bearbeiten und neu zusammenstellen \| Lokalwerk |
| Meta-Beschreibung (147 Zeichen) | PDFs und Bilder nebeneinander öffnen, Seiten zwischen Dokumenten verschieben, drehen und löschen. Kostenlos im Browser, ohne Upload deiner Dateien. |
| Name | PDF-Werkstatt |
| Kurztext (Karte) | Mehrere PDFs und Bilder nebeneinander bearbeiten und neu zusammenstellen. |
| Suchwörter | pdf editor, pdf bearbeiten, seiten verschieben, seiten kopieren, mehrere pdfs, organisieren, zusammenstellen, umsortieren, leere seite |

## 2. Seite

**Kopf:** PDF-Werkstatt. „PDFs und Bilder nebeneinander öffnen, Seiten zwischen Dokumenten verschieben, drehen, löschen und neu zusammenstellen.“

**Ablagefläche (ohne Dokumente):** „PDFs oder Bilder hinzufügen“ / „Auswählen oder hierher ziehen, auch mehrere“

**Werkzeugleiste:** Hinzufügen · Neues Dokument · Links (Name: „Links drehen“) · Rechts („Rechts drehen“) · Duplizieren · Leere Seite · Löschen · Teilen · Zusammenführen · Rückgängig (nur Symbol) · Wiederholen (nur Symbol) · Vorschau · Tastenkürzel (nur Symbol, Hinweis „Tastenkürzel (?)“)

**Rechte Spalte:** Übersicht · Dokumente · Seiten gesamt · Ausgewählt („3 Seiten aus 2 Dokumenten“) · „Vertrag als PDF speichern“ (Name des Dokuments mit dem Fokus) · „Auswahl als neue PDF“ · „Alle als ZIP speichern“

**Erklärtext**

> **So funktioniert es**
> Füge eine oder mehrere PDFs oder Bilder hinzu. Jede Datei erscheint als eigenes Dokument in einer Spalte, jede Seite als kleines Bild. Du kannst Seiten auswählen, drehen, löschen, kopieren und zwischen den Dokumenten verschieben, leere Seiten einfügen, Dokumente teilen und zusammenführen. Jeder Schritt lässt sich rückgängig machen. Am Ende speicherst du ein Dokument, deine Auswahl oder alle Dokumente als ZIP. Deine Originaldateien bleiben unverändert.
>
> **Gut zu wissen**
> Beim neuen Zusammensetzen werden nur die Seiten übernommen: Formularfelder, Lesezeichen und digitale Signaturen sind in neu zusammengesetzten Dateien nicht mehr enthalten, ebenso Angaben wie Autor oder Titel. Die Werkstatt zeigt vor dem Speichern, welche Datei das betrifft. Ein Dokument, an dem du nichts geändert hast, wird als Originaldatei gespeichert. Verschlüsselte PDFs lassen sich nicht öffnen.
>
> **Deine Dateien bleiben auf deinem Gerät**
> Die PDFs werden direkt in deinem Browser angezeigt und bearbeitet, nicht hochgeladen. Nach dem Laden der Seite funktioniert die Werkstatt auch ohne Internetverbindung.

## 3. Vorgabenamen

| Wo | Name |
|---|---|
| Neues Dokument | „Dokument 3“ (Zahl = Anzahl der Dokumente + 1) |
| Dokument duplizieren | „Vertrag (Kopie)“ |
| Teilen | „Vertrag (Teil 2)“ |
| Als neues Dokument (Kontextmenü) | „Dokument 4“ |
| Auswahl als neue PDF | Datei „Auswahl.pdf“ |
| Alle als ZIP | Datei „pdf-werkstatt.zip“ (W11) |
| Dokument aus Datei | Dateiname ohne Endung (.pdf, .jpg, .png …) |

## 4. Befehlsnamen (Ansage „Rückgängig: …“, „Wiederholen: …“)

Hinzufügen · Neues Dokument · Umbenennen · Dokument schließen · Dokument duplizieren · Teilen · Zusammenführen · Verschieben · Kopieren · Nach vorne · Nach hinten · Drehen · Löschen · Ausschneiden · Duplizieren · Leere Seite einfügen · In neues Dokument · Einfügen

## 5. Menüs

**Kontextmenü einer Seite:** Große Vorschau (Eingabe) · Rechts drehen (R) · Links drehen (Umschalt+R) · Duplizieren (D) · Verschieben nach … (M) · Ausschneiden (Strg+X) · Kopieren (Strg+C) · Davor einfügen (Strg+V) · Leere Seite danach … · Dokument hier teilen · Als neues Dokument · Löschen (Entf)

**Menü im Spaltenkopf** („Menü für Vertrag“): Umbenennen (F2) · Alle Seiten auswählen (Strg+A) · Am Anfang einfügen · Dateien anhängen … · Als PDF speichern · Dokument duplizieren · Mit dem nächsten zusammenführen · Dokument schließen

**Leere Seite:** „Wie die Nachbarseite (21,0 × 29,7 cm)“ · DIN A4 hoch · DIN A4 quer (W14)

**Handy, „Mehr“:** Rückgängig · Wiederholen · Duplizieren · Als neues Dokument · Leere Seite am Ende · Neues Dokument · Dokumente zusammenführen …

## 6. Dialoge

**Verschieben nach …:** Untertitel „2 Seiten“ bzw. „3 Seiten aus 2 Dokumenten“ · Dokument · Position: Am Anfang / Am Ende / Nach Seite [Zahl] · Abbrechen · Verschieben. Fehler: „Gib eine Seite von 1 bis 6 ein.“ bzw. „Das Dokument hat noch keine Seiten. Wähle „Am Anfang“ oder „Am Ende“.“

**Dokumente zusammenführen:** „Die angekreuzten Dokumente werden in der Reihenfolge der Spalten an das erste angehängt.“ · Dokumente · Abbrechen · Zusammenführen. Fehler: „Wähle mindestens zwei Dokumente.“

**Tastenkürzel:** Untertitel „Gelten, wenn eine Seite oder ein Dokument den Fokus hat.“

| Taste | Text |
|---|---|
| Pfeiltasten | Zur nächsten Seite |
| Strg+Pfeil links/rechts | Ins Nachbardokument |
| Leertaste | Seite auswählen oder abwählen |
| Umschalt+Pfeiltasten | Auswahl erweitern |
| Strg+A | Alle Seiten des Dokuments auswählen |
| Esc | Auswahl aufheben |
| R / Umschalt+R | Nach rechts / links drehen |
| D | Duplizieren |
| M | Verschieben nach … |
| Alt+Pfeil hoch / Alt+Pfeil runter | Eine Stelle nach vorne / hinten |
| Entf | Löschen |
| Strg+X, Strg+C, Strg+V | Ausschneiden, kopieren, vor der Seite einfügen |
| Strg+Z / Strg+Umschalt+Z | Rückgängig / Wiederholen |
| Eingabe | Große Vorschau (darin Pfeiltasten und R) |
| F2 | Dokument umbenennen |
| Umschalt+F10 | Menü der Seite |
| ? | Diese Übersicht |

**Große Vorschau:** Titel „Vertrag: Seite 2 von 6“ · Schließen · Vorherige · Rechts drehen · Nächste · auf dem Handy zusätzlich Nach vorne · Nach hinten

## 7. Meldungen

| Anlass | Text |
|---|---|
| Laden | „Datei wird geöffnet …“ / „Dateien werden geöffnet: 2 von 5 …“ |
| Falsche Dateiart | „Tabelle.xlsx wurde nicht übernommen: Die Werkstatt öffnet PDFs und Bilder.“ (mehrere: „3 Dateien wurden …“) |
| Fehler je Datei | „Vertrag.pdf: “ + Fehlertext; Fehlertexte wie in „PDF-Seiten bearbeiten“ und „Bilder zu PDF“, außer: „Zu wenig Arbeitsspeicher für diese Datei. Schließe andere Dokumente oder lade die Seite neu.“, „Die Werkstatt konnte nicht starten. Lade die Seite neu.“, „Das Bild konnte nicht neu gespeichert werden. Verkleinere es und füge es erneut hinzu.“, „Im neu gespeicherten Bild wurden noch Metadaten gefunden. Das Bild wird deshalb nicht übernommen.“ |
| Leere Spalte | „Noch keine Seiten. Verschiebe Seiten hierher oder füge sie mit Strg+V ein.“ |
| Vorschau fehlt | „Keine Vorschau möglich“ |
| Speicherhinweis ab 1 GB (W6) | „Die geöffneten Dateien sind zusammen 1,2 GB groß. Bei so viel Daten kann der Arbeitsspeicher des Browsers knapp werden; schließe Dokumente, die du nicht mehr brauchst.“ |
| Hinweis vor dem Export | „Anlagen.pdf enthält Formularfelder und Lesezeichen. Diese Angaben sind in neu zusammengesetzten PDFs nicht mehr enthalten.“ (auch „eine digitale Signatur“; ab vier Dateien „Weitere 2 Dateien ebenso.“) |
| Speichern läuft | „Wird gespeichert: 120 von 500 Seiten …“ |
| Fertig | „Fertig: Vertrag.pdf ist gespeichert.“ / „Fertig: 3 Dokumente sind als ZIP gespeichert.“ |
| Fertig, unverändert (W12) | „… Es war unverändert: Gespeichert ist die Originaldatei.“ / im ZIP „… 2 davon waren unverändert und sind die Originaldatei.“ |
| Verlassen mit Änderungen | Warnung des Browsers (der eigene Text „Die Werkstatt hat Änderungen, die noch nicht gespeichert sind.“ wird von aktuellen Browsern nicht angezeigt) |
| Handy | „Tippen öffnet die Vorschau. Für mehrere Seiten auf „Auswählen“ tippen.“ / im Auswahlmodus „2 Seiten ausgewählt“ bzw. „Tippe auf Seiten, um sie auszuwählen.“ |

## 8. Ansagen für Screenreader (unsichtbar, plan-phase3.md 6.4)

Beschriftung einer Seite: „Seite 3 von 12, aus Anlagen.pdf Seite 1, gedreht um 90 Grad“, Bildseite „…, aus Wiese.jpg“, Leerseite „…, leere Seite“. Liste: „Seiten von Vertrag“. Namensfeld: „Name des Dokuments“.

| Anlass | Ansage |
|---|---|
| Laden | „2 Dokumente mit zusammen 12 Seiten hinzugefügt“ / „1 Dokument mit 6 Seiten hinzugefügt“ / „3 Seiten in Vertrag eingefügt“ |
| Auswahl | „3 Seiten ausgewählt“ / „3 Seiten aus 2 Dokumenten ausgewählt“ / „Auswahl aufgehoben“ |
| Verschieben, Kopieren | „2 Seiten nach Vertrag an Position 4 verschoben“ / „… kopiert“ / „Die Seiten stehen schon an dieser Stelle.“ |
| Nach vorne/hinten | „2 Seiten nach vorne verschoben“ / „… nach hinten verschoben“ |
| Drehen, Löschen, Duplizieren | „2 Seiten nach rechts gedreht“ / „2 Seiten gelöscht“ / „2 Seiten dupliziert“ |
| Ablage | „2 Seiten ausgeschnitten. Mit Strg+V vor einer Seite einfügen.“ / „2 Seiten kopiert. Mit Strg+V vor einer Seite einfügen.“ / „2 Seiten in Vertrag an Position 3 eingefügt“ / „Nichts zum Einfügen. Schneide Seiten zuerst mit Strg+X aus oder kopiere sie mit Strg+C.“ |
| Verlauf | „Rückgängig: Drehen“ / „Wiederholen: Drehen“ / „Nichts zum Rückgängigmachen“ / „Nichts zum Wiederholen“ / „Ältere Schritte lassen sich nicht mehr rückgängig machen: Die Werkstatt merkt sich die letzten 100.“ |
| Dokumente | „Dokument 3 angelegt“ / „Vertrag (Kopie) angelegt“ / „Vertrag geschlossen“ / „Dokument umbenannt in Mietvertrag“ / „Vertrag vor Seite 5 geteilt“ / „3 Dokumente zu Vertrag zusammengeführt“ |
| Leere Seite | „Leere Seite in Vertrag an Position 3 eingefügt“ |
| Teilen am Anfang | „Vor der ersten Seite lässt sich nicht teilen. Wähle die Seite, mit der das neue Dokument beginnen soll.“ |
| Ohne Seite | „Wähle zuerst eine Seite aus.“ |
| Ziehen | „Ziel: vor Seite 5 von Vertrag“ / „Ziel: Ende von Vertrag“ / „Kein Ziel. Zum Ablegen über ein Dokument ziehen.“ / „Ziehen abgebrochen“ |

## 9. Einzelwerkzeuge

**Knopf** (erscheint nach dem Laden einer Datei, in 12 Werkzeugen): „In der PDF-Werkstatt weiterbearbeiten“. Fehler, wenn die Werkstatt nicht geladen werden kann (z. B. offline vor dem ersten Laden): „Die PDF-Werkstatt konnte nicht geladen werden. Prüfe die Verbindung und lade die Seite neu.“

**Erklärtexte der Einzelwerkzeuge** (plan-phase3.md 5.2): ein Satz am Ende von „So funktioniert es“, in allen 12 Werkzeugen gleich:

> Mehrere Dateien auf einmal bearbeiten oder Seiten zwischen Dokumenten verschieben kannst du in der [PDF-Werkstatt](/pdf-werkstatt/).

„PDF-Seiten bearbeiten“: Der Knopf übergibt die Datei mit den Änderungen aus dem Werkzeug (Reihenfolge, Drehung, gelöschte Seiten); die Werkstatt zeigt das Dokument im bearbeiteten Zustand. Ein Zusatzsatz ist damit nicht nötig.

## 10. Stufe 2, Schritt 2.1: Seitenzahlen in der Werkstatt

Stand: 27.09.2026. **Freigegeben von Leon am 27.09.2026**, einschließlich des Satzes für den Erklärtext (eingebaut). Fundorte: `src/tools/pdf-werkstatt/texts.ts` (Abschnitt „Stufe 2“), `src/tools/pdf-seitenzahlen/embed.ts`, Befehlsnamen `src/core/workshop/commands.ts`.

**Wo es erscheint**

| Ort | Text |
|---|---|
| Werkzeugleiste | Knopf „Werkzeuge“ (Symbol aus dem Entwurf), öffnet ein Menü mit „Seitenzahlen …“ für das Dokument mit dem Fokus |
| Menü im Spaltenkopf | neuer Eintrag „Seitenzahlen …“ nach „Als PDF speichern“ |
| Handy, „Mehr“ | neuer Eintrag „Seitenzahlen …“ am Ende |
| Spaltenkopf | Knopf mit Seitenzahl-Symbol, nur wenn das Dokument Seitenzahlen hat; Hinweis beim Darüberfahren „Mit Seitenzahlen“, Name für Screenreader „Seitenzahlen von Vertrag bearbeiten“ |

**Bereich in der rechten Spalte** (an Stelle der Übersicht, solange er offen ist)

- Überschrift „Seitenzahlen“, darunter „Für Vertrag, 5 Seiten“
- Felder, Hinweis („Ab Seite 2 lässt zum Beispiel ein Deckblatt frei.“) und Fehlermeldungen („„Ab Seite“ muss zwischen 1 und 5 liegen.“, „„Erste Zahl“ muss eine ganze Zahl ab 0 sein.“) unverändert aus „Seitenzahlen einfügen“ (freigegeben)
- Neu: Hinweis „Die Seitenzahlen werden beim Speichern gesetzt und zählen die Seiten in der Reihenfolge, die das Dokument dann hat.“
- Knöpfe „Seitenzahlen übernehmen“ · „Seitenzahlen entfernen“ (nur, wenn schon gesetzt) · „Abbrechen“ (auch Esc)

**Ansagen und Befehlsnamen**

| Anlass | Text |
|---|---|
| Übernommen | „Seitenzahlen für Vertrag übernommen. Sie werden beim Speichern gesetzt.“ |
| Entfernt | „Seitenzahlen von Vertrag entfernt“ |
| Verlauf | „Rückgängig: Seitenzahlen“ / „Rückgängig: Seitenzahlen entfernen“ (ebenso „Wiederholen: …“) |

**Erklärtext der Werkstatt**, Satz am Ende von „So funktioniert es“ (freigegeben, eingebaut): „Über „Werkzeuge“ bekommt ein Dokument Seitenzahlen; sie werden beim Speichern gesetzt und passen zur dann gültigen Reihenfolge.“

## 11. Stufe 2, Schritt 2.2: Stempel und Unterschrift in der Werkstatt

Stand: 27.09.2026. **Freigegeben von Leon am 27.09.2026**, einschließlich des Satzes für den Erklärtext (eingebaut). Fundorte: `src/tools/pdf-werkstatt/texts.ts` (Abschnitt „Stufe 2.2“), `src/tools/pdf-werkstatt/main.html` (Dialog `#ws-sign`), `src/tools/pdf-stempel/embed.ts`, `src/tools/pdf-unterschreiben/embed.ts`, Befehlsnamen `src/core/workshop/commands.ts`. Felder, Hinweise und Fehlermeldungen aus „PDF stempeln“ und „PDF unterschreiben“ sind unverändert übernommen (freigegeben).

**Wo es erscheint**

| Ort | Text |
|---|---|
| Menü „Werkzeuge“ | „Stempel …“ (Dokument mit dem Fokus), „Unterschrift …“ (Seite mit dem Fokus, sonst die erste ausgewählte Seite) |
| Menü im Spaltenkopf | „Stempel …“ nach „Seitenzahlen …“ |
| Kontextmenü einer Seite | „Unterschrift …“ nach „Als neues Dokument“, vor „Löschen“, mit Trennlinie |
| Handy, „Mehr“ | „Stempel …“ und „Unterschrift …“ am Ende; „Unterschrift …“ nur mit genau einer ausgewählten Seite |
| Vorschaubild | zeigt Stempel, Unterschriften und Seitenzahlen wie gespeichert; dazu kleine Symbole (Stempel, Unterschrift) in der Zeile unter dem Bild, rechts neben der Seitennummer, ohne Text; Screenreader lesen sie in der Seitenbeschriftung mit (unten) |

**Stempel, Bereich in der rechten Spalte**

- Überschrift „Stempel“, darunter „Für Vertrag, 5 Seiten“ (wie bei den Seitenzahlen)
- Felder und Fehlermeldungen aus „PDF stempeln“. Das Feld „Seiten“ ist mit den ausgewählten Seiten des Dokuments vorbelegt (z. B. „2-4, 7“), sonst leer (alle Seiten).
- Neu: Hinweis „Der Stempel gehört zu den Seiten und wandert mit, wenn du sie verschiebst. Gesetzt wird er beim Speichern.“
- Knöpfe „Stempel übernehmen“ · „Stempel entfernen“ (nur, wenn eine Seite des Dokuments einen hat) · „Abbrechen“ (auch Esc)

**Unterschrift, Bereich in der rechten Spalte**

- Überschrift „Unterschrift“, darunter „Für Seite 3 von Vertrag“
- Zeichenfläche, Bild-Auswahl, Farbe, „Weißen Hintergrund entfernen“ und der rechtliche Hinweis aus „PDF unterschreiben“
- Neu: Hinweis „Die Unterschrift gehört zur Seite und wandert mit, wenn du sie verschiebst oder drehst. Gesetzt wird sie beim Speichern.“
- Neu: Meldung, wenn noch keine Unterschrift erstellt ist: „Erstell zuerst deine Unterschrift: zeichnen oder ein Bild auswählen.“
- Knöpfe „Auf Seite 3 setzen …“ (öffnet den Dialog) · „Unterschriften von Seite 3 entfernen“ (nur, wenn die Seite welche hat) · „Abbrechen“ (auch Esc)

**Unterschrift, Dialog zum Platzieren**

- Überschrift „Unterschrift auf Seite 3 von Vertrag“
- Hinweis „Setz die Unterschrift auf die Seite und zieh sie an die richtige Stelle, am Eck änderst du die Größe. Mit der Tastatur: Pfeiltasten verschieben, Umschalt und Pfeiltasten ändern die Größe, Entf entfernt sie.“ (aus „PDF unterschreiben“, dort freigegeben)
- Knöpfe „Unterschrift auf diese Seite setzen“ · „Abbrechen“ · „Übernehmen“
- Name eines platzierten Rechtecks für Screenreader: „Unterschrift 1 auf Seite 3 von Vertrag“

**Ansagen, Seitenbeschriftung und Befehlsnamen**

| Anlass | Text |
|---|---|
| Stempel übernommen | „Stempel für 5 Seiten von Vertrag übernommen. Er wird beim Speichern gesetzt.“ (eine Seite: „für 1 Seite“) |
| Stempel entfernt | „Stempel von Vertrag entfernt“ |
| Unterschrift übernommen | „Unterschrift auf Seite 3 von Vertrag übernommen. Sie wird beim Speichern gesetzt.“ |
| Unterschriften entfernt | „Unterschriften von Seite 3 von Vertrag entfernt“ |
| Seitenbeschriftung (Screenreader) | wie bisher, am Ende „, mit Stempel“, „, mit Unterschrift“ bzw. „, mit 2 Unterschriften“ |
| Verlauf | „Rückgängig: Stempel“ / „Rückgängig: Stempel entfernen“ / „Rückgängig: Unterschrift“ / „Rückgängig: Unterschrift entfernen“ (ebenso „Wiederholen: …“) |

**Erklärtext der Werkstatt** (freigegeben, eingebaut), Satz nach dem Satz zu den Seitenzahlen: „Stempel und Unterschriften gehören zur Seite und wandern mit, wenn du sie verschiebst; gesetzt werden sie beim Speichern.“

## 12. Stufe 2, Schritt 2.3: Schwärzen und Formular ausfüllen in der Werkstatt

Stand: 27.09.2026. **Freigegeben von Leon am 27.09.2026** mit einer Änderung (Untertitel beim Formular, eingebaut), einschließlich des Satzes für den Erklärtext (eingebaut). Fundorte: `src/tools/pdf-werkstatt/texts.ts` (Abschnitt „Stufe 2.3“), `src/tools/pdf-werkstatt/main.html` (Dialoge `#ws-redact` und `#ws-unredacted-dialog`, Hinweis `#ws-unredacted`), `src/tools/pdf-schwaerzen/embed.ts`, `src/tools/pdf-formular-ausfuellen/embed.ts`. Unverändert aus den Einzelwerkzeugen (freigegeben): beim Schwärzen „Auflösung der neuen PDF“ mit den drei Stufen, „Geschwärzte Bereiche“, „Seiten mit Schwärzung“, der Prüfhinweis „Prüf die neue PDF, bevor du sie weitergibst …“, der Bedienhinweis zum Ziehen, „Bereich hinzufügen“, „Bereiche dieser Seite entfernen“, „Vorherige Seite“/„Nächste Seite“, „Bereich 1 auf Seite 2“, „Seite 3 von 12 …“, „PDF wird erstellt …“ und die Fehlermeldung „Die geschwärzte PDF konnte nicht erzeugt werden …“; beim Formular alle Feldbeschriftungen, „(Pflichtfeld)“, „Formular festschreiben“, „Felder“, „Pflichtfelder leer“, die Hinweise zu Signatur und XFA-Fassung und alle Meldungen (XFA, keine Felder, Zeichen außerhalb der Schrift).

**Wo es erscheint**

| Ort | Text |
|---|---|
| Menü „Werkzeuge“ | „Schwärzen …“ (Dokument mit dem Fokus, mit Trennlinie davor) und „Formular ausfüllen …“ (nur aktiv, wenn das Dokument Seiten aus einer PDF mit Formular hat) |
| Menü im Spaltenkopf | „Schwärzen …“ und „Formular ausfüllen …“ nach „Stempel …“ |
| Handy, „Mehr“ | „Schwärzen …“ und „Formular ausfüllen …“ am Ende |
| Seitenbeschriftung (Screenreader) | die neue Datei heißt „Vertrag (geschwärzt).pdf“ bzw. „Antrag (ausgefüllt).pdf“, also z. B. „Seite 2 von 3, aus Vertrag (geschwärzt).pdf Seite 2“ |

**Schwärzen, Bereich in der rechten Spalte**

- Überschrift „Schwärzen“, darunter „Für Vertrag, 3 Seiten“
- Neu: Hinweis „Geschwärzt wird das ganze Dokument: Jede Seite wird zum Bild, auch Seiten ohne Bereich. Stempel und Unterschriften bleiben änderbar.“
- Knöpfe „Bereiche festlegen …“ (öffnet den Dialog) · „Dokument schwärzen“ (während der Arbeit „Seite 2 von 3 …“, dann „PDF wird erstellt …“) · „Abbrechen“ (auch Esc)

**Schwärzen, Dialog**

- Überschrift „Bereiche schwärzen in Vertrag“, Seitenwechsel mit „Seite 1 von 3“
- Knöpfe „Abbrechen“ · „Übernehmen“

**Ansagen und Meldungen beim Schwärzen**

| Anlass | Text |
|---|---|
| Geschwärzt (Ansage) | „Vertrag ist geschwärzt. Prüf das Ergebnis, bevor du es weitergibst.“, falls zutreffend gefolgt vom Hinweis unten |
| Dokument während des Schwärzens geändert, oder eine Seite mit Bereichen seitdem gedreht oder ersetzt | „Das Dokument hat sich während des Schwärzens geändert. Schwärze es noch einmal.“ |
| Verlauf | „Rückgängig: Schwärzen“ / „Wiederholen: Schwärzen“ |

**Hinweis auf nicht geschwärzte Seiten** (oben in der rechten Spalte, in der Fehlerfarbe, sichtbar auch bei offenem Werkzeug; je Dokument ein Satz mit Knopf)

- „2 Seiten in ‚Anlagen‘ stammen aus derselben Datei und sind nicht geschwärzt.“ (eine Seite: „1 Seite in ‚Anlagen‘ stammt aus derselben Datei und ist nicht geschwärzt.“)
- Knopf „Zu den Seiten“: wählt diese Seiten aus und springt zur ersten

**Vor dem Speichern** („… als PDF speichern“, „Auswahl als neue PDF“, „Alle als ZIP speichern“), nur wenn das Gespeicherte solche Seiten enthält: Dialog

- Überschrift „Nicht geschwärzte Seiten“, darunter dieselben Sätze wie im Hinweis
- Knöpfe „Zu den Seiten“ · „Abbrechen“ (hat den Fokus) · „Trotzdem speichern“

**Formular ausfüllen, Bereich in der rechten Spalte**

- Überschrift „Formular ausfüllen“, darunter „Für Antrag, Formular aus Antrag.pdf“
- Beim Öffnen kurz „Formular wird gelesen …“
- Felder, Einstellung und Hinweise aus „PDF-Formular ausfüllen“ (ohne die Vorschau der Seite)
- Neu: Hinweis „Die ausgefüllten Seiten ersetzen in diesem Dokument die Seiten aus Antrag.pdf.“
- Knöpfe „Formular übernehmen“ (während der Arbeit „Wird ausgefüllt …“) · „Abbrechen“ (auch Esc)

**Ansagen und Meldungen beim Formular**

| Anlass | Text |
|---|---|
| Übernommen (Ansage) | „Formular in Antrag übernommen“ |
| Dokument währenddessen geändert | „Das Dokument hat sich während des Ausfüllens geändert. Übernimm das Formular noch einmal.“ |
| Verlauf | „Rückgängig: Formular ausfüllen“ / „Wiederholen: Formular ausfüllen“ |

**Meldung nach dem Speichern:** Ein geschwärztes oder ausgefülltes Dokument, das sonst unverändert ist, wird als diese neue Datei ausgegeben. Der Zusatz „Es war unverändert: Gespeichert ist die Originaldatei.“ entfällt dann, weil er an das ungeschwärzte Original denken ließe; die Meldung lautet nur „Fertig: Vertrag.pdf ist gespeichert.“

**Dateiname beim Speichern** (Leon, 27.09.2026): Ein geschwärztes Dokument heißt „Vertrag (geschwärzt).pdf“, auch im ZIP, solange es nach dem Schwärzen nicht umbenannt wurde und alle Seiten geschwärzt sind.

**Erklärtext der Werkstatt** (freigegeben, eingebaut), nach dem Satz zu Stempel und Unterschrift: „Schwärzen und Formular ausfüllen erzeugen neue Seiten: Beim Schwärzen wird jede Seite des Dokuments zum Bild, sodass nichts vom Original übrig bleibt.“

## 13. Stufe 2, Schritt 2.4: versteckte Angaben beim Speichern

Stand: 27.09.2026. **Freigegeben von Leon am 27.09.2026** mit einer Änderung (Meldungen nach dem Speichern, eingebaut). Fundort: `src/tools/pdf-werkstatt/texts.ts` (Abschnitt „Stufe 2.4“ und `exportDone`). Die Fehlermeldung ist aus „PDF-Metadaten entfernen“ übernommen (freigegeben).

**Einstellung** (rechte Spalte, über den Speichern-Knöpfen)

- Beschriftung „Versteckte Angaben“, Umschalter „Behalten“ · „Entfernen“ (Vorgabe „Behalten“)
- Hinweis darunter: „Angaben wie Autor, Titel, Programm und Datum. Beim Entfernen wird jedes Dokument neu zusammengesetzt und vor dem Speichern geprüft.“

**Hinweis** (unter den Speichern-Knöpfen, nur bei „Behalten“ und wenn es zutrifft)

- ein Dokument: „Vertrag enthält versteckte Angaben wie Autor, Programm oder Datum. Sie bleiben beim Speichern erhalten.“
- mehrere: „2 Dokumente enthalten versteckte Angaben wie Autor, Programm oder Datum: Vertrag, Anlagen. Sie bleiben beim Speichern erhalten.“

**Meldung nach dem Speichern** mit „Entfernen“, angehängt an die bisherige Meldung

- ein Dokument: „Fertig: Vertrag.pdf ist gespeichert. Die Datei enthält keine versteckten Angaben mehr.“
- ZIP: „Fertig: 2 Dokumente sind als ZIP gespeichert. Die Dateien enthalten keine versteckten Angaben mehr.“

**Fehlermeldung**, wenn die Prüfung noch etwas findet (aus dem Einzelwerkzeug): „In der neuen Datei wurden noch Angaben gefunden. Sie wird deshalb nicht angeboten.“

**Übergabe aus „PDF-Metadaten entfernen“** (M6, Leon 27.09.2026): Die Einstellung steht dann auf „Entfernen“, bei allen anderen Übergaben auf „Behalten“. Keine neuen Texte.

