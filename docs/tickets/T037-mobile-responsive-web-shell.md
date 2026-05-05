# T037-mobile-responsive-web-shell

Status: DONE

## Goal

Make the core Experience/Workbench screens usable on narrow mobile/web shell
viewports by enforcing a shared mobile-first shell contract:

- no horizontal overflow from the Experience surface;
- primary content and right-side context stack into one column on mobile;
- action rows can compress to full-width mobile controls;
- desktop split-panel layout remains available at `xl`;
- all first-class Experience screens keep rendering through the shared shell.

## Required UI

- `Deep Missions`
- `Arena Builder`
- `Mission Control`
- `Progression Observatory`
- `Quest Map`
- `Agent Forge`

## Required Tests

- Static renderer contract test for the shared mobile shell attributes/classes.
- Static route smoke test confirming all Experience screens inherit the mobile
  shell contract.
- Existing workbench localization/polish tests must continue passing.

Required loop:

1. Inspect repo context.
2. Write tests or validation checks first.
3. Confirm expected failure.
4. Implement minimal change.
5. Run targeted checks.
6. Run full relevant validation.
7. Update matching worklog.
8. Commit.
