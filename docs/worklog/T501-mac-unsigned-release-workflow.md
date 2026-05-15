# T501 - Mac unsigned-release workflow

Status: DONE
Phase: M.18
Ticket: docs/tickets/T501-mac-unsigned-release-workflow.md

## 1. Task summary

Patch the unsigned Mac release workflow review blockers after the stale PR
queue landed. Scope is limited to the T501 workflow, ticket, and worklog.

## 2. Repo context discovered

The merged workflow validated the dispatch tag only after checkout, ran live
private boundary validation before packaging created a bundle, uploaded ZIP,
blockmap, and latest metadata even though the checksum manifest only covered
the DMG, and did not make the unsigned/private runtime environment explicit.

## 3. Files inspected

- `.github/workflows/mac-unsigned-release.yml`
- `docs/tickets/T501-mac-unsigned-release-workflow.md`
- `package.json`
- `scripts/validate-mac-private-release-boundary.ts`
- `scripts/validate-mac-boundary-fixtures.ts`
- Existing nearby worklogs for required documentation shape.

## 4. RED checks captured before editing

```bash
test -f docs/worklog/T501-mac-unsigned-release-workflow.md
rg -n "Checkout|Validate release tag pattern|Validate private mac release trust boundary|Upload unsigned DMG artifact|ROX-ONE-arm64.zip|latest-mac.yml" .github/workflows/mac-unsigned-release.yml
rg -n "CSC_IDENTITY_AUTO_DISCOVERY|ROX_DEV_RUNTIME" .github/workflows/mac-unsigned-release.yml
```

## 5. Expected failing output

```text
worklog_exists=1
.github/workflows/mac-unsigned-release.yml:50:      - name: Checkout
.github/workflows/mac-unsigned-release.yml:58:      - name: Validate release tag pattern
.github/workflows/mac-unsigned-release.yml:99:      - name: Validate private mac release trust boundary
.github/workflows/mac-unsigned-release.yml:153:            apps/electron/release/ROX-ONE-arm64.zip
.github/workflows/mac-unsigned-release.yml:155:            apps/electron/release/latest-mac.yml
```

No `CSC_IDENTITY_AUTO_DISCOVERY` or `ROX_DEV_RUNTIME` entries were present in
the unsigned workflow before the patch.

## 6. Implementation changes

- Moved tag validation before checkout and wired checkout to the validated
  `refs/tags/<release_tag>` value.
- Kept `validate:mac-boundary-fixtures` before the build and moved the live
  `validate:mac-private-release-boundary` gate after electron-builder creates
  the package.
- Set `CSC_IDENTITY_AUTO_DISCOVERY=false` and `ROX_DEV_RUNTIME=1` on the
  build and packaging steps so the private ad-hoc hardened-runtime path is
  explicit.
- Narrowed the primary upload to `ROX-ONE-arm64.dmg` plus the checksum
  manifest, matching the manifest coverage.
- Refreshed the ticket summary and kept this worklog in the required
  11-section format.

## 7. Validation commands run

- `bun run validate:agent-contract`
- `bun run validate:docs`
- `git diff --check`
- `/tmp/actionlint-1.7.12/actionlint .github/workflows/mac-unsigned-release.yml`

## 8. Passing output summary

```text
bun run validate:agent-contract
[agent-contract] ok: 11 skills, 466 tickets, 7 required docs

bun run validate:docs
[agent-contract] ok: 11 skills, 466 tickets, 7 required docs
[architecture-docs] ok: 4 docs, 10 subsystem headings
[sync-v2-design] validated /tmp/rox-pr235-fix/docs/architecture/sync-v2-design.md

git diff --check
# no output

/tmp/actionlint-1.7.12/actionlint .github/workflows/mac-unsigned-release.yml
# no output
```

## 9. Build output summary

No local macOS release build ran in this Linux worktree. The workflow is
covered by static checks, actionlint, and repository documentation validators;
the GitHub-hosted macOS runner remains the runtime proof point.

## 10. Remaining risks

The workflow still depends on the requested release tag existing in the remote
repository when manually dispatched. That is intentional: checkout should fail
rather than silently building a different ref.

## 11. Acceptance criteria matrix

| Criterion | Status | Evidence |
| --- | --- | --- |
| Dispatch builds the validated tag | PASS | Tag validation now precedes checkout and checkout uses `refs/tags/${{ github.event.inputs.release_tag }}`. |
| Boundary validation runs in the right order | PASS | Fixture validation runs before build; private boundary validation runs after packaging. |
| Unsigned/private env is explicit | PASS | Build steps set `CSC_IDENTITY_AUTO_DISCOVERY=false` and `ROX_DEV_RUNTIME=1`. |
| Uploaded artifacts match checksum coverage | PASS | Upload path is narrowed to the DMG plus checksum manifest. |
| Ticket/worklog discipline is complete | PASS | Ticket is refreshed and this worklog has all 11 required sections. |
