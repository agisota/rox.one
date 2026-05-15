# Dependency Risk Register - 2026-05-15

Branch: `chore/T509-csp-cve-renovate`
Scan tool: `bun audit v1.3.13 (bf2e2cec)`
Prior register: [`dependency-risk-register-2026-05-08.md`](dependency-risk-register-2026-05-08.md)
Scan date: 2026-05-15

---

## Live Audit Result

Command:

```bash
bun audit 2>&1 | tee /tmp/d3-bun-audit.txt
```

Result:

```text
17 vulnerabilities (2 critical, 7 high, 7 moderate, 1 low)
```

---

## Severity Snapshot

| Severity | 2026-05-08 | 2026-05-15 | Delta |
|---|---:|---:|---:|
| Critical | 3 | 2 | -1 |
| High | 13 | 7 | -6 |
| Moderate | 15 | 7 | -8 |
| Low | 1 | 1 | 0 |
| **Total** | **32** | **17** | **-15** |

Net improvement: **15 fewer vulnerabilities** since the 2026-05-08 baseline.

---

## New CVEs Since 2026-05-08

Advisories present in the 2026-05-15 scan but not individually listed in the 2026-05-08
register (new advisories published against previously-listed packages, or updated advisory IDs):

| Package | Severity | Advisory | Description | Fix Available | Target Release |
|---|---|---|---|---|---|
| `hono <4.12.18` | Moderate | GHSA-qp7p-654g-cw7p | CSS Declaration Injection via Style Object Values in JSX SSR | Yes (>=4.12.18) | v1.1.0 |
| `hono <4.12.18` | Moderate | GHSA-p77w-8qqv-26rm | Cache Middleware cross-user cache leakage via Vary header | Yes (>=4.12.18) | v1.1.0 |
| `hono <4.12.18` | Low | GHSA-hm8q-7f3q-5f36 | Improper validation of NumericDate claims in JWT verify() | Yes (>=4.12.18) | v1.1.0 |
| `vite <=6.4.1` | Moderate | GHSA-4w7w-66w2-5vf9 | Path Traversal in Optimized Deps `.map` Handling | Yes (>6.4.1) | v1.1.0 |
| `esbuild <=0.24.2` | Moderate | GHSA-67mh-4wv8-2f99 | Dev server allows any website to send requests and read response | Yes (>0.24.2) | v1.1.0 |
| `xmldom <=0.6.0` | High | GHSA-wh4c-j3r5-mjhp | XML injection via unsafe CDATA serialization | No (unmaintained) | v1.1.0 (isolation) |
| `xmldom <=0.6.0` | High | GHSA-2v35-w6hq-6mfw | Uncontrolled recursion in XML serialization leads to DoS | No (unmaintained) | v1.1.0 (isolation) |
| `xmldom <=0.6.0` | High | GHSA-f6ww-3ggp-fr8h | XML injection through unvalidated DocumentType serialization | No (unmaintained) | v1.1.0 (isolation) |
| `xmldom <=0.6.0` | High | GHSA-x6wf-f3px-wcqx | XML node injection through unvalidated processing instruction | No (unmaintained) | v1.1.0 (isolation) |
| `xmldom <=0.6.0` | High | GHSA-j759-j44w-7fr8 | XML node injection through unvalidated comment serialization | No (unmaintained) | v1.1.0 (isolation) |
| `ip-address <=10.1.0` | Moderate | GHSA-v2v4-37r5-5v8g | XSS in Address6 HTML-emitting methods | Yes (>10.1.0) | v1.1.0 |

---

## Resolved CVEs Since 2026-05-08

Packages that carried advisories in the 2026-05-08 register and no longer appear with those
specific severities in the 2026-05-15 scan:

