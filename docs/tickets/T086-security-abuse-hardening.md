# T086 - Security and Abuse Hardening

Status: DONE

## Goal

Harden the integrated Experience runtime against final mission pass spoofing
before RC.

## Scope

- Reuse existing T071 security hardening where it already covers tenant/RBAC,
  share redaction, billing redaction, mission budget, provider payload, and
  package trust abuse cases.
- Add a focused Experience runtime regression for forged mission finalization.
- Ensure finalization requires:
  - a real stored final artifact for the mission;
  - a real passing validation gate result;
  - no blocking failed gate for the same mission.
- Keep tests deterministic and fake-provider-safe.

## Acceptance Criteria

- [x] Forged final artifact/gate refs cannot complete a mission.
- [x] Failed blocking gate prevents final pass.
- [x] Existing Experience security tests continue to pass.
- [x] Worklog complete.
- [x] Scoped Lore commit created.
