# T129 - Composer artifact click-through and visibility pass

Status: DONE

## Summary

Make all six composer action buttons open visible in-app artifact flows and keep the embedded artifact controls reachable in the composer surface.

## Acceptance Criteria

- `Улучшить prompt`, `TDD Plan`, `Проверить`, `Разъебать`, `Собрать ТЗ`, and `Ревью` each open the expected artifact screen.
- Internal artifact buttons produce visible local state changes or insert generated output into the composer.
- The embedded composer artifact area stays reachable without requiring external model execution.
- Targeted tests, Electron lint/typecheck, and Electron build pass.
