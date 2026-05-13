# T-T249-FOLLOWUP: RPC MED-risk boundary validation (T052 scope)

Status: OPEN

## Context

T249 CSP/boundary audit hardened HIGH-risk handlers:
- `labels.ts`, `statuses.ts`, `skills.ts` (in PR #T303)
- `onboarding.ts` (in PR `feat/T249-csp-zod-boundary-hardening-v2`)

The following MED-risk handlers still rely on downstream domain validation
only. Defense-in-depth dictates adding boundary parsers.

## Handlers requiring follow-up

| Handler file | Channels | Unvalidated inputs | Priority |
|---|---|---|---|
| `automations.ts` | 8 | `workspaceId`, `eventName`, `matcherIndex`, `automationId`, `TestAutomationPayload` | MED |
| `messaging.ts` | 25 | `platform: string`, `token: string`, credential objects, binding IDs | MED |
| `sessions.ts` | 25 | `message: string`, `query: string` (search), `content: string` (notes), `command` object fields | MED |
| `settings.ts` | 29 | `key: string`, `value: unknown` (SETTINGS_UPDATE), `model: string`, draft payloads | MED |
| `sources.ts` | 9 | `sourceSlug: string`, `CreateSourceInput` fields, `credential: string` | MED |
| `resources.ts` | 2 | `ResourceBundle` shape, `ResourceImportMode` discriminator | MED |
| `oauth.ts` | 4 | `sourceSlug: string`, `code: string`, `state: string` (OAuth tokens) | MED |

## Why not fixed in T249 PR

Per task scope: "If you find 1-5 handlers missing validation AND adding a
hand-rolled validator is mechanical, apply the fix." The MED-risk handlers
above have 2-25 channels each with complex payload shapes — fixes are not
mechanical and require careful per-field schema design to avoid breaking
existing callers. This is T052 scope.

## Recommended approach

1. Extend `_validators.ts` with `parseOptionalId`, `parsePositiveInt`,
   and per-handler payload schemas similar to `parseCreateLabelInput`.
2. For `messaging.ts` and `sessions.ts` with 25 channels each, consider
   grouping validators by payload shape rather than per-channel.
3. For `settings.ts` SETTINGS_UPDATE, add a `parseSettingValue` that
   type-narrows based on the validated `key`.

## Acceptance criteria

- Every MED-risk handler listed above has at least one `parseId` or
  equivalent call on the first string parameter before any domain logic.
- `parseId` errors surface as HTTP 400 / IPC error with `code: INVALID_INPUT`.
- All existing tests continue to pass.
- No new external dependencies (zero-dep parsers only, matching _validators.ts pattern).
