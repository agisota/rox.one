# T200 - Clear dependency security alerts

## Summary

Update dependency ranges that GitHub Dependabot reports as vulnerable after the final composer/audit integration merge.

## Acceptance Criteria

- `@anthropic-ai/sdk` resolves to a fixed version for direct and transitive workspace use.
- `playwright` resolves to a fixed version and the matching browser cache is available for audit tests.
- `happy-dom` resolves to a fixed version for Electron RTL tests.
- `beautiful-mermaid` workspace dependency ranges no longer allow vulnerable historical releases.
- Full quality gate and packaged app smoke pass after the lockfile update.

