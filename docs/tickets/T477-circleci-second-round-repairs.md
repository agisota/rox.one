# T477 CircleCI second-round repairs

Status: DONE

## Problem

CircleCI reruns for PR #217 and the stacked PR #218 moved past the first bridge
failures but exposed second-round parity gaps:

- validate lacked Playwright Chromium/system dependencies on the Docker runner;
- R.11 preflight snapshot collection threw when `gh` was not installed;
- Shiki highlighter tests could exceed Bun's default timeout while loading the
  full Shiki language/theme set;
- mac ARM packaging let electron-builder inspect production `node_modules`, which
  failed on the vulnerable `libsignal -> protobufjs@6.8.8` exact dependency.

## Acceptance Criteria

- CircleCI validate installs the Playwright browser required by unit probes.
- R.11 preflight collection fails closed when optional external CLIs are missing.
- Shiki highlighter contract tests tolerate cold Shiki startup without masking
  real assertion failures.
- mac ARM packaging marks `node_modules` as handled outside electron-builder's
  production dependency collector.
- Relevant local validation passes before pushing and rerunning CircleCI.
