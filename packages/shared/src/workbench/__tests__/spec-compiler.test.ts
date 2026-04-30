import { describe, expect, it } from "bun:test";

import {
  WorkbenchSpecSchema,
  compileWorkbenchSpec,
  createMemorySpecArtifactStore,
  exportWorkbenchSpec,
  saveCompiledWorkbenchSpec,
} from "../spec-compiler";

describe("WorkbenchSpecSchema", () => {
  it("requires the executable spec contract", () => {
    const valid = WorkbenchSpecSchema.safeParse({
      title: "Launch agent workbench MVP",
      role: "AI product architect",
      objective: "Ship a validated MVP plan",
      context: ["White-label Rox Agents fork"],
      assumptions: ["Existing workbench option graph is available"],
      constraints: ["No real LLM calls in tests"],
      deliverables: ["PRD", "TASKS.md"],
      acceptanceCriteria: ["Compiler output is deterministic"],
      implementationTasks: [
        {
          id: "T001",
          title: "Create compiler",
          description: "Compile selected options into a durable spec",
          acceptanceCriteria: ["Exports Markdown"],
          validationGates: ["schema"],
        },
      ],
      validationPlan: [
        {
          gateId: "schema",
          required: true,
          evidence: "Spec parses with WorkbenchSpecSchema",
        },
      ],
      risks: [
        {
          severity: "medium",
          risk: "Preview and export can drift",
          mitigation: "Use shared compiler as source of truth",
        },
      ],
      openQuestions: ["Which UI owns export wiring?"],
      outputFormat: "markdown",
    });

    expect(valid.success).toBe(true);
    expect(
      WorkbenchSpecSchema.safeParse({ ...valid.data, title: "" }).success,
    ).toBe(false);
    expect(
      WorkbenchSpecSchema.safeParse({ ...valid.data, deliverables: [] }).success,
    ).toBe(false);
  });
});

describe("compileWorkbenchSpec", () => {
  it("compiles selected options into deterministic metadata and spec fields", () => {
    const compiled = compileWorkbenchSpec({
      rawInput: "Research the Agent Workbench market and produce an executive launch spec.",
      modeId: "spec",
      permissionMode: "ask",
      selectedOptionIds: [
        "output:prd",
        "research:research-grade",
        "sources:primary-sources",
        "audience:executive",
        "tdd:test-first",
      ],
      createdAt: "2026-04-30T10:00:00.000Z",
    });

    expect(compiled.metadata).toEqual({
      artifactId: "spec-2026-04-30T10-00-00-000Z-spec",
      artifactType: "spec",
      createdAt: "2026-04-30T10:00:00.000Z",
      mode: "spec",
      labels: ["mode::spec", "artifact::spec"],
      validationGates: [
        "schema",
        "logic_check",
        "brand_check",
        "fact_check",
        "unit_tests",
        "integration_tests",
        "ui_tests",
        "e2e_tests",
      ],
    });
    expect(compiled.spec.title).toBe("Research the Agent Workbench market and produce an executive launch spec");
    expect(compiled.spec.deliverables).toContain("PRD");
    expect(compiled.spec.deliverables).toContain("Executive summary");
    expect(compiled.spec.validationPlan.map((gate) => gate.gateId)).toContain("fact_check");
    expect(compiled.spec.implementationTasks.some((task) => task.id === "TDD-001")).toBe(true);
  });

  it("fails cleanly when selected options violate dependency rules", () => {
    expect(() =>
      compileWorkbenchSpec({
        rawInput: "Write a short research note.",
        modeId: "research",
        permissionMode: "ask",
        selectedOptionIds: ["sources:primary-sources"],
        createdAt: "2026-04-30T10:00:00.000Z",
      }),
    ).toThrow(/requires research:research-grade/);
  });
});

