# Pending Release Notes

This file accumulates release notes for the next unreleased version. PRs that add user-visible behavior should append a bullet to the relevant section here. Versioned files (`X.Y.Z.md`) are owned by the release skill — never create them in feature commits.

## Features

- **Auto-update channels and live release notes** — ROX.ONE now supports stable/beta update channels, background update downloads by default, an in-app top-bar update button, update settings for manual checks/downloads, and a remote `app.rox.one` release-notes feed with bundled notes as the offline fallback. macOS builds remain unsigned until Apple Developer ID signing is configured.
- **Experience session sync and MCP defaults** — ROX.ONE now imports sanitized external Rox Agent session index entries into workspace sessions on startup and seeds new/migrated workspaces with Exa, ByteRover, Firecrawl, GitHub, Playwright, and Z.AI MCP source presets. The importer keeps raw transcripts, local source paths, and secret-like prompt fragments out of generated session stubs.

## Improvements

- **ROX.ONE surface copy polish** — Remaining active Electron/WebUI surface text now uses the dotted ROX.ONE wordmark in app titles, onboarding labels, menu accessibility copy, bundled automation docs, and messaging playground previews.
- **Compact Russian What's New summaries** — The in-app release-notes surface now prefers companion Russian bullet summaries for recent releases while preserving the long-form English release files as source material. The unreleased `next.md` scratch file is excluded from the released What's New list.
- **Zed-inspired bundled themes** — Appearance settings now include four additional bundled presets inspired by prominent Zed marketplace theme families: Kanagawa Wave, macOS Classic, Snazzy, and VSCode Dark Modern. The matching syntax-highlighting themes are preloaded so code blocks stay visually aligned with the selected preset.
- **Starter skill marketplace foundation** — New Agent Workbench workspaces now seed 20 starter skill templates, and the shared skills module exposes a marketplace catalog with installed, available, and account-limited states for future one-click installation UI.

## Bug Fixes

- **Packaged app startup repaired** — fixed a renderer chunking regression that could leave the installed macOS app stuck on the first loading screen; release builds now fail fast if the broken React/i18n chunk shape comes back, and packaged launch smoke runs across macOS, Linux, and Windows surfaces.

## Breaking Changes