| Package | Prior Severity | Resolution |
|---|---|---|
| `protobufjs <7.5.5` | Critical | Resolved — no longer flagged (upgrade or transitive dep update) |
| `music-metadata <=11.12.1` | High | Resolved — no longer flagged |
| `axios >=1.0.0 <1.15.0` | High + Moderate + Low | Resolved — no longer flagged |
| `@anthropic-ai/sdk >=0.79.0 <0.91.1` | Moderate | Resolved — no longer flagged |
| `@azure/identity <4.2.1` (high advisories) | High (multiple) | Reduced to 1 moderate remaining |

**1 critical resolved** (`protobufjs`). The `xmldom` critical (GHSA-crh6-fp67-6883) was
already present in 2026-05-08 and remains in 2026-05-15.

---

## Current Outstanding Advisories (Full List)

| Package | Severity | Advisory | Dependency Path | Fix Available |
|---|---|---|---|---|
| `xmldom <=0.6.0` | **Critical** | GHSA-crh6-fp67-6883 | `markitdown-js › xmldom` | No (unmaintained) |
| `node-tesseract-ocr <=2.2.1` | **Critical** | GHSA-8j44-735h-w4w2 | `markitdown-js › node-tesseract-ocr` | No (unmaintained) |
| `xmldom <=0.6.0` | High | GHSA-wh4c-j3r5-mjhp | `markitdown-js › xmldom` | No |
| `xmldom <=0.6.0` | High | GHSA-2v35-w6hq-6mfw | `markitdown-js › xmldom` | No |
| `xmldom <=0.6.0` | High | GHSA-f6ww-3ggp-fr8h | `markitdown-js › xmldom` | No |
| `xmldom <=0.6.0` | High | GHSA-x6wf-f3px-wcqx | `markitdown-js › xmldom` | No |
| `xmldom <=0.6.0` | High | GHSA-j759-j44w-7fr8 | `markitdown-js › xmldom` | No |
| `xlsx <0.19.3` | High | GHSA-4r6h-8v6p-xvw6 | `markitdown-js › xlsx` | Yes (>=0.19.3) |
| `xlsx <0.19.3` | High | GHSA-5pgg-2g8v-p4x9 | `markitdown-js › xlsx` | Yes (>=0.19.3) |
| `hono <4.12.18` | Moderate | GHSA-qp7p-654g-cw7p | `@rox-one/core › @modelcontextprotocol/sdk` | Yes |
| `hono <4.12.18` | Moderate | GHSA-p77w-8qqv-26rm | `@rox-one/core › @modelcontextprotocol/sdk` | Yes |
| `hono <4.12.18` | Low | GHSA-hm8q-7f3q-5f36 | `@rox-one/core › @modelcontextprotocol/sdk` | Yes |
| `ip-address <=10.1.0` | Moderate | GHSA-v2v4-37r5-5v8g | `@rox-one/core › @modelcontextprotocol/sdk`; `@rox-one/pi-agent-server › @mariozechner/pi-ai` | Yes |
| `vite <=6.4.1` | Moderate | GHSA-4w7w-66w2-5vf9 | `@rox-one/viewer, @rox-one/electron` | Yes |
| `xmldom <=0.6.0` | Moderate | GHSA-5fg8-2547-mr8q | `markitdown-js › xmldom` | No |
| `@azure/identity <4.2.1` | Moderate | GHSA-m5vv-6r4h-3vj9 | `markitdown-js › @azure/identity` | Yes (>=4.2.1) |
| `esbuild <=0.24.2` | Moderate | GHSA-67mh-4wv8-2f99 | `@rox-one/viewer › vite`; `@rox-one/electron › vitest` | Yes |

---

## Production Exposure Classification

