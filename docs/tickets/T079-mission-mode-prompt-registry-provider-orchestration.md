# T079 - Mission Mode Prompt Registry + Provider Orchestration

Status: DONE

## Goal

Make mission modes executable runtime contracts instead of labels by defining prompt templates, output contracts, validation gates, provider capabilities, checkpoint behavior, and failure modes.

## Scope

- Shared `MissionModePromptRegistry` for all supported mission modes.
- Deterministic prompt compilation from mission draft input.
- Fake-safe provider gateway execution using compiled mission mode contracts.
- Existing provider timeout, invalid output, real-provider disable, and public-share redaction contracts remain enforced.

## Acceptance

- Every mission mode has a prompt/runtime contract.
- Prompt contracts compile with mission draft input.
- Fake provider returns deterministic artifacts for compiled mission mode prompts.
- Malformed provider output fails before it becomes evidence.
- Provider timeout does not corrupt mission state input.
- Secret fields are redacted from public/share artifacts.
- Tests and validation are recorded in `docs/worklog/T079-mission-mode-prompt-registry-provider-orchestration.md`.
