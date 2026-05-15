# T502 — Windows unsigned-release workflow (worklog)

## What was done
Created `.github/workflows/windows-unsigned-release.yml` — new workflow building unsigned beta Windows x64 NSIS installer (ROX-ONE-Setup-*.exe) without code-signing. Mirrors mac-signed-release.yml structure (tag input via env var, oven-sh/setup-bun@v2 v1.3.11, astral-sh/setup-uv@v5, bun install --frozen-lockfile, bun run build:win, bunx electron-builder --win --x64 --publish=never, PowerShell Get-FileHash SHA-256 checksums, actions/upload-artifact@v4). Header comment documents unsigned-beta status and v1.0.x migration path to signed.

## Why
v1.0.0-rc.2 ships Windows artifact for distribution. No Windows release workflow existed in repo. Code-signing certificate deferred to v1.0.x ($200-500/yr from DigiCert/Sectigo).

## Verification
- actionlint exit 0
- gh workflow run dispatch returns expected 404 (feature-branch limitation, resolves on merge)
