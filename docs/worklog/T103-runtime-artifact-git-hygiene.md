# T103 - Runtime Artifact Git Hygiene Worklog

## 1. Task summary

Stop recurring local runtime artifacts from polluting production-ticket diffs.
This slice makes the already-documented boundary enforceable by adding a
regression test, ignoring local runtime paths, and removing `events.jsonl` from
the git index without deleting the operator's local file.

Inherited dirty-tree note before T103:

```text
 M events.jsonl
?? .claude/
?? .ouroboros/
```

These are the artifacts this ticket treats as local runtime state.

## 2. Red evidence

Focused regression added first:

```bash
bun test scripts/__tests__/runtime-artifact-git-hygiene.test.ts
```

Expected red result:

```text
0 pass
1 fail
Expected to contain: "events.jsonl"
```

The failure confirmed the repo did not yet enforce the documented
runtime-artifact ignore boundary.

## 3. Test added first

Added `scripts/__tests__/runtime-artifact-git-hygiene.test.ts`.

The test asserts:

- `.gitignore` contains runtime-artifact rules for `events.jsonl`,
  `.claude/`, and `.ouroboros/`;
- `git ls-files --error-unmatch` does not find those runtime artifacts in the
  repository index.

## 4. Implementation changes

- Added `.gitignore` entries for `events.jsonl`, `.claude/`, and `.ouroboros/`.
- Removed `events.jsonl` from the git index with `git rm --cached -- events.jsonl`.
- Preserved the local `events.jsonl` file on disk for the operator.

## 5. Validation commands

| Command | Result | Evidence |
|---|---|---|
| `bun test scripts/__tests__/runtime-artifact-git-hygiene.test.ts` | RED, expected | 0 pass, 1 fail on missing `events.jsonl` ignore rule |
| `bun test scripts/__tests__/runtime-artifact-git-hygiene.test.ts` | PASS | 1 pass, 0 fail, 6 expects |
| `git ls-files --error-unmatch events.jsonl` | PASS | exit 1 after index removal |
| `git check-ignore -v events.jsonl .claude .ouroboros` | PASS | `.gitignore` rules match all three runtime artifacts |
| `test -f events.jsonl` | PASS | local operator file preserved after `git rm --cached` |
| `bun run validate:docs` | PASS | `11 skills`, `104 tickets`, `7 required docs` |
| `git diff --check` | PASS | no whitespace errors |

## 6. Remaining risks

- This ticket changes repository hygiene only; it does not change where the
  runtime writes automation events.
- Existing local `events.jsonl`, `.claude/`, and `.ouroboros/` remain on disk
  and are now ignored by git.

## 7. Acceptance criteria matrix

| Criteria | Status | Evidence |
|---|---|---|
| Runtime artifact hygiene test fails before the fix and passes after | Done | Focused test red, then pass |
| `.gitignore` ignores `events.jsonl`, `.claude/`, and `.ouroboros/` | Done | `git check-ignore -v events.jsonl .claude .ouroboros` |
| `events.jsonl` is removed from the git index without deleting the local file | Done | `git ls-files --error-unmatch events.jsonl` exit 1; `test -f events.jsonl` pass |
| Docs validation passes | Done | `bun run validate:docs` |
| Worklog complete | Done | This file |
| Scoped Lore commit exists without unrelated runtime artifacts | Done | This scoped T103 commit |
