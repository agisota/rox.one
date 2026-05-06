# T081 - Visual Polish, Motion, States, and UX Coherence

Status: DONE

## Goal

Strengthen the shared Experience visual language for inline feedback states while preserving the dense mission-control product feel.

## Scope

- Shared inline feedback strip for:
  - `+VDI`
  - `+XP`
  - quest advanced
  - gate failed
  - mission blocked
  - artifact accepted
- Motion-safe and reduced-motion classes.
- Compact-width wrapping and `min-w-0`/`break-words` protections.
- Command/Game/Arena visual intensity through tone props only, without changing truth.
- No global CSS or design token churn.

## Acceptance

- Component tests cover state variants, motion classes, compact wrapping, and tone separation.
- Existing Experience UI tests remain green.
- Worklog records red/green/verify evidence.
- Scoped commit exists.
