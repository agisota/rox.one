#!/usr/bin/env bun
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const scriptPath = path.join(root, 'scripts/install-app.sh');
const source = readFileSync(scriptPath, 'utf8');

function fail(message: string): never {
  console.error(`[linux-installer-launcher] ${message}`);
  process.exit(1);
}

function requireText(text: string, needle: string, description: string): void {
  if (!text.includes(needle)) {
    fail(`missing ${description}: ${needle}`);
  }
}

function wrapperBody(): string {
  const start = source.indexOf("cat > \"$WRAPPER_PATH\" << 'WRAPPER_EOF'");
  if (start < 0) fail('missing Linux launcher heredoc start');
  const bodyStart = source.indexOf('\n', start);
  const end = source.indexOf('\nWRAPPER_EOF', bodyStart);
  if (end < 0) fail('missing Linux launcher heredoc terminator');
  return source.slice(bodyStart + 1, end);
}

const wrapper = wrapperBody();

for (const [needle, description] of [
  ['APPIMAGE_PATH="$HOME/.rox/app/ROX-ONE-x64.AppImage"', 'stable AppImage install path'],
  ['grep -rq \'/tmp/\\.mount_ROX\'', 'stale AppImage mount cache cleanup'],
  ['export APPIMAGE="$APPIMAGE_PATH"', 'electron-updater APPIMAGE env'],
  // Audit #377: launcher uses persistent --appimage-extract + SUID chrome-sandbox
  // instead of --no-sandbox. Fallback to --no-sandbox only on extract failure.
  ['--appimage-extract', 'persistent-extract for chrome-sandbox SUID restore'],
  ['exec "$EXTRACT_DIR/AppRun" "$@"', 'AppRun launch with sandbox enabled'],
  ['exec "$APPIMAGE_PATH" --no-sandbox "$@"', 'fallback --no-sandbox path when extract fails'],
  ['is_nixos()', 'NixOS detection helper'],
  ['appimage-run "$APPIMAGE_PATH" "$@"', 'NixOS appimage-run launch (sandbox handled by appimage-run)'],
  ['nix profile install nixpkgs#appimage-run', 'NixOS remediation hint'],
] as const) {
  requireText(wrapper, needle, description);
}

for (const [needle, description] of [
  ['sudo apt install fuse libfuse2', 'Debian/Ubuntu FUSE hint'],
  ['sudo dnf install fuse fuse-libs', 'Fedora FUSE hint'],
  ['nix profile install nixpkgs#appimage-run', 'NixOS appimage-run hint'],
] as const) {
  requireText(source, needle, description);
}

console.log('[linux-installer-launcher] ok: Debian/Ubuntu, Fedora, and NixOS launcher hints are wired');
