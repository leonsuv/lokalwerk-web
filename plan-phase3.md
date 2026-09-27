# Plan Phase 3: PDF-Werkstatt

Stand: 27.09.2026. **Plan und Entwurf freigegeben von Leon am 27.09.2026**, Entscheidungen unten. Umsetzung ab Stufe 1. Es gelten AGENTS.md, plan.md und plan-phase2.md unverändert; wo dieser Plan etwas Neues festlegt, steht es hier.

Klickbarer Oberflächen-Entwurf: `prototype/pdf-werkstatt-entwurf.html` (nur Referenz, wird nie gebaut oder ausgeliefert; Platzhalter-Seiten statt echter PDFs).

Aufwand wie in plan-phase2.md Abschnitt 0: **S** ein Schritt, höchstens ein Tag; **M** zwei bis drei Tage; **L** eine Woche oder mehr.

## Entscheidungen (Leon, 27.09.2026)

Antworten auf die offenen Fragen aus Abschnitt 14. Wo die Abschnitte 1–13 davon abweichen, gilt diese Liste.

| Nr. | Frage | Entscheidung |
|---|---|---|
| W1 | Übergabe ohne Neuladen | Ja, wie auf der Startseite (Abschnitt 5.3). |
| W2 | Kostenlos/Pro | Stufe 1 kostenlos. Stufe 2 kostenlos für einzelne Dokumente; Stapel auf mehrere Dokumente als Pro-Kandidat, **noch nicht bauen**. Stufe 3: PDF verkleinern **kostenlos** (wichtiger Suchbegriff), Texterkennung Pro, Projekt speichern Pro-Kandidat. |
| W3 | Name und Adresse | „PDF-Werkstatt“ unter `/pdf-werkstatt/`. |
| W4 | Hervorhebung | Wie vorgeschlagen. Die Startseiten-Ablage öffnet bei PDFs **nicht** sofort die Werkstatt, sondern zeigt die Auswahl mit der Werkstatt an erster Stelle (viele haben nur eine schnelle Einzelaufgabe). |
| W5 | Tastenkürzel | Freigegeben mit Änderungen: Duplizieren auf **D** (ohne Modifier, wie R), weil Cmd+Umschalt+D auf dem Mac in Safari und Chrome belegt ist. Alt+Pfeil links/rechts ist unter Windows „Zurück/Vorwärts“; testen oder andere Kombination vorschlagen, siehe 6.2. Übersicht mit „?“: ja. Interne Ablage für Strg/Cmd+X/C/V: ja. |
| W6 | Speicher | Nur Hinweis ab 1 GB, keine harte Grenze. |
| W7 | Verlauf | 100 Schritte, dazu Freigabe von Quellen aus „Einbacken“ wie in Abschnitt 2 und 7.2. |
| W8 | Einzelwerkzeuge auf Werkstatt-Module umstellen | Ja, aber **erst nach Stufe 2**, als eigener Schritt mit eigener Freigabe. Sichtbar bleibt alles gleich. |
| W9 | Gemischte Ablage (PDFs und Bilder) auf der Startseite | Ja; dann wird nur die Werkstatt angeboten. |
| W10 | Handy | Nur „Nach vorne/Nach hinten“ und „Verschieben nach …“, **kein Ziehen in Stufe 1**. |
| W11 | Dateinamen | Wie vorgeschlagen; doppelte Dokumentnamen im ZIP automatisch mit „(2)“, „(3)“ usw. unterscheiden. |
| W12 | Unverändertes Dokument | Originaldatei ausgeben; der Exporthinweis sagt kurz, dass sie unverändert übernommen wurde. |
| W13 | Einbacken | Einverstanden. |
| W14 | Leerseite | Größe wie die Nachbarseite als Vorgabe; DIN A4 hoch und quer als Alternativen. |

---

## 1. Ziel und Grundprinzip

Die PDF-Werkstatt ist ein zusammenhängender Arbeitsbereich für PDFs unter `/pdf-werkstatt/`, eine Seite von Lokalwerk wie alle anderen: Kopfzeile, „0 B hochgeladen“-Plakette, Footer, Designsystem, Seitenregister. Sie ersetzt die Einzelwerkzeuge nicht; diese bleiben als eigene Seiten (Suchmaschinen) und verlinken auf die Werkstatt.

**Nicht-destruktiv:** Der Arbeitsbereich besteht aus Dokumenten, die nur Verweise auf Seiten enthalten (Quelle, Seitenindex, Drehung, später weitere Operationen). Ein Dokument kann Seiten aus beliebig vielen Quellen mischen („virtuelles Dokument“). Die geladenen Dateien werden nie verändert. Echte PDFs entstehen erst beim Export, im Worker mit pdf-lib.

**Befehle statt direkter Änderungen:** Jede Änderung ist ein Befehl, der aus dem alten Zustand einen neuen erzeugt. Der Zustand ist unveränderlich (neue Objekte statt Änderungen), der Verlauf ist eine Liste von Zuständen. Rückgängig und Wiederholen sind damit einfach und sicher; weil Zustände nur Verweise enthalten, kostet ein Verlaufsschritt wenige Kilobyte, auch bei 500 Seiten.

**Alles bleibt im Browser** (AGENTS.md Regel 1): keine Anfrage an fremde Domains, kein Browser-Speicher (Regel 5), Warnung vor dem Verlassen der Seite mit ungesicherter Arbeit.

## 2. Datenmodell

Reine Typen und Funktionen in `src/core/workshop/` (neu), ohne DOM, vollständig in Node testbar.

```ts
/** Eine geladene Datei. Bytes liegen nur im Worker und bei pdf.js, nicht im Zustand. */
interface Source {
  id: SourceId;              // fortlaufend, z. B. 's3'
  kind: 'pdf' | 'image';
  name: string;              // Dateiname, nur zur Anzeige
  pageCount: number;         // Bilder: 1
  pageSizes: PageBox[];      // Breite/Höhe in pt je Seite, für Platzhalter und Leerseiten
  facts: SourceFacts;        // Formularfelder, Lesezeichen, Signatur, XFA (für Export-Hinweise)
}

/** Eine Seite im Dokument: Verweis plus Operationen */
type PageRef =
  | { key: PageKey; kind: 'source'; source: SourceId; index: number; rotate: Rotation; ops: PageOp[] }
  | { key: PageKey; kind: 'blank'; box: PageBox; rotate: Rotation; ops: PageOp[] };
// key: stabile ID je Seitenverweis (für Auswahl, DOM, Ansagen), auch bei Duplikaten eindeutig
// Bilder sind Quellen mit einer Seite: kind 'source' mit Source.kind === 'image'

/** Später (Stufe 2): Operationen, die erst beim Export angewendet werden */
type PageOp = { type: 'stamp'; ... } | { type: 'signature'; ... };   // siehe Abschnitt 7.2

interface Doc {
  id: DocId;
  name: string;              // änderbar; Vorgabe: Dateiname ohne .pdf
  pages: readonly PageRef[];
  docOps: DocOp[];           // Stufe 2: z. B. Seitenzahlen (hängen von der Endreihenfolge ab)
}

interface WorkshopState {
  docs: readonly Doc[];      // Reihenfolge der Spalten
  sources: ReadonlyMap<SourceId, Source>;
}

/** Auswahl gehört nicht zum Verlauf (Rückgängig ändert die Auswahl nicht mit) */
interface Selection { keys: ReadonlySet<PageKey>; anchor: PageKey | null; focus: PageKey | null }

/** Ein Befehl: Name für Ansage und Menü, reine Funktion Zustand -> Zustand */
interface Command { label: string; apply(state: WorkshopState): WorkshopState }

interface History { past: WorkshopState[]; present: WorkshopState; future: WorkshopState[]; limit: number }
```

Befehle der Stufe 1 (je eine reine Funktion mit Tests): `addSources`, `newDoc`, `renameDoc`, `closeDoc`, `duplicateDoc`, `movePages(keys, targetDoc, targetIndex)`, `copyPages`, `rotatePages(keys, ±90)`, `deletePages`, `duplicatePages`, `insertBlank(doc, index, box)`, `insertImages(doc, index, sources)`, `splitDoc(doc, index)`, `mergeDocs(ids)`, `extractToNewDoc(keys)`.

Verlaufsgrenze: 100 Schritte (W7). Quellen, auf die weder der aktuelle Zustand noch der Verlauf verweist, werden freigegeben (pdf.js-Dokument schließen, Bytes im Worker löschen).

## 3. Architektur

```
Hauptthread (page.ts der Werkstatt)
  Zustand + Verlauf (core/workshop)      Oberfläche: Spalten, Auswahl, Ziehen, Tastatur, Vorschau
  pdf.js (ui/pdfjs) für Vorschaubilder   ↔  eigener pdf.js-Worker (wie heute)
  Export-Auftrag: Zustand (nur Verweise) →  workshop.worker.ts (pdf-lib)
                                              hält die Quell-Bytes, baut PDFs, ZIP
```

