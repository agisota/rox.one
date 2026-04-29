#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PATTERN="ipcRenderer\\.send\\(|\\bsender\\.send\\(|webContents\\.send\\("

matches=0
violations=()
while IFS= read -r line; do
  [[ -z "$line" ]] && continue
  ((matches += 1))
  case "$line" in
    apps/electron/src/preload/bootstrap.ts:*"ipcRenderer.send('__transport:status',"*)
      ;;
    apps/electron/src/main/index.ts:*"_event.sender.send('transfer:progress',"*)
      ;;
    apps/electron/src/main/window-manager.ts:*"window.webContents.send(channel, ...args)"*)
      ;;
    apps/electron/src/main/browser-pane-manager.ts:*"instance.toolbarView.webContents.send(TOOLBAR_CHANNELS.FORCE_CLOSE_MENU, { reason })"*)
      ;;
    apps/electron/src/main/browser-pane-manager.ts:*"instance.toolbarView.webContents.send(TOOLBAR_CHANNELS.STATE_UPDATE, state)"*)
      ;;
    apps/electron/src/main/browser-pane-manager.ts:*"instance.toolbarView.webContents.send(TOOLBAR_CHANNELS.THEME_COLOR, color)"*)
      ;;
    *)
      violations+=("$line")
      ;;
  esac
done < <(
  rg -n "$PATTERN" apps/electron/src packages \
    -g '!**/__tests__/**' \
    -g '!**/*.test.*' \
    -g '!**/*.isolated.*' \
    -g '!**/node_modules/**' \
    || true
)

if [[ $matches -eq 0 ]]; then
  echo "check-raw-sends: no raw IPC send sites found"
  exit 0
fi

if [[ ${#violations[@]} -gt 0 ]]; then
  echo "check-raw-sends: unexpected raw IPC send usage detected"
  printf '  %s\n' "${violations[@]}"
  exit 1
fi

echo "check-raw-sends: ${matches} known raw send site(s) allowlisted"
