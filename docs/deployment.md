# Deployment auf Cloudflare Pages

Stand: 25.09.2026. Checkliste für Leon (plan.md Abschnitt 9 und „Datenschutz und Hosting“). Menüpunkte im Cloudflare-Dashboard ändern sich gelegentlich; die Namen unten sind die zum Zeitpunkt des Schreibens üblichen und vor dem Einrichten zu prüfen.

## Vor jedem Deployment lokal

```sh
npm ci
npm run check        # ESLint, Prettier, alle Tests, Typprüfung, Build, Build-Prüfung
```

`npm run check` sollte ohne den Hinweis „XSD-PRÜFUNG … WIRD ÜBERSPRUNGEN“ laufen. Dafür müssen die DK-Dateien in `.local-specs/` liegen (docs/lokale-spezifikationen.md). Der Cloudflare-Build hat diese Dateien nicht und führt die Tests nicht aus.

## Projekt in Cloudflare Pages

| Einstellung | Wert |
|---|---|
| Framework-Voreinstellung | keine |
| Build-Befehl | `npm run build` (Typprüfung, Vite-Build, Lizenz- und Adressprüfung; bricht bei Verstößen ab) |
| Ausgabeordner | `dist` |
| Node-Version | 24 (steht in `.nvmrc`; sonst Umgebungsvariable `NODE_VERSION=24` setzen) |
| Root-Verzeichnis | Projektordner |

Hinweise:
- SheetJS kommt aus `vendor/xlsx-0.20.3.tgz` im Repo. Der Build lädt nichts von cdn.sheetjs.com.
- `public/_headers` setzt die Sicherheits-Header inklusive Content-Security-Policy mit `connect-src 'none'`. Cloudflare Pages wertet die Datei automatisch aus.
- `dist/404.html` verwendet Cloudflare Pages automatisch für unbekannte Adressen.
- Der Ordner `out/` ist Leons Editor-Erweiterung und wird nicht gebaut oder ausgeliefert.

## Dashboard-Einstellungen, die aus bleiben müssen

Diese Funktionen fügen eigene Skripte in die ausgelieferten Seiten ein oder senden Daten an Dritte. Die CSP würde fremde Skripte blockieren, Skripte unter `/cdn-cgi/` auf der eigenen Domain aber nicht.

| Funktion | Warum aus | Wo (ungefähr) |
|---|---|---|
| Web Analytics / Browser Insights | Tracking-Skript (AGENTS.md Regel 3) | Pages-Projekt → Metriken bzw. Analytics & Logs → Web Analytics |
| E-Mail-Adressen-Verschleierung (Email Address Obfuscation) | Fügt `email-decode.min.js` ein, sobald eine E-Mail-Adresse im HTML steht (Impressum, Datenschutz) | Zone → Scrape Shield |
| Rocket Loader | Schreibt Skript-Tags um und lädt eigenen Code | Zone → Speed → Optimierung |
| Zaraz | Tag-Manager für Drittanbieter-Skripte | Zone → Zaraz |
| Bot Fight Mode / JavaScript-Erkennung | Kann Challenge-Skripte in Seiten einfügen | Zone → Security → Bots |
| Automatische HTML-Minifizierung, falls noch angeboten | Verändert ausgelieferte Dateien nach dem Build | Zone → Speed |

## Nach dem Deployment prüfen

1. Header prüfen:
   ```sh
   curl -sI https://lokalwerk.eu/ | grep -i -E 'content-security-policy|referrer-policy|x-content-type-options|permissions-policy'
   ```
   Erwartet: dieselben Werte wie in `public/_headers`.
2. Jede Seite im Browser mit geöffnetem Netzwerk-Tab laden: nur Anfragen an lokalwerk.eu, keine an `/cdn-cgi/` und keine an fremde Domains. Im Seitenquelltext darf kein `<script>` stehen, das nicht aus `/assets/` kommt.
3. Offline-Test (plan.md A5, Variante a): Werkzeugseite laden, Netz trennen (Netzwerk-Tab „Offline“), Datei verarbeiten. Das muss in allen drei Werkzeugen funktionieren. Die Ablage auf der Startseite braucht beim ersten Ablegen einmal Netz, weil sie das Werkzeug erst dann lädt (akzeptiert in A5).
4. `/lizenzen/` aufrufen: alle Bibliotheken und Onest aufgeführt.
5. Eine erzeugte SEPA-Datei im Onlinebanking hochladen und prüfen, aber nicht freigeben (plan.md Abschnitt 9).

## Vor dem Livegang (Leon, plan.md Abschnitt 9)

- Platzhalter in Impressum und Datenschutz ausfüllen, Hoster-Abschnitt der Datenschutzerklärung mit Cloudflare.
- Rechtstexte prüfen lassen, dabei die Randnotizen aus plan.md Abschnitt 9 (APAFML) vorlegen.
- Erklärtexte und Meta-Beschreibungen freigeben (`docs/texte-zur-freigabe.md`).
- Domain lokalwerk.eu mit dem Pages-Projekt verbinden, HTTPS erzwingen.
