#!/usr/bin/env bash
# Verhindert das Beenden, solange docs/STATUS.md offene Punkte hat. Notbremse: Datei docs/STOP anlegen.
cd "$(dirname "$0")/.." || exit 0
[ -f docs/STOP ] && exit 0
open=$(grep -c '^- \[ \]' docs/STATUS.md 2>/dev/null || echo 0)
if [ "${open:-0}" -gt 0 ]; then
  next=$(grep -m1 '^- \[ \]' docs/STATUS.md | cut -c1-160)
  jq -n --arg r "Es sind noch $open Punkte in docs/STATUS.md offen. Nächster: $next. Nicht anhalten, nicht fragen: weiterarbeiten nach docs/entscheidungen.md." '{decision:"block",reason:$r}'
fi
exit 0
