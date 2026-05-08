# Dependency Risk Register - 2026-05-08

Branch: `mac/rox-production-ready-rc`
Scope: private/local RC dependency audit baseline.

## Live Audit Result

Command:

```bash
bun audit
```

Result: fail, as expected for the current dependency graph.

```text
32 vulnerabilities (3 critical, 13 high, 15 moderate, 1 low)
```

No dependency manifest or lockfile changes were made in this slice.

Public production remains blocked until these findings are remediated, isolated
behind production controls, or explicitly accepted in a signed release decision.
The accepted-risk decision contract is tracked in
[`accepted-risk-register-2026-05-08.md`](accepted-risk-register-2026-05-08.md);
as of this baseline, no public-production dependency risk is accepted.

## Severity Snapshot

| Severity | Count | Current examples |
|---|---:|---|
| Critical | 3 | `protobufjs`, `xmldom`, `node-tesseract-ocr` |
| High | 13 | `music-metadata`, `xmldom`, `xlsx`, `axios`, `exiftool-vendored` |
| Moderate | 15 | `ip-address`, `@anthropic-ai/sdk`, `file-type`, `axios`, `@azure/identity` |
| Low | 1 | `axios` |

## Production Exposure Classification

| Package / path | Audit severity | Observed dependency path | Production exposure |
|---|---|---|---|
| `protobufjs <7.5.5` | Critical | `@larksuiteoapi/node-sdk`, `@whiskeysockets/baileys`, `@mariozechner/pi-ai` | Messaging/provider surfaces must not be exposed publicly before upgrade or isolation. |
| `node-tesseract-ocr <=2.2.1` | Critical | `markitdown-js` | OCR/document conversion must stay local or isolated; do not accept untrusted public uploads through this path. |
| `xmldom <=0.6.0` | Critical + high + moderate | `markitdown-js` | XML/document parsing needs dependency replacement, sandboxing, or strict file-type disablement before public ingestion. |
| `axios >=1.0.0 <1.15.0` | High + moderate + low | `@larksuiteoapi/node-sdk`, `@whiskeysockets/baileys`, `markitdown-js` | External HTTP paths need upgrade plus SSRF/proxy hardening before public production. |
| `xlsx <0.19.3` | High | `markitdown-js` | Spreadsheet ingestion remains private/local only until upgraded or isolated. |
| `exiftool-vendored <=35.18.0` | High | `markitdown-js` | Media metadata parsing needs argument-injection mitigation before public upload workflows. |
| `music-metadata <=11.12.1` | High | `@whiskeysockets/baileys` | WhatsApp media handling needs package update or worker isolation before public runtime exposure. |
| `@anthropic-ai/sdk >=0.79.0 <0.91.1` | Moderate | `@anthropic-ai/claude-agent-sdk`, `@mariozechner/pi-ai` | Local filesystem memory-tool permissions need upgrade review before multi-tenant production. |

## Remediation Lanes

1. Upgrade direct and transitive packages where compatible fixes exist, starting
   with `protobufjs`, `axios`, and `@anthropic-ai/sdk`.
2. Split document conversion risks from the default runtime: `markitdown-js`,
   `xmldom`, `xlsx`, `node-tesseract-ocr`, and `exiftool-vendored` should run
   only in an isolated worker or be disabled for untrusted public input.
3. Treat messaging adapters as separate production-risk lanes:
   `@larksuiteoapi/node-sdk`, `@whiskeysockets/baileys`, and PI agent packages
   should be upgraded or isolated before external traffic.
4. Add SSRF/proxy tests around any public HTTP-fetching path that depends on
   `axios` or provider SDKs.
5. Record any unresolved vulnerability as an explicit accepted risk with owner,
   expiration date, compensating control, and rollback plan.

Current hardening note: T110 adds a public-untrusted guard for LLM custom
endpoint setup/test/save so loopback, private-network, and link-local base URLs
are rejected before backend network calls or persistence in public deployments.
T112 adds a public-untrusted guard before PI provider model discovery and
GitHub Copilot OAuth import/invocation. Remaining provider SDK HTTP paths still
need upgrades, isolation evidence, or accepted-risk handling before public
production. T113 removes PI SDK model discovery from the broad shared config
barrel and routes PI-only callers through `@rox-agent/shared/config/models-pi`
so generic config imports do not transitively load `@mariozechner/pi-ai`.

## Verification Commands

Current baseline:

```bash
bun audit
bun test scripts/__tests__/dependency-risk-register-contract.test.ts
bun run validate:docs
git diff --check
```

Exit criteria before public production:

```bash
bun audit
```

must either pass cleanly or be paired with
[`accepted-risk-register-2026-05-08.md`](accepted-risk-register-2026-05-08.md)
entries for every remaining advisory plus production isolation evidence for
externally reachable code paths.
