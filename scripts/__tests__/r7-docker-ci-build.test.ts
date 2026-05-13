import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, test } from "bun:test";

const repoRoot = join(import.meta.dir, "../..");

function readText(path: string): string {
  return readFileSync(path, "utf8");
}

function relativePath(path: string): string {
  return relative(repoRoot, path);
}

describe("R.7 Docker / CI / build rebrand", () => {
  test("Dockerfile.server header does not advertise the legacy rox-agent-server image tag", () => {
    const dockerfile = readText(join(repoRoot, "Dockerfile.server"));
    // The build instruction comment block must use the canonical ROX.ONE image name.
    expect(dockerfile).not.toContain("-t rox-agent-server");
    expect(dockerfile).toContain("-t rox-one-server");
  });

  test("Dockerfile.server creates the roxone system user/group instead of roxagents", () => {
    const dockerfile = readText(join(repoRoot, "Dockerfile.server"));
    // System user/group + HOME path must follow the canonical ROX.ONE naming.
    expect(dockerfile).not.toMatch(/\broxagents\b/);
    expect(dockerfile).not.toContain("/home/roxagents");
    expect(dockerfile).toMatch(/groupadd -r roxone/);
    expect(dockerfile).toMatch(/useradd -r -g roxone -m -d \/home\/roxone /);
    expect(dockerfile).toContain("USER roxone");
  });

  test("Dockerfile.server preserves the upstream attribution URL (legal-preserve)", () => {
    const dockerfile = readText(join(repoRoot, "Dockerfile.server"));
    expect(dockerfile).toContain(
      'org.opencontainers.image.source="https://github.com/lukilabs/rox-agents-oss"',
    );
  });

  test("no GitHub Actions workflow uses 'Rox' in a job or step name", () => {
    const workflowsDir = join(repoRoot, ".github/workflows");
    const offenders: string[] = [];
    for (const entry of readdirSync(workflowsDir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".yml")) continue;
      const fullPath = join(workflowsDir, entry.name);
      const lines = readText(fullPath).split(/\r?\n/);
      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        // Match `name: ...` keys at any indentation. Catches `Rox`,
        // `rox-agent`, `Rox Agents`, etc. inside the value.
        const nameMatch = line.match(/^\s*name:\s*(.+?)\s*$/);
        if (!nameMatch) continue;
        const value = nameMatch[1];
        if (/rox-agent|Rox\b/i.test(value)) {
          offenders.push(`${relativePath(fullPath)}:${index + 1}: ${line.trim()}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  test("no GitHub Actions workflow uses a rox-agent-* artifact name", () => {
    const workflowsDir = join(repoRoot, ".github/workflows");
    const offenders: string[] = [];
    for (const entry of readdirSync(workflowsDir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".yml")) continue;
      const fullPath = join(workflowsDir, entry.name);
      const lines = readText(fullPath).split(/\r?\n/);
      for (let index = 0; index < lines.length; index += 1) {
        if (lines[index].includes("rox-agent-")) {
          offenders.push(`${relativePath(fullPath)}:${index + 1}: ${lines[index].trim()}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  test("root package.json electron:dev:logs script references the canonical ROX scope", () => {
    const pkg = JSON.parse(readText(join(repoRoot, "package.json")));
    const script: string | undefined = pkg.scripts?.["electron:dev:logs"];
    expect(script).toBeDefined();
    expect(script!).toContain("@rox-one/electron");
    expect(script!).not.toContain("@rox-agent/electron");
  });

  test("electron-builder.yml uses the canonical ROX.ONE productName and a rox-scoped appId", () => {
    const ymlPath = join(repoRoot, "apps/electron/electron-builder.yml");
    const yml = readText(ymlPath);
    // productName must be the canonical wordmark.
    expect(yml).toMatch(/^productName:\s*ROX\.ONE\s*$/m);
    // appId must be a rox-namespaced reverse-DNS identifier (no rox/agent residue).
    const appIdMatch = yml.match(/^appId:\s*(\S+)\s*$/m);
    expect(appIdMatch).not.toBeNull();
    const appId = appIdMatch![1];
    expect(appId).not.toMatch(/rox|agent/i);
    expect(appId).toMatch(/(?:^|\.)rox(?:\.|$)/i);
  });
});
