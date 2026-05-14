# R.11 Tag Drift Inventory - 2026-05-14

Status: BLOCKED ON TAG DRIFT

This report is read-only evidence for the R.11 `rebrand-v1` tag blockers. It
does not authorize tag deletion, local tag sync, origin tag repointing, or
force-pushing.

Source commands:

```bash
git rev-parse --verify rebrand-v1^{commit}
git for-each-ref refs/tags/rebrand-v1 --format='%(refname) %(objecttype) %(objectname) %(*objecttype) %(*objectname)'
git ls-remote --tags origin 'refs/tags/rebrand-v1' 'refs/tags/rebrand-v1^{}'
git merge-base --is-ancestor b817d1c311b30487e95dfd83fc6fdfe9ddc8bd99 origin/main
git branch -r --contains b817d1c311b30487e95dfd83fc6fdfe9ddc8bd99
```

Summary:

- Local tag object: `8e30f545169e52daa2763659d6c562a699a2575b`
- Local peeled commit: `906896e145156d92cf98457c4dc1893c53323bac`
- Origin tag object: `e32deed37b33fe3296edde6228adb1f76255027d`
- Origin peeled commit: `b817d1c311b30487e95dfd83fc6fdfe9ddc8bd99`
- Local and origin peeled commits match: no
- Origin peeled commit on `origin/main` ancestry: no
- `merge-base --is-ancestor` exit for origin peeled commit: exit 1
- Remote branch currently containing origin peeled commit:
  `origin/chore/rebrand-R10-final-sweep-and-gate`

## Gate Rows

| ID | Status | Evidence |
| --- | --- | --- |
| `rebrand-tag` | pass | `rebrand-v1` is visible on origin. |
| `rebrand-tag-local-sync` | fail | Local peeled commit `906896e145156d92cf98457c4dc1893c53323bac` differs from origin peeled commit `b817d1c311b30487e95dfd83fc6fdfe9ddc8bd99`. |
| `rebrand-tag-on-main` | fail | `git merge-base --is-ancestor b817d1c311b30487e95dfd83fc6fdfe9ddc8bd99 origin/main` exits 1. |

## Operator Note

The origin tag currently points at a commit reachable from
`origin/chore/rebrand-R10-final-sweep-and-gate`, not from `origin/main`.
Resolving this requires an operator decision about the intended tag target and
history relationship. Do not mutate tags from this report-only agent run.