- **Quellen laden:** Datei → Worker bekommt die `File` (strukturierte Kopie, kein Einlesen im Hauptthread), liest sie, prüft sie mit pdf-lib (`loadPdf`, verschlüsselt → Ablehnung wie heute), sammelt Fakten (Formular, Lesezeichen, Signatur), behält die Bytes. Parallel öffnet der Hauptthread die Datei mit pdf.js (`openPdf`) für Seitengrößen und Vorschaubilder. Die Bytes liegen damit zweimal im Speicher (Export-Worker, pdf.js-Worker), im Hauptthread nicht.
- **Vorschaubilder:** `LazyRenderer` (vorhanden) rendert nur sichtbare Seiten, eines nach dem anderen; neu kommt Freigeben beim Verlassen des sichtbaren Bereichs (Canvas auf 0 × 0) und eine Obergrenze gleichzeitig gehaltener Bilder (z. B. 200). Platzhalter haben das Seitenverhältnis aus `pageSizes`, damit nichts springt.
- **Große Vorschau:** eine Seite in hoher Auflösung, nur solange sie offen ist.
- **Export:** Der Worker bekommt nur die Verweise der betroffenen Dokumente, lädt jede Quelle einmal mit pdf-lib, kopiert Seiten (`copyPages`), setzt Drehung, fügt Leerseiten und Bildseiten ein (Platzierung aus `from-images`), schreibt ohne Producer-Angaben (`updateMetadata: false`). Mehrere Dokumente → ZIP (vorhandener eigener ZIP-Code). Fortschritt über das Worker-Protokoll.
- **Seitenwechsel ohne Neuladen** für die Übergabe aus Startseite und Einzelwerkzeugen (Abschnitt 5.3).

## 4. Wiederverwendung: vorhanden, erweitert, neu

### 4.1 Unverändert wiederverwendet

| Modul | Wofür in der Werkstatt |
|---|---|
| `src/core/pdf/merge.ts` (`loadPdf`, `PdfError`, `toPdfError`) | Laden und Fehlerarten (leer, verschlüsselt, beschädigt, zu wenig Speicher) im Worker |
| `src/core/pdf/from-images.ts` (`placeImage`, `A4`, `MM`) | Bildseiten und DIN-A4-Leerseiten |
| `src/core/pdf/stamp-geometry.ts` (`normalizeRotation`, `visibleSize`) | Drehung und sichtbare Seitengröße |
| `src/core/pdf/page-ranges.ts` | Eingabe „Seiten 3–7“ beim Teilen und Auswählen per Tastatur |
| `src/core/pdf/stamp.ts` (`isSigned`, `inspectForStamp`) | Signatur erkennen für den Export-Hinweis |
| `src/core/pdf/form.ts` (`readForm`) | Formularfelder und XFA erkennen für den Export-Hinweis |
| `src/ui/pdfjs/pdfjs.ts` (`openPdf`, `closePdf`, `pageSize`, `renderPageAt`, `PdfOpenError`) | Vorschaubilder, große Vorschau, Seitengrößen |
| `src/ui/worker-protocol.ts` | Aufträge an den Werkstatt-Worker |
| `src/ui/dropzone.ts`, `src/ui/toast.ts`, `src/ui/download.ts`, `src/ui/zip.ts`, `src/ui/local-counter.ts`, `src/ui/dom.ts` | Ablegen, Meldungen, Speichern, ZIP, Plakette |
| `src/core/files/classify.ts` | PDF und Bilder beim Ablegen unterscheiden |
| Designsystem (`src/styles/`), Icons (`src/partials/icons.svg`), Seitenrahmen (`build/html-partials.ts`) | Aussehen wie alle Seiten |

### 4.2 Erweitert (abwärtskompatibel, Einzelwerkzeuge nutzen sie weiter)

| Modul | Erweiterung |
|---|---|
| `src/core/pdf/organize.ts` | wird zu einem Sonderfall des neuen `assemble.ts` (eine Quelle); API `organizePdf` bleibt, Tests bleiben |
| `src/ui/lazy-render.ts` | optionales Freigeben beim Verlassen des Sichtbereichs (`observe(el, job, release?)`), Obergrenze gleichzeitig gehaltener Bilder, Abbruch bei `clear()` |
| `src/ui/worker-protocol.ts` | optionales `transfer` auch für Anfragen (große Puffer ohne Kopie); bestehende Aufrufe unverändert |
| `src/tools/home/page.ts` (Werkzeug öffnen ohne Neuladen) | Kern wandert nach `src/ui/tool-switch.ts`, damit auch Einzelwerkzeuge in die Werkstatt wechseln können; die Startseite nutzt dasselbe Modul |
| `src/tools/home/loaders.ts` | Eintrag für die Werkstatt; bei PDFs steht „In der PDF-Werkstatt öffnen“ zuerst |
| `src/tools/bilder-zu-pdf/prepare.ts` | wandert nach `src/ui/image-prepare.ts` (Bilder neu kodieren, Metadaten weg), damit Werkstatt und „Bilder zu PDF“ denselben Code nutzen |
| `build/pages.ts` (Register) | neuer Eintrag `pdf-werkstatt`; neues optionales Feld `featured` für die hervorgehobene Karte auf Startseite und `/werkzeuge/` |
| `build/licenses.ts` (`USED_IN`) | `pdf-werkstatt` bei pdf-lib und pdfjs-dist (der Build prüft das ohnehin) |
| PDF-Einzelwerkzeuge (`src/tools/pdf-*/page.ts`) | Stufe 1: Knopf „In der PDF-Werkstatt weiterbearbeiten“ nach dem Laden. Stufe 2: einbettbar (Abschnitt 7.1) |

### 4.3 Neu

| Modul | Inhalt | Größe (geschätzt) |
|---|---|---|
| `src/core/workshop/model.ts` | Typen, IDs, Hilfsfunktionen (Seite finden, Position in Dokument) | ~150 Zeilen |
| `src/core/workshop/commands.ts` | die Befehle aus Abschnitt 2, rein | ~350 Zeilen |
| `src/core/workshop/history.ts` | Verlauf mit Grenze, Rückgängig, Wiederholen, freigebbare Quellen ermitteln | ~80 Zeilen |
| `src/core/workshop/selection.ts` | Auswahl wie im Dateimanager (Klick, Umschalt-Bereich über Dokumentgrenzen, Strg/Cmd umschalten) | ~120 Zeilen |
| `src/core/pdf/assemble.ts` | Export mehrerer Dokumente aus mehreren Quellen, Leer- und Bildseiten | ~150 Zeilen |
| `src/tools/pdf-werkstatt/` | `main.html`, `page.ts`, `workshop.worker.ts`, `columns.ts`, `thumbs.ts`, `drag.ts`, `keyboard.ts`, `context-menu.ts`, `preview.ts`, `announce.ts`, `mobile.ts` | ~1.800 Zeilen zusammen |
| `src/ui/tool-switch.ts` | Seitenwechsel ohne Neuladen, gemeinsam für Startseite und Einzelwerkzeuge | ~80 Zeilen |
| `pages/pdf-werkstatt/index.html` | Seitenrahmen wie alle Werkzeuge | – |

## 5. Oberfläche und Integration

### 5.1 Aufbau (Desktop)

Kopf wie jede Werkzeugseite (Icon, Titel „PDF-Werkstatt“, ein Satz). Darunter:

- **Werkzeugleiste** (bleibt beim Scrollen oben): Hinzufügen (PDF oder Bilder), Neues Dokument · Drehen links/rechts, Duplizieren, Leere Seite, Löschen · Teilen, Zusammenführen · Rückgängig, Wiederholen · Große Vorschau · Werkzeuge (Stufe 2) · Exportieren. Knöpfe mit Text, nicht nur Symbole; was zur Auswahl nicht passt, ist deaktiviert.
- **Spalten**: ein Dokument je Spalte, nebeneinander, waagerecht scrollbar. Spaltenkopf mit Name (umbenennbar), Seitenzahl, Menü (Umbenennen, Duplizieren, Hier teilen, Exportieren, Schließen). Seiten als Vorschaubilder untereinander, zwei Spalten breit, mit Seitennummer und farbiger Marke der Quelle (A, B, …), damit gemischte Dokumente lesbar bleiben.
- **Rechte Spalte** (wie bei allen Werkzeugen): Auswahl („3 Seiten aus 2 Dokumenten“), Export (Dokument, Auswahl als neue PDF, alle als ZIP), Hinweise zu Formularfeldern, Lesezeichen, Signaturen.
- **Große Vorschau**: Überlagerung mit einer Seite, Blättern, Drehen, Schließen mit Esc.

### 5.2 Startseite, `/werkzeuge/` und Einzelwerkzeuge

- **Register:** eigener Eintrag, Kategorie PDF, `featured: true`. Auf `/werkzeuge/` steht sie als breite erste Karte der Kategorie PDF, auf der Startseite als hervorgehobene Karte über dem Werkzeug-Raster.
- **Startseite:** Beim Ablegen von PDFs (auch mehreren) erscheint die Auswahl mit „In der PDF-Werkstatt öffnen“ als erster Option; die Werkstatt öffnet sich nicht sofort (W4). Bei gemischter Ablage aus PDFs und Bildern wird nur die Werkstatt angeboten (W9). Die Dateien bleiben im Arbeitsspeicher.
- **Einzelwerkzeuge:** Nach dem Laden einer Datei erscheint „In der PDF-Werkstatt weiterbearbeiten“. Klick: Werkstatt ohne Neuladen öffnen, Datei(en) im Speicher übergeben. Betroffen: PDFs zusammenfügen, PDF teilen, PDF-Seiten bearbeiten, PDF zu Bildern, PDF schwärzen, Unterschrift einfügen, PDF-Formular ausfüllen, Seitenzahlen, Stempel, PDF-Metadaten entfernen, Bilder zu PDF, Dokument scannen (nach dem Erzeugen).
- Die Erklärtexte der Einzelwerkzeuge bekommen einen Satz mit Link zur Werkstatt (Texte zur Freigabe).

### 5.3 Übergabe im Speicher ohne Browser-Speicher

