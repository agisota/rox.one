/**
 * Validates that CI workflows have the correct permission scopes.
 *
 * Regression guard for:
 *   - gitleaks-action 403: gitleaks job must have pull-requests:read permission
 *     so the action can call /pulls/{n}/commits to enumerate PR commits.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

const repoRoot = join(import.meta.dir, "../..");
const workflowsDir = join(repoRoot, ".github/workflows");

function readWorkflow(name: string): string {
  return readFileSync(join(workflowsDir, name), "utf8");
}

function workflowFiles(): string[] {
  return readdirSync(workflowsDir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(".yml"))
    .map((e) => e.name);
}

describe("workflow permissions", () => {
  test("secret-scan.yml gitleaks job has pull-requests:read permission", () => {
    const src = readWorkflow("secret-scan.yml");

    // The permission must appear either at workflow level or scoped to the job.
    // We check both by looking for `pull-requests: read` anywhere in the file.
    expect(src).toContain("pull-requests: read");
  });

  test("no workflow grants pull-requests: write without justification comment", () => {
    // Sanity guard: pull-requests:write is a privilege escalation risk.
    // If this test fails, add a justification comment adjacent to the permission.
    const offenders: string[] = [];
    for (const name of workflowFiles()) {
      const lines = readWorkflow(name).split(/\r?\n/);
      for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
        if (/pull-requests:\s*write/.test(line)) {
          // Allow if the previous or next line contains a justification comment
          const prev = lines[i - 1] ?? "";
          const next = lines[i + 1] ?? "";
          const hasJustification = /^\s*#/.test(prev) || /^\s*#/.test(next);
          if (!hasJustification) {
            offenders.push(`${name}:${i + 1}: ${line.trim()}`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
