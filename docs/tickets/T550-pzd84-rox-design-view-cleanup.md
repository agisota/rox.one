# T550 — PZD-84 Rox Design view cleanup

Status: DONE

## Problem
The Rox Design embedded view can re-apply ROX skin CSS across navigation, DOM-ready, and load events. Without cycling the previous `insertCSS` key and unregistering WebContents listeners on teardown, a long-running desktop session can accumulate stylesheet state and event handlers.

## Acceptance Criteria
- `RoxDesignViewManager` removes the previous inserted CSS key before inserting a new ROX skin sheet.
- `removeInsertedCSS` failure is handled as a stale-key warning and does not block the next skin insert.
- `destroyAll()` unregisters WebContents listeners before closing the embedded view.
- Focused regression tests cover the cleanup behavior.
- Relevant typecheck/test gates pass or blockers are documented.