Wie heute auf der Startseite (`src/tools/home/page.ts`): Markup der Werkstatt dynamisch laden, in `<main>` einsetzen, `history.pushState` auf `/pdf-werkstatt/`, Titel und Beschreibung setzen, Dateien übergeben. Die Zurück-Taste lädt die vorige Seite neu. Werkstatt-Code und pdf-lib werden erst dabei geladen (chunk-guard bleibt erfüllt, weil das dynamisch geschieht). Kein `localStorage`, kein IndexedDB, kein `postMessage` an andere Fenster. Bei ungesicherter Arbeit in der Werkstatt fragt die Zurück-Taste vorher (`beforeunload`).

### 5.4 Handy (390 px): ehrliche Einschätzung

Mehrere Spalten und Ziehen zwischen Dokumenten sind auf 390 px nicht sinnvoll: Vorschaubilder wären zu klein, Ziehen kollidiert mit Scrollen, lange Wege über mehrere Dokumente. Vorschlag für eine **vereinfachte Ansicht**:

- Ein Dokument zur Zeit, Wechsel über eine Auswahlleiste oben („Vertrag (6) ▾“).
- Raster mit drei Seiten je Zeile.
- Tippen öffnet die große Vorschau; ein Knopf „Auswählen“ schaltet in den Auswahlmodus mit Häkchen (lange drücken ebenso).
- Untere Aktionsleiste: Drehen, Löschen, Verschieben nach …, Mehr. „Verschieben nach …“ öffnet eine Liste der Dokumente und eine Position („Anfang“, „Ende“, „nach Seite …“). Das ersetzt Ziehen zwischen Dokumenten.
- Umsortieren innerhalb eines Dokuments: „Nach vorne“/„Nach hinten“ in der Aktionsleiste und in der großen Vorschau. Kein Ziehen auf dem Handy in Stufe 1 (W10).
- Export und Rückgängig wie am Desktop.
- Grenze: auf älteren Handys weniger Seiten (Speicher), Meldung wie in Abschnitt 8.

## 6. Interaktion

### 6.1 Maus

- Klick wählt eine Seite, Umschalt+Klick wählt einen Bereich (auch über Dokumentgrenzen, in der Reihenfolge der Spalten), Strg/Cmd+Klick schaltet einzelne Seiten dazu oder weg. Klick auf freie Fläche hebt die Auswahl auf.
- Ziehen: Seiten der Auswahl (oder die gezogene Seite) wandern gemeinsam; eine Einfügemarke zeigt das Ziel, auch in anderen Spalten und in leeren Dokumenten; am Rand scrollt die Ansicht mit. Esc bricht ab. Alt beim Loslassen kopiert statt zu verschieben.
- Doppelklick öffnet die große Vorschau. Rechtsklick öffnet das Kontextmenü mit allen Aktionen.
- Ablegen von Dateien aus dem Dateimanager auf eine Spalte fügt sie dort ein, auf freie Fläche als neues Dokument.

### 6.2 Tastatur (jede Aktion ohne Ziehen, WCAG 2.1.1 und 2.5.7)

| Taste | Wirkung |
|---|---|
| Tab / Umschalt+Tab | zwischen Werkzeugleiste, Spalten, rechter Spalte |
| Pfeiltasten | Fokus auf die nächste Seite (links/rechts im Raster, oben/unten) |
| Strg/Cmd+Pfeil links/rechts | Fokus ins Nachbardokument |
| Leertaste | Seite mit Fokus auswählen oder abwählen |
| Umschalt+Pfeiltasten | Auswahl erweitern |
| Strg/Cmd+A | alle Seiten des Dokuments auswählen |
| Esc | Auswahl aufheben, Ziehen oder Menü abbrechen |
| Strg/Cmd+X, Strg/Cmd+C, Strg/Cmd+V | Seiten ausschneiden, kopieren, vor der Fokus-Seite einfügen (interne Ablage, nicht die Zwischenablage des Systems) |
| Alt+Pfeil hoch/runter | Auswahl eine Position nach vorne/hinten |
| ~~Alt+Pfeil links/rechts~~ → **M** (Vorschlag, W5) | „Verschieben nach …“: Dialog mit Ziel-Dokument und Position, derselbe wie auf dem Handy. Alt+Pfeil links/rechts ist unter Windows und Linux die Browser-Navigation; das ließ sich hier nicht prüfen (nur Chrome und Safari unter macOS vorhanden, wo die Kombination nicht belegt ist), also unsicher. Die Funktion bleibt außerdem über das Kontextmenü erreichbar. |
| R / Umschalt+R | rechts / links drehen |
| Entf | Auswahl löschen |
| D | Auswahl duplizieren (W5; Strg+D und Cmd+Umschalt+D belegt der Browser) |
| Strg/Cmd+Z, Strg/Cmd+Umschalt+Z, Strg+Y | Rückgängig, Wiederholen |
| Eingabe | große Vorschau; darin Pfeiltasten blättern, Esc schließt |
| F2 | Dokument umbenennen (im Spaltenkopf) |
| Umschalt+F10 oder Kontextmenü-Taste | Kontextmenü |

Kürzel gelten nur, wenn der Fokus in den Spalten liegt, nie in Eingabefeldern. Eine Übersicht öffnet sich mit „?“ (W5).

Hinweis Screenreader: Einzelbuchstaben (R, D, M) sind in NVDA und JAWS im Lesemodus eigene Befehle. Weil jede Spalte eine `listbox` ist, schalten beide dort in den Fokusmodus und reichen die Tasten an die Seite weiter; das wird in Schritt 1.4 mit NVDA geprüft (docs/livegang.md, Screenreader-Tests).

### 6.3 Touch

Auf Tablets wie am Desktop, Ziehen nach kurzem Halten (300 ms), damit Scrollen frei bleibt. Auf Handys die vereinfachte Ansicht (5.4).

### 6.4 Screenreader

- Jede Spalte ist eine Liste mit Mehrfachauswahl (`role="listbox"`, `aria-multiselectable`), jede Seite eine Option mit Beschriftung wie „Seite 3 von 12, aus Anlagen.pdf Seite 1, gedreht um 90 Grad, ausgewählt“. Fokus über „roving tabindex“.
- Ansagen über eine unsichtbare Live-Region (`aria-live="polite"`): „3 Seiten ausgewählt“, „2 Seiten nach Vertrag an Position 4 verschoben“, „Rückgängig: Drehen“, „Export fertig: Vertrag.pdf“.
- Die Einfügemarke beim Ziehen hat eine Textentsprechung („Ziel: vor Seite 5 von Vertrag“).

### 6.5 Ziehen: selbst bauen

Eigene Umsetzung mit Pointer Events (etwa 350 Zeilen in `drag.ts`), keine Bibliothek. Gründe: HTML5-Drag-and-Drop funktioniert auf iOS-Touch und bei Mehrfachauswahl schlecht; vorhandene Bibliotheken passen nicht (dnd-kit braucht React; SortableJS, MIT, etwa 45 KB, deckt Mehrfachziehen zwischen Listen nur mit Zusatzmodul ab und bringt keine Tastaturbedienung mit, die wir ohnehin selbst bauen müssen). Die Pointer-Logik existiert schon in ähnlicher Form in `src/ui/rect-editor.ts`.

**Keine neuen Abhängigkeiten in Stufe 1 und 2.**

## 7. Stufe 2: vorhandene Werkzeuge in der Werkstatt

### 7.1 Einbetten statt Nachbau

Die sechs Werkzeuge (Seitenzahlen, Stempel, Schwärzen, Unterschrift, Metadaten entfernen, Formular ausfüllen) werden einbettbar: Ihre `page.ts` bekommt eine Funktion `mount(host)`, die dasselbe Markup (`main.html`) in einen Bereich der Werkstatt setzt und statt „Speichern“ das Ergebnis an die Werkstatt zurückgibt. Auf den Einzelseiten ruft der Seitenrahmen `mount` mit dem bisherigen Verhalten auf. Bedienung und Texte sind dieselben. Dafür nötig:

- Elemente nicht mehr beim Laden des Moduls suchen, sondern in `mount` (heute `$('#…')` auf Modulebene).
- Eine kleine Schnittstelle `ToolHost`: Eingabe (PDF-Bytes des betroffenen Dokuments oder der Auswahl), Ergebnis (neue Bytes), Abbruch.
- Der Werkstatt-Bereich zeigt das Werkzeug als Seitenleiste oder Überlagerung (Entwurf: rechte Spalte).

### 7.2 Wie ein Werkzeug auf virtuelle Dokumente wirkt

Zwei Wege, je nach Werkzeug:

| Werkzeug | Weg | Begründung |
|---|---|---|
| Seitenzahlen | Dokument-Operation, erst beim Export | hängt von der Endreihenfolge ab („Seite 3 von 12“) |
| Stempel und Wasserzeichen | Seiten-Operation, erst beim Export | Seiten bleiben verschiebbar |
| Unterschrift einfügen | Seiten-Operation, erst beim Export | Platzierung relativ zur Seite (vorhanden: `place-image.ts`) |
| Schwärzen | „Einbacken“: betroffene Seiten werden gerastert, das Ergebnis wird eine neue Quelle | nichts vom Original darf übrig bleiben |
| Formular ausfüllen | „Einbacken“ des betroffenen Dokuments | Formulare hängen am ganzen Dokument |
| Metadaten entfernen | Export-Einstellung (ohnehin ohne Info-Einträge; Hinweis) | kein Seitenbezug |

„Einbacken“ ist ein normaler Befehl: Er ersetzt Seitenverweise durch Verweise auf die neue Quelle. Rückgängig macht ihn rückgängig; die alte Quelle bleibt, solange der Verlauf auf sie verweist (Speicher, Abschnitt 8).

