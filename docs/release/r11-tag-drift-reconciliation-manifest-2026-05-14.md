# R.11 Tag Drift Reconciliation Manifest - 2026-05-14

Status: OPERATOR TAG RECONCILIATION MANIFEST

This report turns the live `rebrand-v1` tag drift blockers into operator-owned
decision options. No tag deletion, tag retargeting, local tag sync, origin tag
push, backup creation, `git filter-repo`, force-push, or goal completion is
authorized by this manifest.

No tag deletion, tag retargeting, local tag sync, origin tag push, backup creation, `git filter-repo`, force-push, or goal completion is authorized by this manifest.

Source evidence:

```bash
git rev-parse --verify rebrand-v1^{commit}
git for-each-ref refs/tags/rebrand-v1 --format='%(refname) %(objecttype) %(objectname) %(*objecttype) %(*objectname)'
git ls-remote --tags origin 'refs/tags/rebrand-v1' 'refs/tags/rebrand-v1^{}'
git merge-base --is-ancestor b817d1c311b30487e95dfd83fc6fdfe9ddc8bd99 origin/main
git branch -r --contains b817d1c311b30487e95dfd83fc6fdfe9ddc8bd99
```

Related inventory:

- `docs/release/r11-tag-drift-inventory-2026-05-14.md`

## Current Targets

- Local tag object: `8e30f545169e52daa2763659d6c562a699a2575b`
- Local peeled commit: `906896e145156d92cf98457c4dc1893c53323bac`
- Origin tag object: `e32deed37b33fe3296edde6228adb1f76255027d`
- Origin peeled commit: `b817d1c311b30487e95dfd83fc6fdfe9ddc8bd99`
- Local and origin peeled commits match: no
- Origin peeled commit on `origin/main` ancestry: no
- Remote branch currently containing origin peeled commit: `origin/chore/rebrand-R10-final-sweep-and-gate`
- `git merge-base --is-ancestor` exit for origin peeled commit: exit 1

## Decision Options

| Option | Effect | Risk |
| --- | --- | --- |
| Retarget origin `rebrand-v1` to a commit on `origin/main` | Clears `rebrand-tag-on-main` after local sync also matches | Mutates a published tag; requires explicit operator approval |
| Sync local `rebrand-v1` to origin target only | Clears local drift but leaves `rebrand-tag-on-main` red | Does not unblock R.11 by itself |
| Preserve current origin tag and change gate expectations | Keeps existing published tag intact | Requires policy decision because current tag target is not on `origin/main` ancestry |
| Defer tag mutation until the R.11 destructive window | Avoids premature ref mutation | Keeps default pre-backup gate red |

## Dry-run verification commands

Dry-run verification commands to run before any tag mutation:

```bash
git rev-parse --verify rebrand-v1^{commit}
git for-each-ref refs/tags/rebrand-v1 --format='%(refname) %(objecttype) %(objectname) %(*objecttype) %(*objectname)'
git ls-remote --tags origin 'refs/tags/rebrand-v1' 'refs/tags/rebrand-v1^{}'
git merge-base --is-ancestor <candidate-rebrand-v1-commit> origin/main
git branch -r --contains <candidate-rebrand-v1-commit>
```

Potential tag mutation command shapes, recorded only so an operator can review
the destructive surface:

```bash
git tag -f rebrand-v1 <candidate-rebrand-v1-commit>
git push origin refs/tags/rebrand-v1
```

Do not run tag mutation commands until an operator-owned destructive window is explicit.
Before that point, re-fetch tag refs, verify the candidate target is on
`origin/main`, and record the accepted policy decision in the R.11 closeout.

## R.11 Gate Impact

This manifest does not make `rebrand-tag-local-sync` or `rebrand-tag-on-main`
pass. Both gates remain red until an operator chooses and executes a tag
reconciliation path.
