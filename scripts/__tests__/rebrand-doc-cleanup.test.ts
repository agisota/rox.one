import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

const repoRoot = join(import.meta.dir, "../..");
const legacyStem = "cr" + "aft";
const legacyCli = `${legacyStem}-cli`;
const legacyRepo = `${legacyStem}-agents-oss`;
const legacyPackageScope = `@${legacyStem}-agent`;
const upstreamRepoUrl = `https://github.com/lukilabs/${legacyRepo}`;

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
});
