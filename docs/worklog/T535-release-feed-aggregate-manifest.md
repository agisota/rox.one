# T535 - Release feed aggregate manifest

## Summary

Moved the release download path from a pinned macOS-only shape toward a
multi-platform manifest contract:

- `.github/workflows/release-all-platforms.yml` now has a post-matrix
  `publish-manifest` job.
- `infra/cloudflare/rox-one-release-feed.worker.ts` now resolves the latest
  release tag dynamically and proxies release assets by name.
- `apps/marketing/src/App.tsx` fetches `manifest.json` and renders download
  cards from live binary metadata, while preserving the v0.9.2 macOS fallback.

## Implementation Notes

- The manifest job waits for all platform matrix legs through `needs:
  build-and-release` and only runs on success.
- Manifest construction uses `find`, deterministic sorting, `sha256sum`,
  `stat`, and `jq` to avoid hand-built JSON.
- The worker keeps short in-isolate caches for latest tag and release metadata.
- Worker tests reset caches between cases so `/latest` tests remain isolated.
- Marketing download links use the URL supplied by the manifest when present,
  falling back to `https://app.rox.one/electron/latest/{filename}`.

## Validation Evidence

- Worker contract: 7 pass, 0 fail, 15 expectations.
- Marketing production build: passed; JS bundle `172.66 kB`, gzip `54.53 kB`.
- CI contract validator: passed.
- Private release pipeline validator: passed.
- Workflow YAML parse: passed.
- `git diff --check`: passed.

## Remaining Risks

- The workflow manifest job is still verified statically; the real
  cross-platform artifact download path is proven only by a tagged release run.
- The live marketing page depends on the release-feed worker having a configured
  `GITHUB_RELEASE_TOKEN`.
