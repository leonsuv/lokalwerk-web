# PDF-Werkstatt: Entscheidungen beim Umbau zum Editor

Leon hat für den Umbau (27.09.2026) freie Hand gegeben: Wo sonst eine Rückfrage käme, wird hier
entschieden und mit einem Satz begründet. Fortschritt: `docs/umbau-fortschritt.md`.

| Nr. | Entscheidung | Begründung |
|---|---|---|
| U1 | Keine neue Abhängigkeit; Menüs, Ziehen, Animationen und Tooltips sind selbst gebaut. | Alles davon lässt sich mit Pointer Events, CSS-Übergängen und dem vorhandenen Menü-Muster in wenigen hundert Zeilen lösen. |
| U2 | Trennlinien gehören zum Dokument und zum Verlauf (Rückgängig nimmt sie zurück); die Linie hängt an der Seite danach. | So bleibt sie an der richtigen Stelle, wenn davor Seiten eingefügt oder gelöscht werden, und verschwindet von selbst, wenn ihre Seite das Dokument verlässt oder an den Anfang rückt. |
| U3 | „An Trennlinien teilen“ lässt den ersten Teil als ursprüngliches Dokument stehen; die weiteren Teile heißen „Name (Teil 2)“, „Name (Teil 3)“ … und stehen direkt dahinter. | Wie das bisherige Teilen an einer Stelle; Seitenzahlen gelten wie dort für jeden Teil. |
| U4 | Zusammenführen in eigener Reihenfolge (Dialog, Ziehen einer Dokumentkarte) ist ein neuer Befehl `joinDocs`; das bisherige `mergeDocs` (Reihenfolge der Liste) bleibt. | Bestehende Abläufe und Tests bleiben unverändert; Ziel ist immer das erste Dokument der gewählten Reihenfolge, es behält Namen und Platz. |
| U5 | Das Verlauf-Bedienfeld springt mit `jumpTo` in einem Zug zu einem Schritt; danach geht Wiederholen wie gewohnt. | Kein neuer Speicherbedarf, der Verlauf enthält die Zustände schon. |
