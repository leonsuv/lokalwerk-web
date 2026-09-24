#!/bin/sh
# Prüft eine pain.001-Datei gegen das DK-Schema (TVS GBIC_5) mit xmllint.
# Aufruf: scripts/validate-xsd.sh datei.xml
# Das Schema liegt lokal in .local-specs/dk/ (docs/lokale-spezifikationen.md).
set -eu
XSD="$(dirname "$0")/../.local-specs/dk/pain.001.001.09_GBIC_5.xsd"
if [ "$#" -ne 1 ]; then
  echo "Aufruf: $0 datei.xml" >&2
  exit 2
fi
if [ ! -f "$XSD" ]; then
  echo "DK-Schema fehlt: $XSD" >&2
  echo "Anleitung: docs/lokale-spezifikationen.md" >&2
  exit 2
fi
if ! command -v xmllint >/dev/null 2>&1; then
  echo "xmllint ist nicht installiert." >&2
  exit 2
fi
xmllint --noout --schema "$XSD" "$1"
