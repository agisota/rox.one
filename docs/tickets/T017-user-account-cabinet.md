# T017-user-account-cabinet

Status: DONE

Use the detailed task prompt from the master Agent Workbench implementation plan.

Worker B follow-up scope (2026-05-05):

- Close the visible auth/cabinet truth gap in Account settings.
- After `/api/account/me` confirms an authenticated user, stale secondary cabinet errors such as `Authentication required` / `Unauthorized` must not remain visible as account auth failure.
- After an accepted login where session refresh is still pending, replace stale auth-required text with a precise pending-refresh message.
- Keep the cabinet centered on the signed-in user; do not foreground white-label product/legal/support/docs rows on the account page.
- Worker B did not commit directly; supervisor integrates this slice in the scoped validation commit.

Required loop:

1. Inspect repo context.
2. Write tests or validation checks first.
3. Confirm expected failure.
4. Implement minimal change.
5. Run targeted checks.
6. Run full relevant validation.
7. Update matching worklog.
8. Commit.
