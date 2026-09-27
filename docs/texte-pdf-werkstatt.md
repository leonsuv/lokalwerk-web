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

## 10. Stufe 2, Schritt 2.1: Seitenzahlen in der Werkstatt (Entwurf zur Freigabe, Anhaltepunkt C)

Stand: 27.09.2026. **Noch nicht freigegeben.** Fundorte: `src/tools/pdf-werkstatt/texts.ts` (Abschnitt „Stufe 2“), `src/tools/pdf-seitenzahlen/embed.ts`, Befehlsnamen `src/core/workshop/commands.ts`.

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

**Vorschlag, noch nicht eingebaut** (Erklärtext der Werkstatt ist freigegeben): ein Satz am Ende von „So funktioniert es“: „Über „Werkzeuge“ bekommt ein Dokument Seitenzahlen; sie werden beim Speichern gesetzt und passen zur dann gültigen Reihenfolge.“
