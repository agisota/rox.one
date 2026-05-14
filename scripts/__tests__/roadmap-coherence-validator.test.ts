import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

const repoRoot = join(import.meta.dir, "../..");

function runValidatorWithRoadmapLog(
  roadmapLog: string,
  extraEnv: Record<string, string> = {},
) {
  const tempDir = mkdtempSync(join(tmpdir(), "rox-roadmap-log-"));
  const roadmapLogPath = join(tempDir, "master-roadmap-log.md");
  writeFileSync(roadmapLogPath, roadmapLog);

  return spawnSync("node", ["scripts/validate-roadmap-coherence.cjs"], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      ROX_ROADMAP_LOG_PATH: roadmapLogPath,
      ...extraEnv,
    },
  });
}

describe("roadmap coherence validator", () => {
  test("accepts the current spine, master-roadmap, and rebrand detail files", () => {
    const result = spawnSync("node", ["scripts/validate-roadmap-coherence.cjs"], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    const output = `${result.stdout}\n${result.stderr}`;

    expect(result.status, output).toBe(0);
    expect(result.stdout).toContain("validate:roadmap OK");
  });

  test("rejects rebrand roadmap log rows that reference missing ticket artifacts", () => {
    const roadmapLog = readFileSync(
      join(repoRoot, ".swarm", "master-roadmap-log.md"),
      "utf8",
    );
    const result = runValidatorWithRoadmapLog(
      roadmapLog.replace(
        "rebrand-R.9.5-allowlist-and-final-text | b8d6abd | T298a,T300a |",
        "rebrand-R.9.5-allowlist-and-final-text | b8d6abd | T298a,T299a,T300a |",
      ),
    );
    const output = `${result.stdout}\n${result.stderr}`;

    expect(result.status, output).toBe(1);
    expect(output).toContain("T299a");
    expect(output).toContain("has no matching ticket file");
  });

  test("rejects rebrand roadmap log rows that reference missing worklog artifacts", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "rox-roadmap-worklog-"));
    const emptyWorklogDir = join(tempDir, "worklog");
    mkdirSync(emptyWorklogDir);
    const roadmapLog = readFileSync(
      join(repoRoot, ".swarm", "master-roadmap-log.md"),
      "utf8",
    );
    const result = runValidatorWithRoadmapLog(
      roadmapLog.replace(
        "rebrand-R.9.5-allowlist-and-final-text | b8d6abd | T298a,T300a |",
        "rebrand-R.9.5-allowlist-and-final-text | b8d6abd | T298a |",
      ),
      { ROX_ROADMAP_WORKLOG_DIR: emptyWorklogDir },
    );
    const output = `${result.stdout}\n${result.stderr}`;

    expect(result.status, output).toBe(1);
    expect(output).toContain("T298a");
    expect(output).toContain("has no matching worklog file");
  });
});