## 8. Leistung und Speicher

Ziel: mindestens 500 Seiten über alle Dokumente ohne spürbares Ruckeln.

- **DOM:** 500 Seitenkacheln sind für den Browser unkritisch, wenn sie leicht sind: fester Platzhalter mit Seitenverhältnis, `content-visibility: auto` je Spalte, keine Schatten auf jeder Kachel beim Ziehen.
- **Bilder:** höchstens etwa 200 gerenderte Vorschaubilder gleichzeitig (bei 150 × 212 px rund 25 MB), außerhalb des Sichtbereichs freigeben. iOS Safari begrenzt den gesamten Canvas-Speicher einer Seite hart; Freigeben (Canvas 0 × 0) ist dort Pflicht, nicht Kür.
- **Befehle:** Verschieben von 100 Seiten ist ein neues Array je betroffenem Dokument, im Millisekundenbereich; die Oberfläche aktualisiert nur betroffene Spalten.
- **Speichergrenzen:** Summe der Quellgrößen mitführen; ab etwa 1 GB Hinweis, dass der Browser knapp werden kann. `out-of-memory` aus dem Worker (vorhanden in `PdfError`) und fehlgeschlagene Vorschaubilder werden verständlich gemeldet („Zu wenig Arbeitsspeicher für diese Datei. Schließe andere Dokumente oder lade die Seite neu.“). Chrome meldet Speicher über `performance.memory`, Safari und Firefox nicht; dort nur die Summe als Richtwert. Nur Hinweis, keine harte Grenze (W6).
- **Export:** großer Export mit Fortschritt; mehrere Dokumente nacheinander, jede Quelle einmal geladen.

## 9. Export und Hinweise

- **Einzelnes Dokument**, **Auswahl als neue PDF**, **alle Dokumente als ZIP**.
- Dateiname: Dokumentname + `.pdf`; ZIP `pdf-werkstatt.zip`. Gleiche Dokumentnamen im ZIP werden automatisch unterschieden: `Vertrag.pdf`, `Vertrag (2).pdf`, `Vertrag (3).pdf` (W11).
- Wie in den Einzelwerkzeugen gehen beim Neuzusammensetzen Formularfelder, Lesezeichen und Signaturen verloren (docs/pdf-lib.md). Die Werkstatt erkennt sie beim Laden und zeigt vor dem Export einen Hinweis an der betroffenen Datei, mit denselben Texten wie in „PDF-Seiten bearbeiten“ und „PDFs zusammenfügen“. Ist ein Dokument unverändert eine einzige Quelle (alle Seiten in Originalreihenfolge, ohne Drehung und Operationen), wird die Originaldatei ausgegeben; der Exporthinweis sagt kurz, dass sie unverändert übernommen wurde (W12).
- Verschlüsselte PDFs werden beim Laden abgelehnt, mit derselben Meldung wie heute.
- Vor dem Verlassen der Seite mit Änderungen seit dem letzten Export: Browser-Warnung (`beforeunload`).

## 10. Stufen, Schritte, Aufwand, Tests, Anhaltepunkte

### Stufe 1: Kern (insgesamt L)

| Schritt | Inhalt | Aufwand | Tests |
|---|---|---|---|
| 1.1 | `core/workshop` (Modell, Befehle, Verlauf, Auswahl) | M | Unit-Tests je Befehl; Eigenschaften: Rückgängig nach Befehl ergibt den alten Zustand, Wiederholen den neuen; Schlüssel bleiben eindeutig; keine Seite geht beim Verschieben verloren oder doppelt |
| 1.2 | `core/pdf/assemble.ts`, `organize.ts` darauf umstellen | S | mehrere Quellen, Drehung, Leer- und Bildseiten, ZIP; Text jeder Seite mit pdf.js zurücklesen; bestehende Tests von „PDF-Seiten bearbeiten“ bleiben grün |
| — | **Anhaltepunkt A**: Modell und Export vorlegen | | |
| 1.3 | Seite, Register, Worker, Laden, Spalten, Vorschaubilder (LazyRenderer erweitert) | M | Browser: 5 PDFs mit je 100 Seiten; Messungen siehe unten |
| 1.4 | Auswahl, Tastatur, Kontextmenü, Ansagen | M | Browser: nur Tastatur; Ansagen in der Live-Region prüfen |
| 1.5 | Ziehen (Maus, Touch), Einfügemarke, Mitscrollen | M | Browser: Ziehen innerhalb und zwischen Spalten, Mehrfachziehen, Abbruch |
| 1.6 | Große Vorschau, Leerseite, Bilder einfügen, Teilen, Zusammenführen, Export | M | Export gegen `assemble`-Tests; Hinweise bei Formular/Lesezeichen/Signatur |
| 1.7 | Handy-Ansicht | M | Browser 390 px; echtes Gerät (docs/livegang.md) |
| 1.8 | Integration: `tool-switch`, Startseite, Knöpfe in den Einzelwerkzeugen, `/werkzeuge/`, Texte | M | Übergabe ohne Neuladen; Zurück-Taste; chunk-guard; keine Anfragen |
| — | **Anhaltepunkt B**: Stufe 1 vorlegen, Texte zur Freigabe | | |

**Leistungstests** (Skript wie `scripts/screenshots.mjs`, Chrome über das DevTools-Protokoll, nicht Teil von `check`): 500 Seiten aus fünf erzeugten PDFs; gemessen werden Zeit bis zu den ersten sichtbaren Vorschaubildern (Ziel unter 1 s), lange Aufgaben im Hauptthread beim Scrollen und Ziehen (Ziel: keine über 100 ms), Zeit für „100 Seiten verschieben“ (unter 50 ms bis zur Anzeige), Speicher nach Scrollen durch alle Seiten (Canvas-Anzahl bleibt unter der Obergrenze), Exportzeit für 500 Seiten. Unit-Test für Befehle mit 5.000 Seiten (Laufzeit).

### Stufe 2: Einzelwerkzeuge einbetten (insgesamt L)

| Schritt | Inhalt | Aufwand |
|---|---|---|
| 2.1 | `ToolHost`-Schnittstelle, Seitenzahlen als Dokument-Operation | M |
| 2.2 | Stempel und Unterschrift als Seiten-Operationen | M |
| 2.3 | Schwärzen und Formular als „Einbacken“ | M |
| 2.4 | Metadaten als Export-Einstellung, Hinweise | S |
| — | **Anhaltepunkt C** nach jedem Werkzeug (Browser-Prüfung vor jedem Commit wie immer) | |

Tests: Die bestehenden Tests der Werkzeuge bleiben; neu Tests für Operationen im Export (Seitenzahlen nach Umsortieren, Stempel auf gedrehten Seiten, Schwärzen ohne Rest des Originals auch nach „Einbacken“ und Rückgängig/Wiederholen).

### Stufe 3: später, nur Skizze

- **PDF verkleinern:** Bilder in PDFs neu kodieren (pdf-lib kann Bildströme lesen und ersetzen; Aufwand L, Qualität prüfen). Keine neue Bibliothek vorgesehen.
- **Texterkennung:** tesseract.js (bereits in AGENTS.md für Pro freigegeben), Sprachdaten lokal ausgeliefert; Textebene unsichtbar über die Seite legen. Aufwand L, CSP (`wasm-unsafe-eval`) nötig, getrennt zu entscheiden.
- **Projekt als lokale Datei speichern und öffnen:** eine Datei (z. B. `.lokalwerk`, ZIP mit Quellen und Zustand als JSON) über Speichern/Öffnen, kein Browser-Speicher. Aufwand M.

## 11. Risiken

| Risiko | Gegenmaßnahme |
|---|---|
| Speicher: Quellen liegen doppelt (pdf.js-Worker, Export-Worker); große Dateien und viele Vorschaubilder | Bytes nicht im Hauptthread; Vorschaubilder begrenzen und freigeben; Summe anzeigen; Fehler verständlich melden |
| iOS Safari: harte Grenze für Canvas-Speicher, Seiten werden ohne Meldung neu geladen | Freigeben erzwingen, kleine Vorschaubilder, Handy-Ansicht mit einem Dokument zur Zeit |
| Safari allgemein: OffscreenCanvas im Worker erst ab 16.4, Unterschiede bei Pointer-Events | Rendern im Hauptthread wie heute; Tests auf echten Geräten |
| Große Dateien (mehrere hundert MB): Export braucht Quelle plus Ergebnis im Speicher | Export Dokument für Dokument; Hinweis vorab bei sehr großer Summe |
| Rückgängig bei großen Operationen (Stufe 2 „Einbacken“ erzeugt neue Quellen) | Verlaufsgrenze; Quellen freigeben, sobald kein Zustand mehr auf sie verweist; Hinweis, wenn Rückgängig wegen der Grenze nicht mehr möglich ist |
| Ziehen kollidiert mit Scrollen (Touch) | Halten vor dem Ziehen; Handy-Ansicht ohne Ziehen zwischen Dokumenten |
| Tastenkürzel kollidieren mit Browser und Screenreader | nur bei Fokus in den Spalten; keine Kürzel ohne Alternative im Menü; Liste zur Freigabe (Frage 5) |
| Umfang: die Werkstatt wird das größte Werkzeug | Stufen mit Anhaltepunkten; Einzelwerkzeuge bleiben unverändert nutzbar |

## 12. Auswirkungen