| Package / path | Audit severity | Dependency path | Production exposure | Action |
|---|---|---|---|---|
| `xmldom <=0.6.0` | Critical + High + Moderate | `markitdown-js › xmldom` | XML/document parsing. Must stay isolated (local/private only); do not accept untrusted public uploads. | Isolation or replacement in v1.1.0 |
| `node-tesseract-ocr <=2.2.1` | Critical | `markitdown-js › node-tesseract-ocr` | OS command injection risk. OCR/document conversion must stay local or isolated. No public upload exposure. | Sandbox or removal in v1.1.0 |
| `xlsx <0.19.3` | High | `markitdown-js › xlsx` | Spreadsheet ingestion. Private/local only until upgraded. | Upgrade `markitdown-js` or pin `xlsx >=0.19.3` via patch |
| `hono <4.12.18` | Moderate + Low | `@modelcontextprotocol/sdk` (transitive) | CSS injection affects SSR JSX paths (not used here). JWT issue affects token verification. | Upgrade when MCP SDK pins hono >=4.12.18 |
| `vite <=6.4.1` | Moderate | build toolchain + vitest | Dev/build-time only. Path traversal in dev server `.map` handling is not a production runtime risk. | Upgrade vite in next dependency batch |
| `esbuild <=0.24.2` | Moderate | transitive via vite | Dev server only. Not a production runtime risk. | Upgrade transitively with vite |
| `ip-address <=10.1.0` | Moderate | MCP SDK + pi-ai (transitive) | XSS in HTML-emitting methods — exploitable only if app renders Address6 output as raw HTML. | Upgrade when upstream SDKs release fixes |
| `@azure/identity <4.2.1` | Moderate | `markitdown-js` (transitive) | Elevation of privilege for Azure token acquisition. Only relevant if Azure auth is used. | Upgrade via `markitdown-js` or patch |

---

## Remediation Lanes (Updated)

1. **`markitdown-js` isolation/upgrade** (addresses Critical x2, High x7, Moderate x2):
   `xmldom`, `node-tesseract-ocr`, `xlsx`, `@azure/identity` all route through `markitdown-js`.
   Either upgrade `markitdown-js` to a version with patched transitive deps, or enforce strict
   worker-process isolation so this package never handles untrusted public input.

2. **`@modelcontextprotocol/sdk` upgrade** (addresses Moderate x3 + Low x1 via `hono`):
   Wait for upstream MCP SDK release that pins `hono >=4.12.18`.

3. **`vite` + `esbuild` upgrade** (addresses Moderate x2):
   Upgrade `vite` past 6.4.1. `esbuild` upgrades transitively. Dev/build-time risk only.

4. **`ip-address` upgrade** (addresses Moderate x1):
   Upgrade when `@modelcontextprotocol/sdk` or `@mariozechner/pi-ai` pull in `ip-address >10.1.0`.

5. **Accepted-risk recording**: Any remaining unresolved advisory before public production
   release must be entered into [`accepted-risk-register-2026-05-08.md`](accepted-risk-register-2026-05-08.md)
   with owner, expiration date, compensating control, and rollback plan.

---

## Outstanding Action Items

| # | Package | Action | Owner | Target |
|---|---|---|---|---|
| DEP-01 | `xmldom` (via markitdown-js) | Isolation or replacement | Platform | v1.1.0 |
| DEP-02 | `node-tesseract-ocr` (via markitdown-js) | Sandbox or disable public upload path | Platform | v1.1.0 |
| DEP-03 | `xlsx` (via markitdown-js) | Upgrade or patch to >=0.19.3 | Platform | v1.1.0 |
| DEP-04 | `hono` (via MCP SDK) | Track MCP SDK release, upgrade | Platform | v1.1.0 |
| DEP-05 | `vite` | Upgrade to >6.4.1 | Infra | v1.1.0 |
| DEP-06 | `esbuild` | Upgrade transitively via vite | Infra | v1.1.0 |
| DEP-07 | `ip-address` | Track MCP SDK / pi-ai release | Platform | v1.1.0 |
| DEP-08 | `@azure/identity` | Upgrade via markitdown-js or patch | Platform | v1.1.0 |

---

## Verification Commands

```bash
bun audit
bun test scripts/__tests__/dependency-risk-register-contract.test.ts
bun run validate:docs
git diff --check
```
