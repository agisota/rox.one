import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

const repoRoot = join(import.meta.dir, "../..");
const legacyStem = "cr" + "aft";
const legacyCli = `${legacyStem}-cli`;
const legacyRepo = `${legacyStem}-agents-oss`;
const legacyProduct = "Rox" + " Agent";
const legacyProductPlural = `${legacyProduct}s`;
const legacyAgentClass = "Rox" + "Agent";
const legacyPackageScope = `@${legacyStem}-agent`;
const upstreamRepoUrl = `https://github.com/lukilabs/${legacyRepo}`;
const spokenWordmark = ["ROX", "ONE"].join(" ");

function readText(path: string): string {
  return readFileSync(join(repoRoot, path), "utf8");
}

function section(body: string, heading: string): string {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = body.match(new RegExp(`^## ${escaped}\\n([\\s\\S]*?)(?=^## |\\z)`, "m"));
  return match?.[1] ?? "";
}

describe("R.4 documentation rebrand cleanup", () => {
  test("rewrites README and contributing setup docs to ROX.ONE naming", () => {
    const readme = readText("README.md");
    const contributing = readText("CONTRIBUTING.md");

    expect(readme).toContain("git clone https://github.com/agisota/rox-one-terminal.git");
    expect(readme).toContain("cd rox-one-terminal");
    expect(readme).not.toContain(`git clone ${upstreamRepoUrl}.git`);
    expect(readme).not.toContain(`cd ${legacyRepo}`);

    const acknowledgements = section(readme, "Acknowledgements");
    expect(acknowledgements).toContain(upstreamRepoUrl);

    expect(readme).toContain('alias rox-cli="bun run $(pwd)/apps/cli/src/index.ts"');
    expect(readme).not.toContain(`alias ${legacyCli}=`);
    expect(readme).not.toContain(`${legacyCli} ping`);
    expect(readme).toContain("rox-cli ping");

    expect(readme).toContain("rox-one-terminal/");
    expect(readme).not.toContain(`${legacyStem}-agent/`);

    expect(contributing).toContain("git clone https://github.com/agisota/rox-one-terminal.git");
    expect(contributing).toContain("cd rox-one-terminal");
    expect(contributing).not.toContain(`git clone ${upstreamRepoUrl}.git`);
    expect(contributing).not.toContain(`cd ${legacyRepo}`);
    expect(contributing).toContain("rox-one-terminal/");
    expect(contributing).toContain("@rox-one/core");
    expect(contributing).not.toContain(`${legacyPackageScope}/`);
  });

  test("rewrites security and conduct policy docs to ROX.ONE contacts and scope", () => {
    const codeOfConduct = readText("CODE_OF_CONDUCT.md");
    const security = readText("SECURITY.md");

    expect(codeOfConduct).toContain("conduct@rox.one");
    expect(codeOfConduct).not.toContain("legal@rox.one");

    expect(security).toContain("security@rox.one");
    expect(security).toContain("@rox-one/*");
    expect(security).not.toContain(`${legacyPackageScope}/*`);
  });

  test("rewrites plan and snapshot orientation docs to current ROX.ONE state", () => {
    const plan = readText("plan.md");
    const snapshot = readText("snapshot.md");

    expect(plan).toContain("Successor goal: this rebrand sweep (R.0-R.10) and the end-to-end spine roadmap.");
    expect(plan).toContain("docs/superpowers/goals/2026-05-13-rox-one-v1-end-to-end-spine-goal.md");
    expect(plan).toContain("ROX.ONE Agent Workbench Suite");
    expect(plan).not.toContain(`${spokenWordmark} Agent Workbench Suite`);
    expect(plan).not.toContain(`A white-label ${legacyProductPlural} fork`);
    expect(plan).toContain(`upstream ${legacyProductPlural} OSS`);

    expect(snapshot).toContain("Date: 2026-05-13");
    expect(snapshot).toContain("Historical note:");
    expect(snapshot).toContain("ROX.ONE / Agent Workbench Suite fork");
    expect(snapshot).not.toContain(spokenWordmark);
    expect(snapshot).not.toContain(`structurally ${legacyProductPlural}`);
    expect(snapshot).not.toContain("Rox" + " permission modes");
    expect(snapshot).toContain(upstreamRepoUrl);
  });

  test("rewrites Electron README paths and ADR index rebrand references", () => {
    const electronReadme = readText("apps/electron/README.md");
    const adrIndex = readText("docs/decision-records/audit-harness/README.md");
    const adr0005 = readText("docs/decision-records/audit-harness/0005-storage-tenancy-contract.md");

    expect(electronReadme).toContain("# ROX.ONE Electron App");
    expect(electronReadme).not.toContain(spokenWordmark);
    expect(electronReadme).not.toContain(`${legacyProduct} workspaces`);
    expect(electronReadme).not.toContain(legacyAgentClass);
    expect(electronReadme).not.toContain(`Dev_${legacyStem[0].toUpperCase()}${legacyStem.slice(1)}_Agents`);
    expect(electronReadme).not.toContain(`${legacyStem[0].toUpperCase()}${legacyStem.slice(1)} documents`);
    expect(electronReadme).toContain("ClaudeAgent");
    expect(electronReadme).toContain("ROX.ONE workspaces");
    expect(electronReadme).toContain("~/.rox/logs/electron/main.log");

    expect(adrIndex).toContain("0011");
    expect(adrIndex).toContain("0011-rox-one-rebrand-canonical-tokens.md");
    expect(adr0005).not.toContain(legacyProductPlural);
  });
});
