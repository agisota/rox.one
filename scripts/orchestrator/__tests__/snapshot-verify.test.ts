/**
 * snapshot-verify.test.ts — TDD tests for WT-00 snapshot hygiene validators.
 *
 * Spec: docs/superpowers/specs/2026-05-21-wt-00-snapshot-hygiene-design.md §13
 *
 * Six failing tests authored FIRST, then implementation satisfies them:
 *   1. snapshot-verify fails when git HEAD != base_sha
 *   2. scaffold-ownership validation fails when package.json owner is missing
 *   3. release-cuts validation fails on cyclic dependency
 *   4. gitleaks pattern detection flags fake AWS key
 *   5. bun.lock determinism check shape (lockfile present)
 *   6. CODEOWNERS coverage check across all 13 epics
 */

import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";
import {
  detectGitleaksPatterns,
  loadReleaseCuts,
  loadScaffoldOwnership,
  topologicalSortCuts,
  validateCodeownersCoverage,
  validateReleaseCuts,
  validateScaffoldOwnership,
  verifySnapshotSha,
} from "../snapshot-verify.js";

const REPO_ROOT = join(import.meta.dir, "..", "..", "..");

describe("snapshot-verify", () => {
  it("returns ok when actualSha equals baseSha", () => {
    const result = verifySnapshotSha("fac6f228069c", "fac6f228069c");
    expect(result.ok).toBe(true);
  });

  it("fails when git HEAD != base_sha", () => {
    const result = verifySnapshotSha("deadbeef", "fac6f228069c");
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("SHA mismatch");
  });

  it("accepts short-SHA prefix as match against full SHA", () => {
    const result = verifySnapshotSha("fac6f228069c", "fac6f228069cabcdef1234567");
    expect(result.ok).toBe(true);
  });
});

describe("scaffold-ownership", () => {
  it("loads scaffold-ownership.yaml from repo", () => {
    const data = loadScaffoldOwnership(REPO_ROOT);
    expect(Array.isArray(data.owners)).toBe(true);
    expect(data.owners.length).toBeGreaterThan(0);
  });

  it("contains package.json owner mapping", () => {
    const data = loadScaffoldOwnership(REPO_ROOT);
    const pkg = data.owners.find((o) => o.file === "package.json");
    expect(pkg).toBeDefined();
    expect(pkg?.owner).toBe("WT-00");
  });

  it("fails validation when package.json owner entry is missing", () => {
    const result = validateScaffoldOwnership({
      owners: [{ file: "tsconfig.json", owner: "WT-00", notes: "" }],
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("package.json"))).toBe(true);
  });

  it("passes validation when all required shared scaffolds have owners", () => {
    const data = loadScaffoldOwnership(REPO_ROOT);
    const result = validateScaffoldOwnership(data);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });
});

describe("release-cuts", () => {
  it("loads release-cuts.yaml from repo", () => {
    const data = loadReleaseCuts(REPO_ROOT);
    expect(Array.isArray(data.cuts)).toBe(true);
    expect(data.cuts.length).toBeGreaterThanOrEqual(5);
  });

  it("fails validation when foundation cut depends on a later cut", () => {
    const cyclic = {
      cuts: [
        { name: "foundation", description: "x", target_date: "2026-06-15", includes: ["data"], excludes: [] },
        { name: "data", description: "y", target_date: "2026-07-01", includes: ["foundation"], excludes: [] },
      ],
    };
    expect(() => topologicalSortCuts(cyclic)).toThrow(/cycle|cyclic/i);
  });

  it("rejects cut with unknown release-tag in includes", () => {
    const bad = {
      cuts: [
        { name: "foundation", description: "x", target_date: "2026-06-15", includes: ["nonexistent"], excludes: [] },
      ],
    };
    const result = validateReleaseCuts(bad);
    expect(result.ok).toBe(false);
  });

  it("accepts the canonical 5-cut foundation-data-ui-sharing-ai sequence", () => {
    const data = loadReleaseCuts(REPO_ROOT);
    const result = validateReleaseCuts(data);
    expect(result.ok).toBe(true);
  });
});

describe("gitleaks-pattern detection", () => {
  it("detects AWS access key pattern", () => {
    const hits = detectGitleaksPatterns("foo AKIAIOSFODNN7EXAMPLE bar");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]?.kind).toBe("aws-access-key");
  });

  it("detects GitHub personal-access-token pattern", () => {
    const hits = detectGitleaksPatterns("token=ghp_1234567890abcdefghijklmnopqrstuvwxyz12");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some((h) => h.kind === "github-pat")).toBe(true);
  });

  it("returns empty array on clean text", () => {
    const hits = detectGitleaksPatterns("just a normal commit message with no secrets");
    expect(hits).toEqual([]);
  });
});

describe("codeowners-coverage", () => {
  it("validates that CODEOWNERS covers every epic in the registry", () => {
    const codeownersPath = join(REPO_ROOT, ".github", "CODEOWNERS");
    expect(existsSync(codeownersPath)).toBe(true);
    const codeowners = readFileSync(codeownersPath, "utf8");
    const epics = [
      "foundation",
      "auth-identity",
      "notifications",
      "storage",
      "agent-runtime",
      "ui-shell",
      "sources",
      "object-platform",
      "ai-context",
      "search",
      "sharing",
      "audit",
      "release-engineering",
    ];
    const result = validateCodeownersCoverage(codeowners, epics);
    expect(result.ok).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it("flags missing epics in CODEOWNERS coverage", () => {
    const result = validateCodeownersCoverage("# only comments", ["foundation"]);
    expect(result.ok).toBe(false);
    expect(result.missing).toContain("foundation");
  });
});

describe("bun.lock determinism shape", () => {
  it("bun.lock is present in repo root (precondition for determinism check)", () => {
    expect(existsSync(join(REPO_ROOT, "bun.lock"))).toBe(true);
  });
});

describe("wt-meta yaml schemas", () => {
  it("scaffold-ownership.json schema file exists", () => {
    expect(existsSync(join(REPO_ROOT, "wt-meta", "schema", "scaffold-ownership.json"))).toBe(true);
  });

  it("release-cuts.json schema file exists", () => {
    expect(existsSync(join(REPO_ROOT, "wt-meta", "schema", "release-cuts.json"))).toBe(true);
  });

  it("scaffold-ownership.yaml parses as valid YAML", () => {
    const raw = readFileSync(join(REPO_ROOT, "wt-meta", "scaffold-ownership.yaml"), "utf8");
    const parsed = yaml.load(raw) as { owners?: unknown };
    expect(parsed).toBeDefined();
    expect(Array.isArray(parsed.owners)).toBe(true);
  });
});
