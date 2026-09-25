# Passwort-Generator: BSI-Empfehlungen

Quelle: Bundesamt für Sicherheit in der Informationstechnik (BSI), „Sichere Passwörter erstellen“, Verbraucherseite:
https://www.bsi.bund.de/DE/Themen/Verbraucherinnen-und-Verbraucher/Informationen-und-Empfehlungen/Cyber-Sicherheitsempfehlungen/Accountschutz/Sichere-Passwoerter-erstellen/sichere-passwoerter-erstellen_node.html

Abgerufen am 25.09.2026. Die Seite nennt kein Veröffentlichungs- oder Änderungsdatum. Wortlaut aus dem HTML der Seite geprüft (nicht aus einer Zusammenfassung):

> „Ein kurzes und komplexes Passwort sollte mindestens acht Zeichen lang sein und aus vier verschiedenen Zeichenarten (Groß- und Kleinbuchstaben, Zahlen und Sonderzeichen) bestehen. Ein langes und weniger komplexes Passwort sollte mindestens 25 Zeichen lang sein. Bei Verschlüsselungsverfahren für WLAN wie zum Beispiel WPA 2 oder WPA 3 sollte das Passwort mindestens 20 Zeichen lang sein.“

> „Ein Passwort ist sicher, wenn es beispielsweise
> - 20 bis 25 Zeichen lang ist und zwei Zeichenarten genutzt werden (beispielsweise eine Folge von Wörtern). Es ist dann lang und weniger komplex.
> - 8 bis 12 Zeichen lang ist und vier Zeichenarten genutzt werden. Es ist dann kürzer und komplex.
> - 8 Zeichen lang ist, drei Zeichenarten genutzt werden und es zusätzlich durch eine Mehr-Faktor-Authentisierung abgesichert ist (beispielsweise durch einen Fingerabdruck, eine Bestätigung per App oder eine PIN).“

> „Auf besonders in unserer Sprache verwendete Zeichen und Umlaute wie z.B. "ä,ö,ü, ß, €, ¢," sollten Sie verzichten, da diese bei (nicht deutschsprachigen) Diensten und Tastaturen manchmal nicht verwendbar bzw. nicht verfügbar sind oder anders kodiert werden.“

> „Nutzen Sie einen Passwortmanager, um Ihre unterschiedlichen Passwörter gut verwalten zu können – und Ihr starkes Passwort, um diesen abzusichern.“

## Umsetzung (`src/core/random/password.ts`)

| Empfehlung | Umsetzung |
|---|---|
| Vier Zeichenarten | Wählbar; jede gewählte Art kommt mindestens einmal vor (Verwerfen, damit alle zulässigen Passwörter gleich wahrscheinlich bleiben) |
| Keine Umlaute, kein ß, €, ¢ | Nur ASCII-Zeichen; Sonderzeichen ohne Leerzeichen, Anführungszeichen, Backslash und Backtick |
| Beispiele Länge/Zeichenarten | `rateAgainstBsi`: mindestens 25 Zeichen; oder mindestens 20 Zeichen mit zwei Zeichenarten; oder mindestens 8 Zeichen mit vier Zeichenarten. Das Beispiel mit Mehr-Faktor-Authentisierung hängt vom Dienst ab und wird nicht vergeben |
| WLAN mindestens 20 Zeichen | Hinweis in der Oberfläche |

Nicht übernommen: Das BSI-IT-Grundschutz-Kompendium (Baustein ORP.4) richtet sich an Organisationen und nennt keine Längenwerte für einen Generator; die Verbraucherseite oben ist die passende Quelle.

Zufall: `crypto.getRandomValues` (Web Crypto API), gleichverteilte Auswahl durch Verwerfen statt Modulo (`randomBelow`). Gespeichert wird nichts (AGENTS.md Regel 5).
