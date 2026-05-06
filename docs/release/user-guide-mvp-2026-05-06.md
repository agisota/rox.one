# ROX ONE Agent Workbench - MVP User Guide

Date: 2026-05-06

## 1. What This App Is

ROX ONE Agent Workbench is a Russian-first desktop workbench for turning rough
ideas into structured prompts, specs, tasks, reviews, and long-running
agent-style missions.

The core loop:

```text
Idea
  -> Improve prompt
  -> Build spec
  -> Create TDD plan
  -> Review / verify
  -> Run mission
  -> inspect artifacts and metrics
```

## 2. Main Areas

```text
Sidebar
  -> Sessions
  -> Labels
  -> Sources
  -> Skills
  -> Agents
  -> Experience
  -> Settings
```

Workbench actions:

```text
Improve prompt
TDD Plan
Check
Break down
Build spec
Review
```

Experience screens:

```text
Long Missions
Agent Arena
Mission Control
Progression
Quest Map
Agent Forge
```

## 3. ROX ID / Account

Open:

```text
Settings -> Personal Account
```

Registration flow:

```text
Enter display name, email, password
  -> click Create account
  -> app shows pending verification
  -> verify email externally when provider is connected
  -> return to Sign in
  -> app stores the authenticated session securely
```

Important:

- registration is not the same as sign-in;
- a pending verification state is expected after registration;
- the app must not show "authenticated" until the account session is confirmed;
- session persistence is local and encrypted in the Electron main process.

## 4. Prompt-To-Spec Flow

Use this when the input is a rough idea:

```text
Paste rough prompt
  -> Improve prompt
  -> inspect improved result
  -> Send to Spec
  -> select requirements
  -> export / start agent plan
```

The best prompt should include:

- objective;
- context;
- constraints;
- desired deliverables;
- verification criteria;
- depth/style/audience requirements.

## 5. TDD Plan Flow

Use this before implementation:

```text
Prompt or spec
  -> TDD Plan
  -> RED: write failing tests first
  -> GREEN: minimal implementation
  -> VERIFY: relevant broad checks
  -> WORKLOG: evidence and acceptance matrix
```

TDD Plan is a workflow artifact, not a promise that implementation already
happened.

## 6. Review Gate Flow

Use Review Gate before accepting a deliverable:

```text
Artifact / prompt / spec / implementation
  -> Review
  -> fact check
  -> logic check
  -> security check
  -> risk/fix plan
```

Review findings should include severity, category, description, and fix action.

## 7. Long Missions

Open:

```text
Experience -> Long Missions
```

Presets:

```text
6h Sprint
24h Deep Run
72h Watchtower
```

Mission lifecycle:

```text
Draft
  -> Launch
  -> checkpoints
  -> interim artifacts
  -> final verification
```

Mission completion requires evidence. A mission does not succeed just because
time passed.

## 8. Mission Control

Open:

```text
Experience -> Mission Control
```

Use this screen to inspect:

- checkpoint timeline;
- validation gates;
- human approvals;
- interim artifacts;
- swarm feed;
- audit and billing trace.

Blocking states are expected when budget, approval, evidence, or validation
requirements are missing.

## 9. Progression

Open:

```text
Experience -> Progression
```

Main metric:

```text
Verified Deliverable Index (VDI)
```

Supporting metrics:

```text
Quality Score
Execution Readiness
Cost Efficiency
Open Risk Score
Noise Score
Swarm Capacity
```

Paid capacity can increase slots/duration/budget. It cannot directly increase
VDI, Quality Score, or evidence-backed progress.

## 10. Quest Map

Open:

```text
Experience -> Quest Map
```

Quests unlock from evidence:

```text
artifact evidence + gate evidence
  -> quest progress
  -> reward/unlock
```

Clicking a quest does not complete it without evidence.

## 11. Agent Forge

Open:

```text
Experience -> Agent Forge
```

Use this screen to inspect private/team packages and trust checks before
installing or forking an agent package.

Packages without contracts or with unresolved trust warnings can be blocked.

## 12. Sharing

Session sharing uses a provider contract:

```text
session bundle
  -> sanitizer
  -> share provider
  -> public shortlink
```

If sharing fails, check:

- account auth state;
- provider availability;
- whether the provider returned a valid public URL;
- whether the payload was rejected for safety.

The app must not fabricate a local-only URL and present it as public.
