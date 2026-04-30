# T054 - Experience Navigation, Account Session, and Share Diagnostics

Status: DONE

## Context

Experience Layer screens existed as workbench artifacts, but the main application shell did not expose them as first-class navigation targets. Desktop account login could report success before the account session was confirmed, and public session sharing hid viewer/auth failure details behind a generic upload error.

## Goal

Make the PRD Experience Layer surfaces reachable from the main ROX ONE shell, make desktop account authentication confirm a real account session before showing success, and preserve actionable public-share failure details.

## Acceptance Criteria

- [x] Experience Layer routes parse, roundtrip, and render first-class screens.
- [x] Main shell exposes Deep Missions, Arena Builder, Mission Control, Progression, Quest Map, and Agent Forge.
- [x] Desktop account auth uses a main-process account proxy with session cookie continuity.
- [x] Account UI no longer shows contradictory login success when `/api/account/me` remains unauthenticated.
- [x] Account cabinet prioritizes user profile, balance, teams, storage, sessions, and activity over white-label metadata.
- [x] Public share failures preserve auth, payload, and viewer status details.
- [x] Targeted tests pass.
