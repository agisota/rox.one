# T531 - Russian compact What's New summaries

Status: DONE

## Context

The active onboarding/workspace goal asks for the in-app changelog / What's New
surface to be shortened, translated to Russian, and presented as bullet points.
Bundled historical release notes are long-form English source material owned by
the release flow, so this slice should add a compact display layer without
destroying the source release history.

## Goal

Make the What's New panel prefer compact Russian bullet summaries for the most
recent bundled releases while keeping the original English release-note files
available as source material.

## Required UI

- Existing What's New overlay should render concise Russian markdown when a
  Russian summary exists for a release.
- Displayed summaries should be bullet-first and short enough to scan.
- The unreleased `next.md` scratch file must not appear as a released version.

## Required Data/API

- Support companion `{version}.ru.md` files in bundled release-note assets.
- Treat `{version}.ru.md` as the display content for `{version}.md`, not as a
  separate release.
- Keep existing `getReleaseNotesList()`, `getLatestReleaseVersion()`, and
  `getCombinedReleaseNotes()` public behavior stable for consumers.

## TDD Requirements

Before implementation:

1. Add shared release-note loader tests proving Russian summaries override
   source release notes.
2. Prove `next.md` and `.ru.md` companion files are not counted as releases.
3. Run the targeted test and capture the expected failure.

## Validation Commands

- `bun test packages/shared/src/release-notes/__tests__/release-notes-summary.test.ts`
- `bun run typecheck`
- `bun run lint`
- `bun run build`
- `git diff --check`

## Acceptance Criteria

- [ ] Russian companion summaries are selected for display when present.
- [ ] English source release notes remain bundled and untouched.
- [ ] `next.md` is excluded from released What's New output.
- [ ] The latest release version remains the newest semver release.
- [ ] Tests pass.
- [ ] Build passes when applicable.
- [ ] Worklog complete.
- [ ] Commit created.

## Worklog

Update `docs/worklog/T531-russian-compact-whats-new.md`.
