import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, test } from "bun:test";

const repoRoot = join(import.meta.dir, "../..");

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function relPath(path: string): string {
  return relative(repoRoot, path);
}

function git(args: string[]): string {
  return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" }).trim();
}

/**
 * R.10 — permanent `validate:rebrand` gate.
 *
 * Asserts that future regressions of the rebrand are caught at two enforcement
 * points: the local pre-push git hook (husky v9 layout) and the CI matrix
 * (GitHub Actions). The gate command is `bun run validate:rebrand`, which
 * shells out to `scripts/validate-rebrand.cjs` and exits non-zero if any
 * forbidden legacy-brand token appears outside the curated allowlist.
 */
describe("R.10 permanent validate:rebrand gate", () => {
  test("husky pre-push hook exists at .husky/pre-push", () => {
    const hookPath = join(repoRoot, ".husky/pre-push");
    expect(existsSync(hookPath)).toBe(true);
  });

  test("husky pre-push hook has executable mode bits", () => {
    const hookPath = join(repoRoot, ".husky/pre-push");
    if (!existsSync(hookPath)) {
      throw new Error(`pre-push hook missing at ${relPath(hookPath)}`);
    }
    const mode = statSync(hookPath).mode;
    // owner-execute bit must be set; husky v9 spawns the hook via `sh -e`
    // through the `_/` dispatcher, so the user-shim must be executable for
    // operators who invoke it directly and for husky's `sh -e <path>` call.
    expect((mode & 0o100) !== 0).toBe(true);
  });

  test("husky pre-push hook invokes `bun run validate:rebrand`", () => {
    const hookPath = join(repoRoot, ".husky/pre-push");
    const contents = existsSync(hookPath) ? read(hookPath) : "";
    expect(contents).toContain("bun run validate:rebrand");
  });

  test("at least one .github/workflows/*.yml step runs `bun run validate:rebrand`", () => {
    const workflowsDir = join(repoRoot, ".github/workflows");
    const fs = require("node:fs") as typeof import("node:fs");
    const matches: string[] = [];
    for (const entry of fs.readdirSync(workflowsDir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".yml")) continue;
      const fullPath = join(workflowsDir, entry.name);
      const text = read(fullPath);
      if (text.includes("bun run validate:rebrand")) {
        matches.push(relPath(fullPath));
      }
    }
    expect(matches.length).toBeGreaterThan(0);
  });

  test("closeout mapping records concrete R.10 follow-up commit evidence", () => {
    const mapping = read(join(repoRoot, "docs/release/rebrand-mapping-2026-05-13.md"));
    const t296Worklog = read(join(repoRoot, "docs/worklog/T296-rebrand-sweep-closeout.md"));
    const t321Commit = git([
      "log",
      "-1",
      "--format=%h",
      "--",
      "docs/tickets/T321-roadmap-coherence-validator-repair.md",
    ]);

    expect(mapping).toContain(`| R.10 follow-up | T321 | \`${t321Commit}\` |`);
    expect(mapping).toContain("validate:roadmap OK");
    expect(mapping).not.toContain("this closeout commit");
    expect(t296Worklog).not.toContain("this closeout commit");
  });

  test("closeout mapping records the current roadmap validator evidence", () => {
    const mapping = read(join(repoRoot, "docs/release/rebrand-mapping-2026-05-13.md"));
    const roadmapOutput = execFileSync("node", ["scripts/validate-roadmap-coherence.cjs"], {
      cwd: repoRoot,
      encoding: "utf8",
    }).trim();

    expect(mapping).toContain(roadmapOutput);
    expect(mapping).toContain("T439");
    expect(mapping).not.toContain("46 phases, 111 tickets across detail files");
    expect(mapping).toMatch(/\| R\.11 \| T298 \| `[0-9a-f]{7,40}` \|/);
    expect(mapping).toContain("Post-rewrite R.11 closeout");
    expect(mapping).not.toContain("BLOCKED - pending destructive rewrite closeout SHA");
  });
});
