# R.11 Legal Preserve Inventory - 2026-05-14

Status: BLOCKED ON BACKUP TAG

This report is read-only evidence for the R.11 `legal-preserve` blocker. It
does not authorize backup creation, tag mutation, history rewrite, or
legal-preserve allowlist changes.

Source command:

```bash
bun run rebrand:r11-legal-preserve
```

Summary:

- Result: red
- Failing legal-file rows: 3
- Passing attribution rows: 1
- Required backup ref: `pre-rebrand-history-rewrite-backup`
- Backup ref state: missing

## Gate Rows

| ID | Status | Evidence |
| --- | --- | --- |
| `legal-file-LICENSE` | fail | Could not read `pre-rebrand-history-rewrite-backup:LICENSE` because the backup ref is missing. |
| `legal-file-NOTICE` | fail | Could not read `pre-rebrand-history-rewrite-backup:NOTICE` because the backup ref is missing. |
| `legal-file-TRADEMARK.md` | fail | Could not read `pre-rebrand-history-rewrite-backup:TRADEMARK.md` because the backup ref is missing. |
| `dockerfile-source-attribution` | pass | Dockerfile.server source attribution is intact. |

## Operator Note

Re-run this gate only after all R.11 pre-backup prerequisites are green and the
required backup ref has been created by an operator-controlled destructive
window. Do not create the backup ref from this report-only agent run.
