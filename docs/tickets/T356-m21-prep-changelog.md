# T355 — M.21 prep: CHANGELOG v1.0.0 entry + GitHub Release template

Status: DONE
Lane: M.21 (v1.0.0 release prep)
T-number choice: T355 — selected as the next free integer after T354
(the highest existing ticket at branch-cut). Task brief recommended
"T304+"; the project has since grown to T354, so T355 is the natural
free slot and avoids accidentally shadowing the dense T304 – T354 band
already in use.

## Context

M.21 (per spine) is the v1.0.0 release task: tag → GitHub Release →
CHANGELOG.md update. The 72-hour soak (M.20) precedes the tag. To let
the release operator review the body content asynchronously, the
CHANGELOG entry and the GitHub Release body template are authored in
this prep ticket **before** the tag goes out.

## Goal

Land two reviewable artifacts on `main` so M.21 can ship without
authoring release prose during the tag window:

1. CHANGELOG.md — extend the `## [1.0.0]` heading to
   `TBD (after 72h soak)`, add a Lane M (M.1 – M.21) completion block,
   and itemize the Security entries by T-number.
2. `docs/release/v1-github-release-template.md` — the operator-facing
   release body with placeholder spans for date, SHA, and checksums.

## Scope (DOCS-ONLY)

| File | Change |
| --- | --- |
| `CHANGELOG.md` | Append-only edit. 42 lines added, 2 removed. |
| `docs/release/v1-github-release-template.md` | New file, 138 lines. |
| `docs/tickets/T356-m21-prep-changelog.md` | This ticket. |
| `docs/worklog/T356-m21-prep-changelog.md` | Worklog. |

No code paths, no validators, no roadmap-log mutations.

## Constraints honored

- DOCS-ONLY. No source code touched.
- CHANGELOG addition is ≤80 LOC (net +40).
- Release template is ≤200 LOC (138 LOC).
- `.swarm/master-roadmap-log.md` untouched (M.21 closes it).
- CHANGELOG heading uses `TBD (after 72h soak)` per task brief —
  M.21 fills in the actual date at tag time.
- Keep-a-Changelog format preserved.

## Validation

All three commanded gates passed locally on the prep SHA:

```text
$ bun run validate:rebrand
rebrand validation passed: no forbidden tokens outside the allowlist

$ bun run validate:agent-contract
[agent-contract] ok: 11 skills, 309 tickets, 7 required docs

$ bun run validate:roadmap
validate:roadmap OK — 46 phases, 110 tickets across detail files
```

## Acceptance criteria

- [x] CHANGELOG.md heading reads `## [1.0.0] — TBD (after 72h soak)`.
- [x] CHANGELOG.md includes a Lane M completion block under Added.
- [x] CHANGELOG.md Security entries name T243 (property tests),
      T244 (`'*'` reservation), T303 (Zod), T052 (integrity pass),
      T071/T071b/T071c (rate-limiter + budget-guard), and
      T250/T252/T253 (multi-platform trust boundaries).
- [x] `docs/release/v1-github-release-template.md` exists, contains
      headline + version + date placeholders, "What's new" highlights,
      download links, migration notes, known-limitations cross-ref,
      acknowledgements, and sha256 checksum placeholders.
- [x] `bun run validate:rebrand` exits 0.
- [x] `bun run validate:agent-contract` exits 0.
- [x] `bun run validate:roadmap` exits 0.
- [x] PR opened against `main` from
      `feat/M21-prep-changelog-release-template`.

## Hand-off to M.21 execution

When the 72-hour soak closes green:

1. Replace `TBD (after 72h soak)` in CHANGELOG.md with the release
   date (ISO `YYYY-MM-DD`).
2. Render the template body, fill in `<…>` placeholders (date, soak
   close date, sha256 values per artifact).
3. Tag `v1.0.0` at the soak-passing SHA.
4. Publish the GitHub Release with the rendered body, attach
   `SHA256SUMS.txt` and the four platform artifacts, mark "Latest".
