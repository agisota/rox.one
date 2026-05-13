# T078 ROX composer quick-action wrappers

Status: DONE

## Problem

The composer toolbar currently treats quick controls like Improve prompt, TDD Plan, Verify, Tear down, Build spec, and Review as artifact screens. That makes lightweight intent changes feel like modal workflows, and empty input can still surface noisy in-app artifact states.

## Acceptance Criteria

- Quick action intents default to `behavior: 'wrap-prompt'`.
- Quick actions produce a deterministic prompt wrapper around the user's current target.
- Valid targets are composer text, follow-up context, explicit file/source attachments, or source context.
- `workingDirectory`, session labels, and status alone are context, not valid targets.
- Empty/invalid quick actions show inline/user feedback and do not open artifacts or submit.
- Existing artifact screens remain available only through explicit secondary `behavior: 'open-artifact'` intents.
- Legacy action-id-only artifact routing fails closed.
- Experience events are emitted only for explicit artifact screens with valid target input.
- Targeted unit/RTL checks cover quick wrappers, artifact routing, toolbar intent payloads, and composer submit behavior.

## Validation

- `bun test apps/electron/src/renderer/components/app-shell/input/__tests__/product-mode-toolbar.test.ts apps/electron/src/renderer/components/app-shell/input/__tests__/composer-quick-action-flow.test.ts apps/electron/src/renderer/components/app-shell/input/__tests__/composer-artifact-flow.test.ts apps/electron/src/renderer/components/app-shell/input/__tests__/prompt-rewrite-flow.test.ts`
- Targeted FreeFormInput RTL for quick action submit/no-op behavior.
