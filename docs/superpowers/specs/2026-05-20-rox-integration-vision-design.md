# ROX.ONE Integration Vision — Indistinguishability + Integration Constellation

- **Date**: 2026-05-20
- **Status**: Draft for review
- **Authors**: independent audit synthesis (parallel security/packaging/runtime/regression lanes)
- **Linear coordinator**: PZD-41 (branch merge coordination)
- **Related Linear**: PZD-10/35 (T271 artifacts), PZD-19 (PR #268 vendoring), PZD-39 (T539 polish), PZD-46 (CSP), PZD-48/49/51 (audit B-CI-1/B-SIGN-3/B-REPRO-2), PZD-64 (Open-Design UX PRD), PZD-65 (T541 URL pin), PZD-66 (A-M1+A-M2 env hardening), PZD-67 (T542 sessionManager guard)
- **Audit context**: `docs/audits/2026-05-20-pr268-release-readiness-audit.md`; memory `project_pr268_audit_outcome.md`, `project_pr268_linear_intake_complete.md`

---

## TL;DR

Two big goals, jointly scoped at **11-15 dev-weeks** (≈ one quarter with 1 senior + 1 mid + design + QA part-time). MVP slice possible in **8 weeks**.

* **Goal 1 — Indistinguishability**: Rox Design (and every future integration) feels like a native ROX.ONE surface. 6 dimensions: visual continuity, interaction parity, navigation as one app, error/failure UX, a11y floor, performance floor. 24 sub-objectives, 72-84 tasks.
* **Goal 2 — Integration Constellation**: every integration is a native sense organ of ROX.ONE; we land 2 new integrations this quarter (T271 Agent Artifacts + Browser-as-tool) on a shared framework; existing Rox Design refactors onto the same framework. 6 areas (primitives, test infra, T271 consumer, Browser-as-tool, Rox Design refactor, docs/playbook). 26 sub-objectives, 74-94 tasks.

Cross-cutting: security boundary preserved at all costs (the PR #268 audit baseline), RU+EN i18n, offline-first UX, observability + opt-in telemetry, performance budget per integration, Linear-first traceability.

---

## Section 1 — Vision & Success Criteria

### Goal 1: Indistinguishability

**Vision**: "I never notice when I cross between ROX.ONE and Rox Design — clicking, navigating, theming, scrolling, error-recovery, screen-reader experience — it all feels like one product designed by one team."

**4 measurable dimensions** + **2 cross-cutting floors**:

| Dim | Definition | Success threshold |
|-----|-----------|-------------------|
| **Visual continuity** | Typography, spacing, density, color tokens, motion language all consume the same design-system tokens as ROX.ONE chrome | Visual diff between ROX.ONE Settings panel ↔ Rox Design panel **passes maintainer + design-lead review**; theme-switch flash absent in a 60fps screen recording |
| **Interaction parity** | Keyboard shortcuts, focus, panel ergonomics work identically inside Rox Design | Full keyboard-only workflow recording; Cmd+K palette includes Rox Design commands; focus ring is ROX.ONE's |
| **Navigation as one app** | Deep links, back-button traversal, breadcrumbs reflect cross-surface history | Roundtrip: open project → switch to chat → Cmd+[ → land back on same project state |
| **Error / failure UX** | Sidecar crash / network loss / payload incomplete surface as ROX.ONE-styled toasts/banners with retry + telemetry | Crash simulator shows ROX.ONE banner within 800ms; user recovers with 1 click |
| **A11y floor** *(cross-cut)* | WCAG 2.2 AA on the design panel | axe-core score ≥ 95%; keyboard-only flow; SR landmarks narrated correctly |
| **Performance floor** *(cross-cut)* | First-click → visible bounded; INP < 200ms; bundle delta bounded | Cold ≤ 1500ms P95; warm-open ≤ 300ms P95; cache ≤ 100ms; renderer delta ≤ 30KB gzip |

### Goal 2: Integration Constellation

**Vision**: "ROX.ONE evolves from a chat-app-with-one-design-tool into a workbench where multiple integrations (design, artifacts, browser-as-tool, …) each feel native, compound via agent workflows, and obey the same trust/UX/observability contract. The 'framework' is invisible — the user just experiences 3 surfaces that behave like one body."

**Consumer benefits** (test in user feedback, not architecture docs):
1. *"I can keep my work in flow"* — opening artifacts, design, browser-as-tool feels like reaching for 3 tools on the same desk.
2. *"Agents work across all my tools"* — Cmd+K → "make me a logo with the brand colors from this site" → browser-as-tool fetches site → agent extracts palette → Rox Design opens with palette pre-applied → artifacts panel persists the final logo. One shortcut, cross-surface.
3. *"I trust new integrations on day one"* — same security boundary, error UX, theme parity, keyboard support as the existing ones.

**3 customers, in landing order**:

| # | Surface | User-perceived value | Framework role |
|---|---------|----------------------|----------------|
| 1 | **T271 Agent Artifacts panel** (active parallel work) | First-class panel for agent outputs (logos, docs, charts, code); rail of past artifacts, preview, export, share | First consumer — proves framework works for in-process React panel (not WebContentsView). Forces dual-primitive handling. |
| 2 | **Browser-as-tool** (new) | Agent has a real Electron WebContentsView it can drive: navigate, read, fill, screenshot. Available as a tool in any agent workflow. | Second consumer — proves WebContentsView path; reuses navigation policy + skin + bridge from Rox Design. |
| 3 | **Rox Design refactored onto framework** | User-invisible — no behavior change. Internal: ~2000 LoC of bespoke code consolidates into manifest + integration code. | Validates "old integrations migrate without regression". |

**Success criteria for Goal 2**:
1. T271 artifacts ships on the framework (or absorbs framework in ≤ 1 dev-day if T271 lands sooner standalone).
2. Browser-as-tool ships as a new integration using ≤ 200 LoC of manifest + custom skin/IPC (smell-check, not hard gate).
3. Rox Design refactor lands with zero functional regression and ≥ 40% reduction in bespoke LoC.
4. Integration playbook published as `docs/architecture/integration-framework.md` + ADR.
5. Framework test infrastructure exists (closes Lane C's "~0% coverage" gap).

### Cross-cutting principles

| Principle | Definition | Where it lives |
|-----------|-----------|----------------|
| **Security boundary preserved** | `sandbox:true`, `contextIsolation:true`, `nodeIntegration:false`, HMAC desktop bridge, URL origin pinning (PZD-65), env-var hardening (PZD-66) | Framework default; integrations cannot override |
| **i18n: RU+EN first-class** | Every UI string + error message + tooltip in both RU + EN at landing | Framework provides i18n primitive consuming ROX.ONE's translation table |
| **Offline-first UX** | Capabilities declared offline/online; banners; local-only integrations work fully | Manifest `capabilities.requiresNetwork: boolean` + automatic offline banner |
| **Observability** | Structured spans for start, IPC, navigation, error; ops dashboard per integration | Framework's telemetry contract |
| **Telemetry opt-in** | No PII/content/usage leaves device without explicit consent (CLAUDE.md compliance) | Default off; consent UX; framework cannot accidentally enable |
| **Performance budget per integration** | Manifest declares bundle + startup budget; CI enforces | `IntegrationManifest.budget` + CI gate |
| **Native ROX.ONE patterns** | When ROX.ONE's pattern differs from upstream's, pick ROX.ONE | Framework forces via skin pipeline |
| **Reversibility** | Feature-flag gated registration | Framework supports flagged integrations |
| **Linear-first traceability** | Every sub-objective gets a Linear issue under the ROX.ONE GitHub Roadmap Sync project | This doc enumerates all 50 sub-objectives; sub-issues created per phase |

---

## Section 2 — Goal 1 Decomposition

### 1.1 Visual continuity (4 sub-obj, 12-14 tasks, ~2w)

* **1.1.A** Theme bridge: light / dark / system / custom — no flash. Builds on T537 phase B (`f415912d`).
* **1.1.B** Embed-skin pipeline consumes ROX.ONE design tokens (not hardcoded hex). Splits 971-LoC `embed-skin.ts` per Lane C M1.
* **1.1.C** Panel chrome (header, close, resize) is ROX.ONE's, not Open Design's.
* **1.1.D** Loading state uses ROX.ONE shimmer skeleton, not white flash.

### 1.2 Interaction parity (4 sub-obj, 14-16 tasks, ~2-3w)

* **1.2.A** Standard ROX.ONE shortcuts inside panel (Cmd+W, Cmd+\, Cmd+K, Escape, Tab order).
* **1.2.B** Focus trap + restoration on open/close.
* **1.2.C** Cmd+K palette includes Rox Design commands.
* **1.2.D** Cross-surface drag-and-drop (artifacts ↔ Rox Design). Depends on T271 landing first.

### 1.3 Navigation as one app (4 sub-obj, 12-14 tasks, ~2w)

* **1.3.A** Deep links `rox://design/project/X` work from system URL bar + agent.
* **1.3.B** Cross-surface back/forward (Cmd+[ / Cmd+]) preserves state.
* **1.3.C** Breadcrumbs in TopBar reflect Rox Design selection.
* **1.3.D** State restoration: close + reopen lands at same project.

### 1.4 Error / failure UX (4 sub-obj, 14-16 tasks, ~2w)

* **1.4.A** Sidecar-crash → ROX.ONE banner + 1-click recover. IPC `rox-design:sidecar-exited` already emits (`d1ea1854`).
* **1.4.B** Offline-mode UX: cloud features fail gracefully, local works.
* **1.4.C** Payload-incomplete setup banner.
* **1.4.D** Structured error spans (closes Lane C silent-error gaps; cross-cuts to G2 2.1.F).

### 1.5 A11y floor (4 sub-obj, 10-12 tasks, ~1-2w)

* **1.5.A** axe-core CI gate ≥ 95%.
* **1.5.B** Keyboard-only recorded test.
* **1.5.C** Screen-reader landmarks audit + fixes.
* **1.5.D** Focus ring tokens + visible indicators.

### 1.6 Performance floor (4 sub-obj, 10-12 tasks, ~1-2w)

* **1.6.A** Telemetry: first-click → visible measurement.
* **1.6.B** Warm-cache strategy: pre-spawn sidecar on app idle.
* **1.6.C** Bundle audit + tighten to ≤ 30KB gzip renderer delta.
* **1.6.D** INP < 200ms monitoring.

---

## Section 3 — Goal 2 Decomposition

### 2.1 Framework primitives (8 sub-obj, 24-30 tasks, ~3-4w)

* **2.1.A** `IntegrationManifest` schema + validator (Zod) + registry.
* **2.1.B** Lifecycle hooks: `beforeStart` / `onReady` / `onError` / `beforeStop`.
* **2.1.C** Sandbox baseline (security-by-default; types prohibit weakening).
* **2.1.D** Skin pipeline (CSS + bootstrap, token-driven, reapply without flash).
* **2.1.E** Navigation policy (URL allowlist + back-button integration; generalize current `getRoxDesignNavigationDecision`).
* **2.1.F** Telemetry contract (opt-in, per-integration tags, ops dashboard view template).
* **2.1.G** Capability declaration (offline, network, permissions, automatic UX).
* **2.1.H** Performance budget enforcement (CI gate per integration).

### 2.2 Framework test infrastructure (4 sub-obj, 10-12 tasks, ~1.5w)

* **2.2.A** Mocked WebContentsView for unit tests (reusable across integrations).
* **2.2.B** IPC contract tests (type-level + runtime).
* **2.2.C** Skin pipeline visual snapshot tests.
* **2.2.D** Integration manifest validator tests.

### 2.3 T271 artifacts as first consumer (3 sub-obj, 6-9 tasks, ~1-2w)

* **2.3.A** Coordinate with active T271 work in PZD-10 / PZD-35.
* **2.3.B** Integrate-after path: framework-fit refactor PR after T271 lands standalone.
* **2.3.C** Validate framework supports in-process pattern (vs WebContentsView).

### 2.4 Browser-as-tool as second consumer (4 sub-obj, 14-18 tasks, ~3-4w)

* **2.4.A** UX brief: "Agent's browser" — mockups, use cases, permission model, privacy.
* **2.4.B** Implementation on framework (manifest, skin, IPC handlers).
* **2.4.C** Agent tool integration (MCP-or-equivalent registration; schema; orchestration).
* **2.4.D** Compound workflow demo (the "logo from site's palette" scenario).

### 2.5 Rox Design refactor (3 sub-obj, 12-15 tasks, ~2-3w)

* **2.5.A** Migrate runtime + view manager onto framework hooks; ≥ 40% LoC reduction.
* **2.5.B** Migrate embed-skin pipeline onto framework's skin pipeline; visual regression confirms zero change.
* **2.5.C** Migrate desktop bridge onto framework's IPC contract; preserve HMAC + trust gates; no perf regression.

### 2.6 Playbook + ADR + docs (4 sub-obj, 8-10 tasks, ~1w)

* **2.6.A** ADR: "Integration framework as platform primitive".
* **2.6.B** `docs/architecture/integration-framework.md` reference manual.
* **2.6.C** "Your first integration in 1 day" tutorial (toy calculator embed).
* **2.6.D** Integration checklist template for every new integration PR.

---

## Section 4 — Sequencing, Dependencies & Timeline

### Critical path

```
Week 0    — Foundation
          ├ 2.1.A manifest schema   (blocks everything in G2)
          ├ 2.1.C sandbox baseline  (blocks any new integration)
          └ 2.2.A mocked test infra (blocks confident development)

Week 1-2  — Quick wins (G1 high-payoff items)
          ├ 1.4.A sidecar-crash banner   (visible trust gain)
          ├ 1.4.D structured error spans (observability foundation)
          ├ 1.6.A perf telemetry         (measure before optimize)
          └ 1.1.A theme bridge polish    (compound with T537 PR #2)

Week 3-5  — Framework primitives (parallel with G1 polish)
          ├ 2.1.B lifecycle hooks
          ├ 2.1.D skin pipeline (G1 1.1.B benefits)
          ├ 2.1.E navigation policy (G1 1.3.A benefits)
          └ 2.1.F telemetry contract (G1 1.4.D unified)

Week 6-8  — First framework consumer
          ├ 2.3.B T271 framework-fit refactor  (after T271 lands)
          └ 2.1.G capability + 2.1.H budget    (now stress-tested)

Week 9-12 — Browser-as-tool
          ├ 2.4.A UX brief + design
          ├ 2.4.B+C implementation + agent tool
          └ 2.4.D compound workflow demo

Week 13+ — Rox Design refactor + docs + remaining G1 polish
          ├ 2.5.A-C migrate rox-design onto framework
          ├ 2.6.A-D documentation
          ├ 1.2.D cross-surface drag (T271 + framework ready)
          └ 1.5 a11y audit + 1.6 perf optimization
```

### Dependencies graph

```
G1 1.4.D structured errors  ─┐
                              ├─→  G2 2.1.F telemetry contract  ─→  ops dashboard
G2 2.1.A manifest schema  ───┘
                                                  ↓
G1 1.3 navigation  ←──  G2 2.1.E navigation policy
                                                  ↓
G1 1.1.B token skin  ←──  G2 2.1.D skin pipeline
                                                  ↓
G2 2.3 T271 consumer  ──→  G2 2.4 Browser-as-tool  ──→  G2 2.5 Rox Design refactor
                                                  ↓
G1 1.2.D cross-surface drag (needs T271 + framework)
```

### Risk register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| T271 lands before framework — refactor cost | High | Medium | Plan integrate-after path (2.3.B); don't block T271 |
| Open Design upstream releases break embed-skin | Medium | High | Pin Open Design version; SHA-pinned tarball (PZD-51 fixes this) |
| Browser-as-tool security review delays landing | Medium | High | Start security thread Week 9 early; UX brief 2.4.A includes threat model |
| 1.2.D cross-surface drag blocked by missing infra | High | Medium | De-risk via spike Week 4 (proof-of-concept with mocks) |
| Bundle budget breach | Low | High | Per-integration budget declaration (2.1.H) catches early |
| Refactor PR (2.5) regresses Rox Design | Medium | High | Single PR with full audit-suite + RTL re-run; feature-flag rollback |

### Resourcing assumption

| Role | Weeks | What they own |
|------|-------|---------------|
| Senior Electron engineer | 11-15 | Framework primitives, refactor, integration plumbing |
| Mid engineer | 8-12 | Goal 1 polish (1.1-1.4), one integration consumer |
| Designer (part-time) | 4-6 | Visual continuity, UX briefs, mockups |
| QA (part-time) | 4-6 | A11y audit, performance testing, recorded flows |
| PM | 2-3 | Linear coordination, T271 ↔ framework sequencing, demo |

### MVP slice (8 weeks)

* Week 0: foundation 2.1.A + 2.1.C + 2.2.A
* Week 1-2: G1 quick wins (1.4.A + 1.4.D + 1.6.A + 1.1.A)
* Week 3-5: framework primitives 2.1.B-F
* Week 6: T271 framework-fit refactor (2.3.B)
* Week 7-8: Browser-as-tool tool registration (sans full polish UX) (2.4.B + 2.4.C minimal)

Cut from MVP: Rox Design refactor (2.5), Browser-as-tool full UX (2.4.A polish + 2.4.D demo), G1 1.2.D cross-surface drag, full G1 a11y/perf audit, docs/playbook 2.6.

---

## Section 5 — Acceptance Criteria for the Vision

### Vision-level acceptance

1. **G1**: a user-experience walkthrough (Cmd+K → open Rox Design → navigate inside → close → reopen) feels indistinguishable from native ROX.ONE surfaces per maintainer + design-lead review. axe-core ≥ 95%. INP < 200ms inside the panel. Cold-start ≤ 1500ms P95.
2. **G2**: at least 2 integrations beyond Rox Design are operational (T271 artifacts + Browser-as-tool), both consuming the shared framework, both passing the security baseline tests automatically.
3. **Documentation**: a new engineer can build a hello-world integration in ≤ 1 day using `docs/architecture/integration-framework.md` + the toy-calculator tutorial.
4. **No regressions**: full audit-suite + RTL + bun test suite + signed-release smoke continue to pass on Mac / Win / Linux / NixOS.
5. **Linear traceability**: every sub-objective in this spec has a Linear issue; status mirrored to GitHub Project #9.

### Non-goals

* Replacing Open Design (we embed, we don't fork).
* Building a generic plugin SDK for third parties (this is internal-first; if it generalizes later, that's a follow-up vision).
* Rebuilding the agent/chat/multi-tenant storage core — those are existing surfaces this work integrates with.
* PWA / browser-tab version of integrations — desktop Electron is the target.

---

## Section 6 — Test Plan (vision-level; per-task test plan in writing-plans phase)

* **Visual**: Playwright + visual-regression snapshots for design panel; manual maintainer + design-lead review per PR touching G1 1.1.
* **Interaction**: Playwright recorded flows for keyboard-only; manual SR testing on VoiceOver/NVDA/Narrator (rotated).
* **Navigation**: Playwright roundtrip tests for deep-link → state restoration.
* **Error UX**: synthetic failure injection (kill sidecar; cut network; corrupt payload); recorded UX response.
* **A11y**: axe-core CI gate; manual SR audit per quarter.
* **Performance**: web-vitals telemetry in dev + prod; per-platform LCP/INP/cold-start measurements.
* **Security**: per-integration audit checklist (cf. PR #268 audit framework); every new integration runs the same lane analysis (security/packaging/runtime/regression).
* **Framework**: mocked WebContentsView test infra (2.2.A); IPC contract type-level + runtime tests (2.2.B); skin snapshot tests (2.2.C); manifest validator tests (2.2.D).

---

## Section 7 — Rollback / Reversibility

* Each integration registers via feature flag — disabled flag = full removal from UI + main-process lifecycle.
* Framework itself can be rolled back (revert refactor PR 2.5) without breaking Rox Design (it would run on the pre-refactor code path, since the refactor IS the migration onto framework).
* Database/schema changes: none expected for G1; if G2 adds persistent state (e.g. integration registry), migration must have up + down (CLAUDE.md compliance).
* Telemetry/observability changes are additive; rollback removes spans, not data.

---

## Section 8 — Linear Issue Plan

* **Parent Linear issue for G1**: title "Goal 1 — Indistinguishability: native-feeling Rox Design + integrations".
* **Parent Linear issue for G2**: title "Goal 2 — Integration Constellation: framework + 2 new integrations".
* Both parents linked to PZD-41 (branch coordinator), PZD-10/35 (T271 artifacts), PZD-19 (PR #268), PZD-46 (CSP), PZD-48/49/51/65/66/67 (audit follow-ups), PZD-64 (UX PRD).
* **Week 0 sub-issues** (foundation): one each for 2.1.A, 2.1.C, 2.2.A.
* **Week 1-2 sub-issues** (quick wins): one each for 1.4.A, 1.4.D, 1.6.A, 1.1.A.
* Remaining 43 sub-objectives are listed in this doc as deferred — created on demand during writing-plans phase per Week's plan PR.

---

## Section 9 — Open Questions (to resolve during writing-plans phase)

1. **T271 timing**: does T271 land in RC8 standalone, or wait for framework? Decision sets 2.3.B vs 2.3.A path.
2. **Browser-as-tool security model**: full sandbox per session vs per-task partition? Threat model TBD with security reviewer.
3. **Cross-surface drag-and-drop protocol**: invent a new `application/x-rox-artifact` MIME or extend an existing one?
4. **Custom protocol handler scope**: `rox://` URL handler — register on macOS only first, or all 3 OS at once?
5. **Ops dashboard hosting**: integrate into existing ROX.ONE ops surface or use a separate Grafana/Sentry view?

These will be discussed and decided in the implementation plan that the `superpowers:writing-plans` skill produces next.

---

— End of design doc. Approved by user during brainstorming 2026-05-20.
