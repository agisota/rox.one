# T014 Marketing Terminal Download

## Task summary

Add ROX ONE Terminal download entry points to the public `rox.one` marketing page after publishing the macOS artifacts to the private GitHub repository.

## Repo context discovered

- `apps/marketing` is the source for the `rox.one` homepage served by the Cloudflare Pages project `rox-one`.
- `infra/cloudflare/rox-one-router.worker.ts` routes non-product paths to `https://rox-one.pages.dev`.
- Cloudflare Pages cannot host the DMG/ZIP assets directly because each artifact is over 25 MiB.
- The `v0.8.12` GitHub release in `agisota/rox-one-terminal` contains both arm64 and x64 DMG assets.

## Files inspected

- `apps/marketing/src/App.tsx`
- `apps/marketing/src/index.css`
- `apps/marketing/package.json`
- `infra/cloudflare/rox-one-router.worker.ts`
- `infra/cloudflare/wrangler.rox-one.example.toml`

## Tests added first

No new test harness exists for the marketing page. The validation check for this task is static typecheck, production build, Cloudflare Pages deploy, and HTTP smoke verification against `https://rox.one/`.

## Expected failing test output

Before the change, the homepage did not contain `ROX-ONE-arm64.dmg`, `ROX-ONE-x64.dmg`, or a terminal download section.

## Implementation changes

- Added a `Скачать` navigation entry.
- Added a hero action for terminal download.
- Added a dedicated terminal download section with Apple Silicon and Intel Mac DMG links.
- Included release version, file names, sizes, and SHA-256 checksums from the GitHub release.

## Validation commands run

- `bun run typecheck`
- `bun run build`
- `wrangler pages deploy apps/marketing/dist --project-name rox-one --branch main`
- `wrangler pages deploy apps/marketing/dist --project-name rox-one --branch production`
- Node HTTP smoke checks for `https://rox.one/`, `https://rox-one.pages.dev/`, and deployment aliases.
- `gh release view v0.8.12 --repo agisota/rox-one-terminal --json url,assets`

## Passing test output summary

- TypeScript check completed with exit code 0.
- Production build completed with exit code 0.
- `https://rox.one/assets/index-DH6OYs1C.js` contains `ROX ONE Terminal для macOS`, `ROX-ONE-arm64.dmg`, and `ROX-ONE-x64.dmg`.
- Cloudflare Pages production deployment `4bfd5dc6-8a78-4555-b34a-c7df249947b3` is active for branch `production`.

## Build output summary

- Vite built `apps/marketing/dist`.
- Main built assets: `index.html`, `assets/index-mk0m06wB.css`, `assets/index-DH6OYs1C.js`, `assets/pzdrk-BmVy9Sz6.png`.

## Remaining risks

- Download URLs point to a private GitHub release. Public anonymous visitors will need repository access before GitHub allows the asset download.
- Public unauthenticated large-file hosting needs Cloudflare R2 or another public object store; R2 is not enabled on the current Cloudflare account.

## Acceptance criteria matrix

| Criteria | Status |
| --- | --- |
| Private GitHub release remains the artifact source | Pass |
| Homepage exposes terminal download actions | Pass |
| Marketing build passes | Pass |
| `rox.one` serves the updated page | Pass |