- **CSP (`public/_headers`):** keine Änderung in Stufe 1 und 2 (`connect-src 'none'`, Worker `'self'`, Bilder `blob:` sind schon erlaubt). Stufe 3 Texterkennung bräuchte `'wasm-unsafe-eval'` (eigene Entscheidung).
- **check-dist:** keine neuen Adressen, solange keine neue Bibliothek kommt; die Listen für pdf-lib und pdf.js gelten automatisch für die Werkstatt-Dateien (E14).
- **chunk-guard:** Die Werkstatt-Seite lädt statisch nur ihre `page.ts`; pdf.js dynamisch, pdf-lib nur im Worker. Startseite und Einzelwerkzeuge laden die Werkstatt dynamisch. Ein zusätzlicher Test stellt sicher, dass kein Einzelwerkzeug die Werkstatt statisch einbindet.
- **Lizenzseite:** `USED_IN` um `pdf-werkstatt` für pdf-lib und pdfjs-dist; der Build prüft es.
- **Datenschutzerklärung:** Stufe 1 und 2 verarbeiten wie alle Werkzeuge nur im Browser; nach meiner Einschätzung keine inhaltliche Änderung. Stufe 3 „Projekt speichern“ legt eine Datei beim Nutzer ab, auch lokal; Hinweis an die Rechtsprüfung, ob das erwähnt werden soll.
- **AGB:** nicht betroffen, solange kostenlos.

## 13. Kostenlos oder Pro (entschieden, W2)

| Stufe | Vorschlag | Begründung |
|---|---|---|
| 1 Kern | **kostenlos** | Die Einzelwerkzeuge (Zusammenfügen, Teilen, Seiten bearbeiten, Bilder zu PDF) sind kostenlos; die Werkstatt verbindet sie nur. AGENTS.md Abschnitt 10: Kostenloses wird nicht nachträglich hinter Pro versteckt. Gutes Aushängeschild für Suchmaschinen. |
| 2 Werkzeuge in der Werkstatt | **kostenlos** für die Anwendung auf ein Dokument; **Pro-Kandidat**: dieselbe Aktion auf mehrere Dokumente in einem Schritt (Stapel) | Die Werkzeuge selbst sind kostenlos; Pro spart Zeit bei wiederkehrender Arbeit (wie auf der Pro-Seite beschrieben). |
| 3 Verkleinern | **kostenlos** (W2) | hoher Nutzen, wichtiger Suchbegriff |
| 3 Texterkennung | **Pro** | in AGENTS.md bereits als Pro vorgesehen |
| 3 Projekt speichern | **Pro-Kandidat** | typische Funktion für regelmäßige Arbeit |

## 14. Offene Fragen (beantwortet, siehe Entscheidungen W1–W14)

1. **Übergabe ohne Neuladen:** Einverstanden, dass Einzelwerkzeuge wie die Startseite per Seitenwechsel ohne Neuladen in die Werkstatt wechseln (Adresse ändert sich, Zurück-Taste lädt neu)? Eine Alternative ohne Browser-Speicher gibt es nicht, außer einem neuen Tab mit `postMessage` (fehleranfälliger, zwei Fenster).
2. **Kostenlos oder Pro** je Stufe (Abschnitt 13).
3. **Name und Adresse:** „PDF-Werkstatt“ unter `/pdf-werkstatt/`?
4. **Hervorhebung:** breite Karte als erstes PDF-Werkzeug auf `/werkzeuge/` und eine hervorgehobene Karte auf der Startseite; soll die Startseiten-Ablage bei PDFs die Werkstatt sofort öffnen statt der Auswahl?
5. **Tastenkürzel:** Liste in 6.2 freigeben? Insbesondere Strg/Cmd+Umschalt+D statt Strg+D und die interne Ablage für Strg+X/C/V (nicht die System-Zwischenablage).
6. **Speichergrenze:** fester Hinweis ab 1 GB Quellen, oder eine harte Obergrenze mit Ablehnung?
7. **Verlauf:** 100 Schritte als Grenze?
8. **„PDF-Seiten bearbeiten“ und „PDFs zusammenfügen“:** bleiben unverändert als eigene Seiten (Vorgabe); sollen sie mittelfristig intern die Werkstatt-Module nutzen (weniger doppelter Code), sichtbar aber gleich bleiben?
9. **Bilder beim Ablegen:** Sollen gemischte Ablagen (PDFs und Bilder) auf der Startseite direkt die Werkstatt anbieten? Heute lehnt die Startseite gemischte Dateiarten ab.
10. **Handy:** Umsortieren nur über „Nach vorne/Nach hinten“ und „Verschieben nach …“, oder zusätzlich Ziehen mit Griff?
11. **Dateinamen beim Export:** Dokumentname + `.pdf`, ZIP `pdf-werkstatt.zip`?
12. **Unverändertes Dokument:** Originaldatei ausgeben (Formulare, Lesezeichen, Signaturen bleiben erhalten), oder immer neu zusammensetzen (einheitlich, aber verlustreich)?
13. **Stufe 2 „Einbacken“:** einverstanden, dass Schwärzen und Formular das betroffene Dokument neu erzeugen und Rückgängig dafür mehr Speicher braucht?
14. **Leerseite:** Größe wie die Nachbarseite als Vorgabe, DIN A4 als Alternative; Querformat anbieten?

## 15. Stand bei Anhaltepunkt B (27.09.2026)

Stufe 1 umgesetzt in den Schritten 1.1 bis 1.8, je ein Commit mit Browser-Prüfung (Konsole, Netzwerk, CSP). Texte zur Freigabe: `docs/texte-pdf-werkstatt.md`.

### Messwerte (`npm run perf:werkstatt`, Chrome headless auf dem Mac des Betreibers, 1440 × 900, doppelte Pixeldichte)

| Messung | Text-PDFs (0,4 MB) | Scans, ein JPEG je Seite (183 MB) | Ziel |
|---|---|---|---|
| Erste Vorschaubilder sichtbar | 116 ms | 731 ms | unter 1 s |
| Alle sichtbaren Vorschaubilder | 1,1 s | 1,8 s | – |
| Lange Aufgaben beim Scrollen durch alle 500 Seiten | keine | keine | keine über 100 ms |
| Gezeichnete Vorschaubilder höchstens | 200 | 200 | höchstens 200 |
| Lange Aufgaben beim Ziehen von 20 Seiten | keine | keine | keine über 100 ms |
| 100 Seiten verschieben bis zur Anzeige | 27 ms | 32 ms | unter 50 ms |
| Export 500 Seiten als neue PDF | 0,3 s | 0,8 s | – |
| JS-Speicher der Seite am Ende | 5 MB | 187 MB | – |

Befehle mit 5.000 Seiten (Unit-Test): alle unter 1 ms.

### Nicht hier prüfbar, Prüfung durch Leon

| # | Prüfung | Warum nicht hier |
|---|---|---|
| B1 | NVDA (Windows): R, D, M, Entf in einer Spalte im Fokusmodus der Liste; Ansagen der Live-Region; Kontextmenü mit Umschalt+F10 | kein Windows, kein NVDA auf diesem Rechner (W5: bei Kollision melden, nicht still ändern) |
| B2 | VoiceOver (macOS, iOS) und TalkBack: dieselben Punkte | nur automatisiert im Headless-Browser geprüft |
| B3 | Echtes Handy (iOS Safari, Android Chrome): Handy-Ansicht, Auswahlmodus, Verschieben nach …, große Vorschau, Speichern | nur mit Geräte-Emulation geprüft |
| B4 | Tablet: Ziehen nach 300 ms Halten, Scrollen ohne Halten | Touch nur emuliert |
| B5 | Firefox, Safari und Edge am Computer: Ziehen, Tastatur, Dialoge (natives dialog), Export | nur Chrome vorhanden (Safari nicht fernsteuerbar ohne neue Werkzeuge) |
| B6 | Speicher auf älteren iPhones mit großen Scans (Canvas-Grenze) | kein Gerät |

### Abweichungen vom Plan

- Datenmodell ohne `ops` und `docOps` (Stufe 2, freigegeben).
- „Verschieben nach …“ steht nicht in der Werkzeugleiste des Desktops (Platz), sondern auf M, im Kontextmenü und in der Handy-Leiste.
- Menü „Werkzeuge“ (Stufe 2) fehlt in Stufe 1, statt ausgegrauter Einträge.
- Bilder werden beim Hinzufügen neu kodiert (wie in „Bilder zu PDF“) und im Worker gehalten; PDFs hält der Worker nur als `File` und liest sie beim Export erneut (weniger Speicher als im Plan, Abschnitt 3).
- `LazyRenderer` gibt Bilder erst über der Grenze von 200 frei, die am längsten nicht gesehenen zuerst, statt schon beim Verlassen des Sichtbereichs (weniger Neuzeichnen, Grenze bleibt).
- Lizenzprüfung (`build/shipped-packages.ts`): Pakete eines nachgeladenen anderen Werkzeugs zählen bei diesem, nicht beim aufrufenden (nötig für den Knopf zur Werkstatt).
- Tests für Browser-Module (`tests/ui/`) mit eigener `tsconfig.dom-tests.json`, damit die DOM-Typen nicht in die Node-Skripte geraten.

## 16. Stand bei Anhaltepunkt C, Schritt 2.1 (27.09.2026, freigegeben von Leon am 27.09.2026)

Vorher erledigt (Freigabe B): Texte der Stufe 1 mit den fünf Änderungen eingebaut und `docs/texte-pdf-werkstatt.md` als freigegeben markiert; „PDF-Seiten bearbeiten“ übergibt Reihenfolge, Drehung und gelöschte Seiten an die Werkstatt (`addSources` mit Seitenfolge je Quelle, Tests); README mit neuer Werkstatt-Aufnahme und erneuerten Bildern. B1 (NVDA: R, D, M) bleibt bei Leon auf der Liste der Gerätetests.

