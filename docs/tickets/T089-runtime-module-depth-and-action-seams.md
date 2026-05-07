# T089 - Runtime Module Depth and Action Seams

Status: DONE

## Goal

Deepen the ROX Experience runtime Modules without changing the public product
behavior:

- A: split `ExperienceRuntimeStore` internals so metric and quest projection are
  dedicated runtime Modules instead of hidden inline logic.
- B: make Mission Control user actions prefer runtime event dispatch when runtime
  truth exists.
- C: tighten provider/share Adapter seams so public-share artifacts and bundles
  are sanitized at the seam, not only by callers.

## Constraints

- Preserve existing Craft/ROX behavior unless tests prove a runtime truth bug.
- Do not call real LLM, browser, payment, email, marketplace, shortlink, or
  storage providers in tests.
- Keep fake providers deterministic.
- Keep `MissionRun` finalization evidence-backed.
- Do not stage `events.jsonl`, `.claude/`, runtime logs, caches, build output, or
  generated local state.

## Acceptance

- Experience metrics and quest projection have dedicated tested Modules.
- Failed `mission.finalized` events cannot complete final-deliverable quest
  progress.
- Mission Control checkpoint completion can dispatch through
  `ExperienceRuntimeStore` and persistence instead of local-only mutation.
- Provider public-share artifact content and metadata are redacted.
- Share provider uploads/updates sanitize public bundles even if callers forget.
- Targeted tests pass.
- Worklog is complete.
- Scoped Lore commit exists.


## Verification Notes

Verified complete against acceptance criteria during the production-readiness
hardening pass:

- dedicated metric/quest runtime Modules exist and are covered by tests;
- failed `mission.finalized` events cannot complete the final deliverable quest;
- Mission Control checkpoint completion dispatches through runtime truth when a
  runtime store exists;
- provider/share seams redact public-share artifacts and sanitize upload/update
  bundles;
- targeted validation remains green.

See `docs/worklog/T089-runtime-module-depth-and-action-seams.md` for the exact
validation commands and results.
