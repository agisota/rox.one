# T535 - Release feed aggregate manifest

Status: DONE

## Context

The marketing download section and Cloudflare release feed were still anchored
to the v0.9.2 macOS-only release shape. The unified release workflow now needs a
machine-readable manifest that can represent macOS, Linux, and Windows assets.

## Goal

Publish a `manifest.json` asset from the unified release workflow, serve it
through the release-feed worker, and let the marketing page render download
cards from that live manifest with a safe fallback.

## Acceptance Criteria

- [x] Unified release workflow builds an aggregate `manifest.json` after all
  platform jobs succeed.
- [x] Release-feed worker resolves the latest release dynamically and proxies
  manifest, install scripts, and platform artifacts.
- [x] Marketing download cards hydrate from the live manifest and keep a
  fallback when the feed is unavailable.
- [x] Worker tests cover manifest, Windows, Linux, install-script, 404, pinned
  version, and missing-token behavior.
- [x] Validation completed.

## Validation

- `bun test infra/__tests__/rox-one-release-feed-worker.test.ts`
- `bun run marketing:build`
- `bun run validate:ci-contract`
- `bun run validate:private-release-pipeline`
- `ruby -e 'require "yaml"; YAML.load_file(ARGV[0]); puts "yaml ok"' .github/workflows/release-all-platforms.yml`
- `git diff --check`