### Umgesetzt in 2.1

- **Dokument-Operation:** `Doc.ops` (optional) mit `{ type: 'page-numbers', options }`; Befehl `setPageNumbers(doc, options | null)` („Seitenzahlen“ / „Seitenzahlen entfernen“, rückgängig machbar). Der Export gibt die Einstellung an `assemble.ts`, das die Zahlen nach dem Zusammensetzen auf die Endreihenfolge setzt (`drawPageNumbers` aus `stamp.ts`, dieselbe Platzierung wie im Werkzeug, auch auf gedrehten Seiten).
- **Einstellungen ohne pdf-lib:** `src/core/pdf/page-numbers.ts` (Typen, Text, Prüfung von „Ab Seite“/„Erste Zahl“); `stamp.ts` gibt sie unverändert weiter.
- **`ToolHost`** (`src/ui/tool-host.ts`): Bereich, Zieldokument (Name, aktuelle Seitenzahl), vorhandenes Ergebnis, `apply(result | null)`, `cancel()`. Das Werkzeug gibt ein Ergebnis zurück statt zu speichern. PDF-Bytes als Eingabe kommen erst mit dem Einbacken (2.3), weil Seitenzahlen sie nicht brauchen.
- **Seitenzahlen einbettbar:** Die Felder stehen in `main.html` in `#num-settings`; `settings.ts` sucht sie beim Einbinden (nicht mehr beim Laden des Moduls) und wird von der Werkzeugseite und von `embed.ts` genutzt. `embed.ts` übernimmt das Markup aus `main.html`, lädt weder Worker noch pdf-lib. Sichtbar ist die Werkzeugseite unverändert.
- **Werkstatt:** Knopf „Werkzeuge“ mit Menü, Eintrag im Spaltenmenü und im Handy-Menü „Mehr“; das Werkzeug erscheint in der rechten Spalte an Stelle der Übersicht; Knopf im Spaltenkopf zeigt „mit Seitenzahlen“ und öffnet das Werkzeug. Texte zur Freigabe: `docs/texte-pdf-werkstatt.md` Abschnitt 10.

### Tests

- Export: Seitenzahlen nach Umsortieren (Deckblatt ohne Zahl, „Seite 1 von 2“ …), mit pdf.js zurückgelesen; auf gedrehten Seiten (eigene /Rotate und zusätzliche Drehung) unten mittig 10 mm über dem sichtbaren Rand; ein unverändertes Dokument mit Seitenzahlen wird neu gesetzt statt als Original ausgegeben.
- Befehl: setzen, ändern, entfernen, gleiche Einstellung ohne neuen Schritt; bleibt beim Umsortieren, Drehen, Duplizieren und Teilen; beim Zusammenführen gilt das erste Dokument.
- Exportplan und Hinweise: Seitenzahlen im Plan, nicht in „Auswahl als neue PDF“; ein Dokument mit Seitenzahlen zählt für die Hinweise zu Formularen, Lesezeichen und Signaturen als neu zusammengesetzt.
- Browser (Chromium, 1280 px hell und dunkel, 390 px): Menü, Bereich, Fehlermeldung, Übernehmen, Umsortieren, Export mit Seitenzahlen in der Endreihenfolge, Esc und Fokus zurück, Entfernen, Rückgängig; Werkzeugseite „Seitenzahlen einfügen“ unverändert (Prüfung, Speichern, „Andere PDF wählen“). Keine Konsolenmeldungen, keine fremden Anfragen.

### Von mir entschieden, von Leon am 27.09.2026 bestätigt

| Nr. | Frage | Umsetzung |
|---|---|---|
| C1 | Teilen und Duplizieren eines Dokuments mit Seitenzahlen | Beide Teile bzw. die Kopie behalten die Einstellung; jeder Teil wird für sich nummeriert. |
| C2 | Zusammenführen | Die Einstellung des ersten Dokuments gilt, die der anderen entfällt. |
| C3 | „Auswahl als neue PDF“ | ohne Seitenzahlen (neues Dokument) |
| C4 | Formulare, Lesezeichen, Signaturen | Ein Dokument mit Seitenzahlen wird immer neu zusammengesetzt, verliert diese also (Hinweis vor dem Export erscheint). Das Einzelwerkzeug behält sie, weil es die Originaldatei bemalt. |
| C5 | „Ab Seite“ hinter der letzten Seite (nach Löschen von Seiten) | Beim Speichern bekommt keine Seite eine Zahl; beim nächsten Öffnen zeigt das Werkzeug die Fehlermeldung. Alternative: Hinweis vor dem Export. |
| C6 | Anzeige | Vorschaubilder und große Vorschau zeigen die Zahlen nicht; sichtbar ist das nur am Knopf im Spaltenkopf. |

### Gefunden, nicht behoben (Entscheidung nötig)

- **pdf.js 6.3 braucht `Map.prototype.getOrInsertComputed`** (auch `getOrInsert`) im Hauptthread und im Worker. Chromium 141 (in dieser Arbeitsumgebung) hat das nicht: Alle Vorschaubilder zeigen dort „Keine Vorschau möglich“, in allen Werkzeugen mit pdf.js. Auf dem Mac des Betreibers (aktuelles Chrome) tritt es nicht auf. Welche Browser-Versionen die Methode haben, habe ich nicht nachgeschlagen; bitte gegen MDN oder caniuse prüfen. Möglichkeiten: (a) kleine eigene Ergänzung (etwa 10 Zeilen, nur wenn die Methode fehlt) vor pdf.js im Hauptthread und im pdf.js-Worker; (b) den „legacy“-Build von pdfjs-dist ausliefern (bringt diese Ergänzungen mit, größer; die Tests nutzen ihn schon in Node). Für die Aufnahmen und Browser-Prüfungen hier habe ich die Ergänzung nur in den lokalen Build-Dateien vorangestellt, nie im Quellcode.

### Abweichungen vom Plan (Einbetten nur der Einstellungen: von Leon am 27.09.2026 bestätigt)

- Nicht die ganze `main.html` wird eingebettet und `page.ts` bekommt kein `mount(host)`: Eingebettet werden nur die Einstellungen (`#num-settings`), die Werkzeugseite behält ihren Aufbau. Das Umstellen der ganzen Seiten gehört zu W8 (nach Stufe 2, eigene Freigabe).
- `Doc.ops` ist optional statt Pflichtfeld (Dokumente ohne Operation bleiben wie in Stufe 1).

Nach der Freigabe: Vorrang hat die pdf.js-Kompatibilität (Abschnitt „Gefunden, nicht behoben“), vor Schritt 2.2. Untersuchung: `docs/pdfjs-kompatibilitaet.md`. Die README-Screenshots werden danach alle in einer einheitlichen Umgebung neu erzeugt.

## 17. Stand bei Anhaltepunkt C, Schritt 2.2 (27.09.2026, freigegeben von Leon am 27.09.2026; D1–D10 bestätigt, Texte separat)

Vorher erledigt (Entscheidungen zur pdf.js-Kompatibilität vom 27.09.2026): Legacy-Build von pdfjs-dist auf allen Seiten mit pdf.js, core-js 3.50.0 auf der Lizenzseite (Build-Prüfung verlangt Eintrag und Version), zwei tote Adressen nur für Bundle-Teile mit pdf.js, Ausnahme `Function('return this')` in `docs/pdfjs-kompatibilitaet.md`; Prüfung beim Laden mit den freigegebenen Texten in allen sechs Werkzeugen mit pdf.js, „Die Datei ist beschädigt …“ erscheint auf zu alten Browsern nicht mehr (Test); `npm run compat:pdfjs` (nicht Teil von `check`, Pflicht bei jedem pdfjs-dist-Update laut AGENTS.md); README „Browser support“; alle README-Screenshots in einer Umgebung neu erzeugt (Chromium 141, Linux). Der Punkt „Gefunden, nicht behoben“ aus Abschnitt 16 ist damit erledigt.

### Umgesetzt in 2.2

