# R.11 History Scan Inventory - 2026-05-14

Status: REWRITE REQUIRED

This report is read-only evidence for the R.11 `history-scan` blocker. It does
not authorize rewriting history, mutating refs, force-pushing, or changing the
legal-preserve allowlist.

Source command:

```bash
bun run rebrand:r11-history-scan
```

Summary:

- Result: red
- Matches observed in unbounded scan: 81
- Representative sanitized findings: 8
- Output truncated after listed findings: yes
- Raw token and line text: omitted
- Sanitization reason: new docs must not introduce additional historical
  patch-line matches before the actual R.11 rewrite.

## Sanitized Finding Inventory

| # | Commit | Path | Sanitized token class | Sanitized line evidence |
| --- | --- | --- | --- | --- |
| 1 | `64afb56746e9ad6b1a7b21d684f903c7f407fb4d` | `docs/release/m3-merge-runbook.md` | legacy env prefix | upstream-owned translation rule |
| 2 | `64afb56746e9ad6b1a7b21d684f903c7f407fb4d` | `docs/release/m3-merge-runbook.md` | legacy package name | audit pattern-card rule |
| 3 | `64afb56746e9ad6b1a7b21d684f903c7f407fb4d` | `docs/release/m3-merge-runbook.md` | legacy env prefix | compatibility shim mapping bullet |
| 4 | `64afb56746e9ad6b1a7b21d684f903c7f407fb4d` | `docs/release/m3-merge-runbook.md` | legacy package scope | package-scope search bullet |
| 5 | `64afb56746e9ad6b1a7b21d684f903c7f407fb4d` | `docs/release/m3-merge-runbook.md` | legacy product text | brand-text replacement bullet |
| 6 | `64afb56746e9ad6b1a7b21d684f903c7f407fb4d` | `docs/release/m3-upstream-merge-audit.md` | legacy repository URL | merge-source sentence |
| 7 | `64afb56746e9ad6b1a7b21d684f903c7f407fb4d` | `docs/release/m3-upstream-merge-audit.md` | legacy repository URL | upstream repository table row |
| 8 | `64afb56746e9ad6b1a7b21d684f903c7f407fb4d` | `docs/release/m3-upstream-merge-audit.md` | legal-preserve URL | attribution URL table row |

## Operator Note

These findings are historical patch lines. They are expected to remain red
until the destructive R.11 rewrite is intentionally run from a fully unblocked
operator-controlled window. Do not mark this blocker green from a report-only
agent run.
