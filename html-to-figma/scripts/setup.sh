#!/usr/bin/env bash
# Prepare a Python environment with Playwright for html-to-figma.
# Usage: setup.sh            prints the python to run the scripts with
# Uses Google Chrome when it's installed; otherwise downloads Playwright's Chromium.
set -eu
VENV="${HTML_TO_FIGMA_VENV:-$HOME/.cache/html-to-figma/venv}"
mkdir -p "$(dirname "$VENV")"
if command -v uv >/dev/null 2>&1; then
  [ -x "$VENV/bin/python" ] || uv venv -q "$VENV"
  uv pip install -q --python "$VENV/bin/python" playwright pyyaml numpy pillow
else
  [ -x "$VENV/bin/python" ] || python3 -m venv "$VENV"
  "$VENV/bin/pip" install -q playwright pyyaml numpy pillow
fi
if ! "$VENV/bin/python" - <<'EOF' 2>/dev/null
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    p.chromium.launch(channel="chrome").close()
EOF
then
  echo "Google Chrome not found; downloading Playwright's Chromium." >&2
  "$VENV/bin/python" -m playwright install chromium || {
    echo "No browser could be installed. Use /screenshot-to-figma with a screenshot instead." >&2; exit 2; }
fi
echo "$VENV/bin/python"