- **Seiten-Operationen:** `PageRef.ops` (optional) mit `{ type: 'stamp', stamp }` und `{ type: 'signature', image, rect, turn }`. Befehle `setStamp(keys, look | null)` („Stempel“ / „Stempel entfernen“) und `setSignatures(key, image | null, rects)` („Unterschrift“ / „Unterschrift entfernen“), rückgängig machbar, gleiche Einstellung ohne neuen Schritt. Die Operationen gehören zur Seite und wandern beim Verschieben, Kopieren, Duplizieren, Einfügen, Teilen und Zusammenführen mit.
- **Export (`assemble.ts`):** je Seite zuerst die Unterschriften (vor der zusätzlichen Drehung), dann die Drehung, dann der Stempel (so, wie die Seite am Ende zu sehen ist), zuletzt die Seitenzahlen des Dokuments. Dasselbe Unterschriftsbild wird je Datei nur einmal eingebettet. Zeichnen über `drawStamp` (aus `stamp.ts` herausgelöst) und `drawPlacedImage` (`place-image.ts`, mit Drehung als Parameter), also dieselbe Platzierung wie in den Einzelwerkzeugen.
- **Unterschrift und Drehung:** Das Rechteck wird so gespeichert, wie die Seite beim Setzen angezeigt wird, dazu die Drehung von damals (`turn`). Beim Export steht die Unterschrift aufrecht in dieser Ansicht; wird die Seite danach gedreht, dreht sie mit dem Inhalt (wie ein Aufkleber). Beim erneuten Öffnen zeigt der Dialog sie an der passenden Stelle der jetzt gedrehten Seite (`turnedRect`).
- **Stempel einbettbar:** Einstellungen in `pdf-stempel/main.html` unter `#stamp-settings`, `settings.ts` von Werkzeugseite und `embed.ts` gemeinsam genutzt. Die Zeichenprüfung nutzt den Zeichenvorrat der Standardschrift aus dem Werkstatt-Worker (Anfrage `charset`), damit die Werkstatt-Seite pdf-lib nicht lädt.
- **Unterschrift einbettbar:** Zeichenfläche, Bild, Farbe und Weiß-Entfernung aus `pdf-unterschreiben/page.ts` nach `creator.ts` ausgelagert, von der Werkzeugseite und `embed.ts` genutzt. Platziert wird in einem Dialog der Werkstatt (`sign-dialog.ts`) mit dem `RectEditor` aus dem Einzelwerkzeug; die ganze Seite wird in das Fenster eingepasst (mindestens 360 px breit, auf sehr niedrigen Fenstern scrollt die Fläche); das Seitenbild zeichnet `page-canvas.ts` (aus `preview.ts` herausgelöst). `EmbeddedTool` bekommt ein optionales `dispose()` (Zeichenfläche und Bild-Adressen freigeben).
- **Werkstatt:** Einträge im Menü „Werkzeuge“, im Spaltenmenü (Stempel), im Kontextmenü der Seite (Unterschrift) und im Handy-Menü „Mehr“; Symbole unter dem Vorschaubild; Seitenbeschriftung für Screenreader mit „mit Stempel“ / „mit Unterschrift“. Texte zur Freigabe: `docs/texte-pdf-werkstatt.md` Abschnitt 11.

### Tests

- Befehle: Stempel setzen, ersetzen, entfernen je Seite; Unterschrift mit Rechteck in der Ansicht und Drehung von damals; Operationen wandern mit (verschieben, kopieren, duplizieren, einfügen).
- Exportplan: Stempel und Unterschriften je Seite im Plan; eine Seite mit Operation macht das Dokument „verändert“ (Hinweise zu Formularen, Lesezeichen, Signaturen erscheinen).
- Export mit pdf.js zurückgelesen: Stempel „oben“ steht auch nach zusätzlicher Drehung (eigene /Rotate plus Werkstatt, nur Werkstatt) oben mittig auf der fertigen Seite; Unterschrift auf einer Seite mit eigener /Rotate und zusätzlicher Drehung steht aufrecht und an der Stelle, an der sie gesetzt wurde (Transformationsmatrix aus der Operatorliste); gleiches Bild nur einmal eingebettet. Beide Tests schlagen fehl, wenn man die Reihenfolge bzw. die Drehung im Code vertauscht (geprüft).
- `rangesFromPages` (Vorbelegung des Felds „Seiten“), Texte der Seitenbeschriftung.
- Browser (Chromium 141, 1280 px hell und dunkel, 390 px): Stempel über Menü und Auswahl, Zeichenprüfung, Seiten umsortieren, Stempel wandert mit, Entfernen, Rückgängig; Unterschrift zeichnen, im Dialog auf einer gedrehten Seite platzieren, Übernehmen, Marken, Export (aufrecht, richtige Stelle, ein Bild), erneutes Öffnen und Verschieben; Dialog auf 390 px ohne waagrechtes Scrollen; Einzelwerkzeuge „PDF stempeln“ und „PDF unterschreiben“ unverändert (Prüfung, Platzieren, Speichern, Wechsel auf Bild leert die Platzierungen). Keine Konsolen- oder CSP-Meldungen, keine fremden Anfragen.
- `npm run check`: 1.204 Tests grün (13 übersprungen, lokale Spezifikationsdateien).

### Von mir entschieden, von Leon am 27.09.2026 bestätigt

| Nr. | Frage | Umsetzung |
|---|---|---|
| D1 | Wie viele Stempel je Seite | einer; ein neuer Stempel ersetzt den alten auf den gewählten Seiten |
| D2 | Welche Seiten „Stempel entfernen“ betrifft | alle Seiten des Dokuments |
| D3 | Vorbelegung beim Öffnen | Aussehen von der ersten gestempelten Seite des Dokuments; Feld „Seiten“ aus der Auswahl in diesem Dokument, sonst leer (alle) |
| D4 | Stempel auf gedrehten Seiten | Position und Ausrichtung beziehen sich auf die fertige Seite, wie sie gelesen wird; dreht man die Seite nach dem Stempeln, bleibt „oben“ oben |
| D5 | Unterschrift auf gedrehten Seiten | bleibt am Inhalt der Seite und dreht mit (siehe oben) |
| D6 | Unterschrift auf mehrere Seiten | eine Seite je Durchgang; mehrere Stellen auf dieser Seite möglich, alle mit demselben Bild. Ein neues Bild ersetzt alle Unterschriften der Seite. |
| D7 | Anzeige | Vorschaubilder und große Vorschau zeigen Stempel und Unterschriften so, wie sie gespeichert werden (geändert am 27.09.2026 nach Rückmeldung von Leon: vorher nur Symbole, das wirkte, als fehle der Stempel). Die Symbole unter dem Vorschaubild bleiben. Seitenzahlen zeigt die Vorschau weiterhin nicht (C6). |
| D8 | „Auswahl als neue PDF“ | Stempel und Unterschriften kommen mit, weil sie zur Seite gehören (anders als Seitenzahlen, C3) |
| D9 | Formulare, Lesezeichen, Signaturen | Eine Seite mit Operation macht das Dokument neu zusammengesetzt, verliert diese also (Hinweis vor dem Export, wie C4) |
| D10 | Reihenfolge beim Zeichnen | Unterschrift, dann Stempel, dann Seitenzahlen; überlappen sie, liegt der Stempel oben |

### Abweichungen vom Plan

- Das Unterschriftsbild (PNG) liegt direkt in der Operation statt als eigene Quelle in `state.sources`. Kopien und der Verlauf teilen sich dieselben Bytes (keine Kopie); freigegeben werden sie, sobald kein Zustand mehr darauf verweist. Eine eigene Quelle lohnt sich erst, wenn Bilder über Seiten hinweg verwaltet werden sollen.
- Unterschrift: eine Seite je Durchgang statt einer Mehrfachauswahl (D6). Für viele Seiten müsste der Dialog blättern können; das wäre eine eigene Freigabe.
- Wie in 2.1 werden nur die Einstellungen eingebettet, nicht die ganzen Werkzeugseiten (W8).
- Die Symbole unter dem Vorschaubild haben keinen sichtbaren Text und keinen Hinweis beim Darüberfahren; Screenreader bekommen die Information über die Seitenbeschriftung.

### Nachtrag nach der Freigabe (27.09.2026)

- **Unterschriftsbild nur einmal im Speicher:** Test `tests/core/workshop/signature-memory.test.ts`. 200 Befehle (Duplizieren, Kopieren, interne Ablage, Dokument duplizieren, Teilen, Zusammenführen, Auswahl kopieren, Drehen, Verschieben), dann 40 × Rückgängig und 15 × Wiederholen. Über 1.000 Seiten mit Unterschrift in 101 Zuständen und in der Ablage verweisen auf dasselbe Bildobjekt; von Verlauf und Ablage aus ist genau ein Byte-Puffer erreichbar. Gegenprobe: Kopiert man die Bytes beim Kopieren einer Seite, schlägt der Test fehl. Eine gemeinsame Quelle ist daher nicht nötig. Außerhalb des Zustands entstehen nur kurzlebige oder kleine Kopien: die Anzeige im Dialog (blob:-Adresse, beim Schließen freigegeben), das dekodierte Bild für die Vorschau (einmal je Bild, WeakMap) und die Kopie an den Worker beim Speichern (einmal je Bild, auch bei vielen Seiten).
- **Vorschau zeigt Stempel und Unterschriften** (D7 geändert): `core/workshop/overlay.ts` berechnet sie in Ansichtskoordinaten mit derselben Rechnung wie der Export (`stampInView` in `core/pdf/stamp-layout.ts`, von `drawStamp` genutzt; `edgeInView`/`centeredInView` aus `stamp-geometry.ts`); `overlay-canvas.ts` zeichnet sie über Vorschaubild, große Vorschau und die Seite im Unterschrift-Dialog (dort ohne die Unterschriften, die als verschiebbare Rahmen erscheinen). Schrift der Vorschau: Helvetica oder Arial (Systemschrift gleicher Maße), keine nachgeladene Schrift.

### Offen, Prüfung durch Leon

- Texte in `docs/texte-pdf-werkstatt.md` Abschnitt 11 und der vorgeschlagene Satz für den Erklärtext.
- Entscheidungen D1–D10.
- Gerätetests: Safari und Firefox (Browser support im README), NVDA für R, D, M (B1); neu dazu: Zeichnen der Unterschrift mit Finger und Stift auf dem Handy in der Werkstatt.

Nach der Freigabe: Schritt 2.3 (Schwärzen und Formular als „Einbacken“).

## 18. Stand bei Anhaltepunkt C, Schritt 2.3 (27.09.2026, zur Freigabe)

Vorher erledigt (Freigabe 2.2): D1–D10 bestätigt; Test, dass das Unterschriftsbild nur einmal im Speicher liegt (Abschnitt 17, Nachtrag); nach Leons Rückmeldung zeigt die Vorschau Stempel und Unterschriften (D7 geändert).

### Umgesetzt in 2.3

