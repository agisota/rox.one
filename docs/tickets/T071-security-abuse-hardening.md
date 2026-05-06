# T071 - Security and Abuse Hardening

Status: DONE

## Goal

Close the remaining deny-by-default abuse paths before final release candidate.

## Scope

- Harden mission budget accounting against spoofed scheduler events.
- Harden branch expansion input validation before any expensive swarm expansion.
- Harden public share payload redaction for secret-like values embedded in
  ordinary content strings.
- Harden account billing payloads so ledger metadata cannot expose provider
  secrets, cookies, or bearer tokens through the cabinet API.
- Preserve deterministic fake-provider tests.
- Do not call real external providers.
- Do not modify account/share/session behavior unless a security regression is
  directly proven by tests.

## Required Tests

- Mission scheduler event cost spoofing cannot increase remaining budget.
- Negative, non-finite, or zero branch expansion inputs fail closed.
- Public share sanitizer redacts bearer tokens, env-style API keys, cookies,
  passwords, and session values embedded in content fields.
- Account cabinet billing sanitizer redacts ledger metadata keys and
  secret-looking string values while preserving harmless references.
- Budget/capacity/human approval gates continue to block expansion.
- Existing tenant/RBAC/package/entitlement/security tests continue to pass.

## Acceptance Criteria

- [x] Negative scheduler event costs are rejected or ignored safely.
- [x] Branch expansion rejects invalid agent counts and estimated costs.
- [x] Public share payload redacts secret-like values.
- [x] Account billing payload redacts ledger metadata secrets.
- [x] Mission budget bypass tests pass.
- [x] Existing security guard tests pass.
- [x] Worklog is complete.
- [x] Scoped commit exists.

## Worklog

- `docs/worklog/T071-security-abuse-hardening.md`
