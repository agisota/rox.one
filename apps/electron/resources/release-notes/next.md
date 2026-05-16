# Pending Release Notes

This file accumulates release notes for the next unreleased version. PRs that add user-visible behavior should append a bullet to the relevant section here. Versioned files (`X.Y.Z.md`) are owned by the release skill — never create them in feature commits.

## Features

- **Experience session sync and MCP defaults** — ROX.ONE now imports sanitized external Rox Agent session index entries into workspace sessions on startup and seeds new/migrated workspaces with Exa, ByteRover, Firecrawl, GitHub, Playwright, and Z.AI MCP source presets. The importer keeps raw transcripts, local source paths, and secret-like prompt fragments out of generated session stubs.

## Improvements

- **ROX.ONE surface copy polish** — Remaining active Electron/WebUI surface text now uses the dotted ROX.ONE wordmark in app titles, onboarding labels, menu accessibility copy, bundled automation docs, and messaging playground previews.
- **Compact Russian What's New summaries** — The in-app release-notes surface now prefers companion Russian bullet summaries for recent releases while preserving the long-form English release files as source material. The unreleased `next.md` scratch file is excluded from the released What's New list.

## Bug Fixes

## Breaking Changes