- **Befehl „Einbacken“** (`bakePages` in `core/workshop/commands.ts`): ersetzt Seiten eines Dokuments durch Seiten einer neu erzeugten Quelle. Schlüssel, Stempel und Unterschriften bleiben (eine Unterschrift an derselben Stelle der Ansicht, `turn` wird angepasst). Hat sich eine Seite seit dem Start geändert (andere Quelle, Seite oder Drehung), geschieht nichts; beim Schwärzen auch dann, wenn das Dokument inzwischen andere Seiten hat. Rückgängig stellt die alten Verweise her; die alte Quelle bleibt, solange der Verlauf sie braucht (W7).
- **Herkunft von Quellen** (`Source.origin`): `redacted` bzw. `filled`, jeweils mit den Ausgangsquellen.
- **Schwärzen:** Bereiche im Dialog `redact-dialog.ts` (RectEditor und Texte aus „PDF schwärzen“, Seite für Seite). `redact-bake.ts` zeichnet jede Seite des Dokuments so, wie sie angezeigt wird (ohne Stempel und Unterschriften), füllt die Bereiche schwarz, macht JPEGs; der Werkstatt-Worker baut daraus mit `buildRasterPdf` die neue PDF, ohne die Originaldatei zu lesen (wie im Einzelwerkzeug). Einstellungen und Prüfhinweis kommen aus `pdf-schwaerzen/main.html` (`#red-settings`, `#red-check`), der Bereich aus `pdf-schwaerzen/embed.ts`.
- **Nicht geschwärzte Seiten** (`unredactedPages` in `model.ts`): Seiten, die auf eine Quelle verweisen, von der im Arbeitsbereich eine geschwärzte Fassung existiert, z. B. vorher kopierte oder später aus der Ablage eingefügte. Hinweis oben in der rechten Spalte mit „Zu den Seiten“, Ansage direkt nach dem Schwärzen, Nachfrage vor dem Speichern (Dokument, Auswahl, ZIP).
- **Formular ausfüllen:** Felder, Zeichenprüfung und Pflichtfeld-Zähler aus `pdf-formular-ausfuellen/fields.ts`, Meldungen aus `messages.ts` (beide aus `page.ts` herausgelöst, die Werkzeugseite nutzt sie ebenso). Lesen und Ausfüllen im Werkstatt-Worker (`read-form`, `fill-form`); die ausgefüllte Datei wird eine neue Quelle, die Seiten dieses Dokuments aus der alten Quelle zeigen danach auf sie. Ist das Dokument danach unverändert diese Datei, wird sie samt Formularfeldern ausgegeben.
- **Vorschaubilder** zeigen geschwärzte Seiten geschwärzt, weil sie auf die neue Quelle verweisen; das Original wird für sie nicht mehr gezeichnet.
- **Meldung nach dem Speichern:** „Gespeichert ist die Originaldatei“ nur noch für geladene Dateien, nicht für geschwärzte oder ausgefüllte Quellen.

### Tests

- `tests/core/workshop/bake.test.ts`:
  - Befehl: Seiten ersetzt, Schlüssel und Stempel bleiben, Unterschrift auf gedrehter Seite an derselben Stelle; nichts geschieht nach Drehen oder neuer Seite, wohl aber nach neuem Stempel.
  - Hinweis: Kopien in „Anlagen“ gefunden, eingeschränkt auf Dokumente und Seiten; verschwindet, wenn das geschwärzte Dokument geschlossen ist.
  - **Nichts vom Original im Export** (Leon, 27.09.2026), mit den Prüfhilfen des Einzelwerkzeugs (`tests/core/pdf/secrets.ts`, aus `redact.test.ts` ausgelagert: Text mit pdf.js, alle Objekte, entpackte Ströme, Latin-1, UTF-16 beide Richtungen, jeweils auch hexadezimal; dazu Titel und Autor): direkt, nach Rückgängig und Wiederholen, Dokument duplizieren, Teilen (beide Teile), Zusammenführen, „Auswahl als neue PDF“, alle als ZIP; auch das unverändert ausgegebene geschwärzte Dokument. Gegenprobe: vor dem Schwärzen und nach Rückgängig steckt der Name drin. Einziger Text im Ergebnis ist ein Stempel, den der Test selbst setzt.
  - Formular: ausgefülltes Dokument wird unverändert mit Feldwert ausgegeben; Wahl der Formularquelle.
- `tests/ui/pdfjs-support.test.ts`: „lädt pdf.js“ heißt jetzt „ruft `loadPdfjs(` auf“ (die Werkstatt importiert für das Schwärzen nur die Fehlerklasse und den Text „zu alt“).
- Browser (Chromium 141, 1280 px hell und dunkel, 390 px):
  - Schwärzen mit Bereichen auf zwei Seiten, Vorschaubilder geschwärzt, Hinweis und Sprung, Speichern ohne und mit Nachfrage (Fokus auf „Abbrechen“), Rückgängig und Wiederholen; gespeicherte Datei ohne Text, Name und Titel (pdf.js und Bytes geprüft).
  - Gedrehte Seite und Stempel vor dem Schwärzen: gespeichert quer, Stempel noch da und einziger Text.
  - Formular: Felder, Zeichenprüfung mit „Ł“, Übernehmen, gespeicherte Datei mit Werten und Feldern; Menüeintrag aus bei PDF ohne Formular.
  - Einzelwerkzeuge „PDF schwärzen“ und „PDF-Formular ausfüllen“ unverändert (Zähler, Speichern, Zeichenprüfung, Pflichtfelder, Vorschau).
  - Keine Konsolen- oder CSP-Meldungen, keine fremden Anfragen.
- `npm run check`: 1.219 Tests grün (13 übersprungen, lokale Spezifikationsdateien).

### Von mir entschieden, zur Bestätigung

| Nr. | Frage | Umsetzung |
|---|---|---|
| E1 | Was wird gerastert | Das ganze Dokument, auch Seiten ohne Bereich, Leer- und Bildseiten (wie im Einzelwerkzeug). Nur so enthält sein Export garantiert nichts aus dem Original. Plan 7.2 sprach von „betroffenen Seiten“. |
| E2 | Stempel und Unterschriften beim Schwärzen | bleiben Seiten-Operationen, werden nicht mitgerastert und lassen sich danach noch ändern oder entfernen; beim Speichern kommen sie über das Bild |
| E3 | Bereiche vor dem Schwärzen | gelten nur, solange das Werkzeug offen ist (nicht im Verlauf). Wird eine Seite mit Bereichen vorher gedreht oder ersetzt, wird nicht geschwärzt, mit Meldung. |
| E4 | Wann der Hinweis auf nicht geschwärzte Seiten gilt | solange die geschwärzte Fassung im Arbeitsbereich ist; er verschwindet, wenn diese Seiten ebenfalls geschwärzt, gelöscht oder das geschwärzte Dokument geschlossen wird. Er gilt auch für Seiten, die später aus der internen Ablage eingefügt werden. Er lässt sich nicht wegklicken. |
| E5 | Nachfrage vor dem Speichern | Dialog mit „Trotzdem speichern“, Fokus auf „Abbrechen“; bei Dokument, Auswahl und ZIP |
| E6 | Rückgängig nach dem Schwärzen | stellt das ungeschwärzte Dokument wieder her (Verlauf wie immer); der Export zeigt dann wieder das Original, ohne besondere Warnung |
| E7 | Formular: welche Quelle | die Formular-PDF der Seite mit dem Fokus, sonst die erste im Dokument; ersetzt werden nur die Seiten dieses Dokuments, andere Dokumente behalten die alte Quelle |
| E8 | Namen der neuen Quellen | „Vertrag (geschwärzt).pdf“, „Antrag (ausgefüllt).pdf“ (Seitenbeschriftung, Hinweise); der gespeicherte Dateiname kommt weiter vom Dokumentnamen |
| E9 | Farbe des Hinweises | Fehlerfarbe (`--err-soft`/`--err-ink`, vorhandene Tokens wie bei `.badge.err`), neuer Baustein `.ws-warn` |

### Abweichungen vom Plan

- Gerastert wird im Hauptthread mit pdf.js (wie im Einzelwerkzeug), gebaut im Worker. Rastern im Worker (OffscreenCanvas) wäre eine eigene Änderung an der pdf.js-Anbindung.
- Bereiche werden in einem Dialog festgelegt, nicht in der rechten Spalte; das Formular in der Werkstatt hat keine Vorschau der Seite, weil die rechte Spalte selbst der Bereich des Werkzeugs ist.
- Wie in 2.1 und 2.2 werden nur Teile der Werkzeugseiten eingebettet (W8).
- Nebenbei, weil 2.3 sie braucht: `fields.ts`/`messages.ts` aus der Formular-Seite und die Prüfhilfen aus `redact.test.ts` herausgelöst; `dialogPageWidth` in `page-canvas.ts` für beide Seiten-Dialoge; Knopfzeile der Seiten-Dialoge klebt unten (Handy).

### Offen, Prüfung durch Leon

- Texte in `docs/texte-pdf-werkstatt.md` Abschnitt 11 (2.2) und 12 (2.3), dazu die zwei Vorschläge für den Erklärtext.
- Entscheidungen E1–E9.
- Gerätetests: Safari und Firefox, NVDA für R, D, M; Unterschrift mit Finger und Stift; neu: Bereiche schwärzen mit Finger auf dem Handy, Ansage des Hinweises mit NVDA.
- Datenschutzerklärung und AGB: nach meiner Einschätzung nicht betroffen (alles bleibt im Browser, keine neue Speicherung).

Nach der Freigabe: Schritt 2.4 (Metadaten als Export-Einstellung, Hinweise).

