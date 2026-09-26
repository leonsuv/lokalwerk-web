# uqr: Adressen im gebauten Bundle (zur Freigabe)

Stand: 26.09.2026, uqr 0.1.3 (MIT, Project Nayuki und Anthony Fu). Die Bibliothek ist freigegeben (plan-phase2.md E5); die Adresse im Bundle war in plan-phase2.md Abschnitt 5.2 angekündigt. **Vorgelegt, Freigabe ausstehend** (plan.md N3). Bis dahin steht der Eintrag vorläufig in `scripts/allowed-urls-uqr.mjs`, damit der Build durchläuft.

`scripts/check-dist.mjs` findet in den Dateien mit uqr (laut `build/shipped-packages.ts`: `assets/qr-output-*.js`, geladen von „QR-Code erstellen“ und „QR-Code für Überweisungen“) genau eine Adresse:

| # | Adresse | Fundstelle | Zweck |
|---|---|---|---|
| U1 | `http://www.w3.org/2000/svg` | `node_modules/uqr/dist/index.mjs`, Zeile 723, `renderSVG` | Pflicht-Namensraum im Kopf der erzeugten SVG-Datei (SVG-Export). Ein Name, keine Datei; wird nie abgerufen. |

uqr enthält keinen Netzwerkcode (kein `fetch`, kein `XMLHttpRequest`). Wird U1 abgelehnt, entfällt der SVG-Export beider QR-Werkzeuge; PNG bleibt.

Außerdem neu auf `/lizenzen/`: die Urheberzeile „Copyright (c) 2023 Anthony Fu <https://github.com/antfu>“ aus der Lizenzdatei von uqr. Sie ist durch die bestehende Regel für die Lizenzseite gedeckt (Adressen, die wörtlich in den Lizenztexten stehen, plan.md N3 Variante A). Dafür musste check-dist lernen, dass eine Adresse im HTML vor `&gt;` endet.