describe("exportWorkbenchSpec", () => {
  const compiled = compileWorkbenchSpec({
    rawInput: "Build a mode registry with tests.",
    modeId: "tdd",
    permissionMode: "ask",
    selectedOptionIds: ["output:task-pack", "tdd:test-first"],
    createdAt: "2026-04-30T11:00:00.000Z",
  });

  it("exports stable Markdown, JSON, YAML, and TASKS.md", () => {
    expect(exportWorkbenchSpec(compiled, "markdown")).toMatchInlineSnapshot(`
"# Build a mode registry with tests

## Role
TDD release engineer

## Objective
Turn the user request into an executable tdd artifact with testable deliverables.

## Context
- Build a mode registry with tests.
- Mode: tdd
- Selected options: TASKS.md backlog, Test-first execution

## Assumptions
- The selected option graph is the authoritative requirement source.
- Implementation will use fake providers or adapters in tests where external systems would otherwise be required.

## Constraints
- Preserve existing Rox Agents behavior unless the selected spec explicitly changes it.
- No real LLM, browser, storage, billing, or cloud calls are required for compiler tests.

## Deliverables
- TASKS.md
- Test plan

## Acceptance Criteria
- Compiled spec validates against WorkbenchSpecSchema.
- Export output is deterministic for the same input.
- TASKS.md contains implementation tasks with acceptance criteria.
- Tests are written before implementation.

## Implementation Tasks
### TDD-001 - Write failing tests first
Add unit/integration/UI/E2E/security tests required by the selected validation gates before implementation.
Acceptance criteria:
- Targeted tests fail for the expected missing implementation reason.
Validation gates: unit_tests, integration_tests, ui_tests, e2e_tests

### BUILD-001 - Implement selected deliverables
Implement the minimum product changes required by the compiled spec.
Acceptance criteria:
- Deliverables are present and wired to the selected mode.
Validation gates: schema

### VERIFY-001 - Run validation gates
Run every required validation gate and collect evidence for the worklog.
Acceptance criteria:
- Blocking validation gates pass.
Validation gates: unit_tests, integration_tests, ui_tests, e2e_tests

## Validation Plan
- unit_tests (required): Unit tests cover pure compiler and mode logic.
- integration_tests (required): Integration tests cover adapters, stores, and service boundaries.
- ui_tests (required): UI/component tests cover visible state and interactions when UI is changed.
- e2e_tests (required): E2E/smoke tests cover user-visible workflow changes.

## Risks
- Medium: Compiled output can drift from UI preview if another formatter is introduced.
  Mitigation: Keep shared compiler as the single export source of truth.
- Medium: Selected options may imply integrations that are not implemented yet.
  Mitigation: Emit explicit validation gates and implementation tasks instead of silently claiming support.

## Open Questions
- Which workspace/session persistence adapter should own durable storage for this artifact?
"
`);

    expect(JSON.parse(exportWorkbenchSpec(compiled, "json")).metadata.artifactId).toBe(
      "spec-2026-04-30T11-00-00-000Z-tdd",
    );
    expect(exportWorkbenchSpec(compiled, "yaml")).toContain("mode: tdd");
    expect(exportWorkbenchSpec(compiled, "tasks_markdown")).toContain("# TASKS - Build a mode registry with tests");
  });
});

describe("spec artifact persistence adapter", () => {
  it("saves exported specs through a fake artifact store", async () => {
    const store = createMemorySpecArtifactStore();
    const compiled = compileWorkbenchSpec({
      rawInput: "Create a deterministic export layer.",
      modeId: "spec",
      permissionMode: "ask",
      selectedOptionIds: ["output:prd"],
      createdAt: "2026-04-30T12:00:00.000Z",
    });

    const ref = await saveCompiledWorkbenchSpec(store, compiled, "markdown");

    expect(ref).toEqual({
      artifactId: "spec-2026-04-30T12-00-00-000Z-spec",
      artifactType: "spec",
      title: "Create a deterministic export layer",
      format: "markdown",
    });
    expect(store.listArtifacts()).toHaveLength(1);
    expect(store.getArtifact(ref.artifactId)?.content).toContain("# Create a deterministic export layer");
  });
});
