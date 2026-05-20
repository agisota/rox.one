#!/usr/bin/env bun
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();

function fail(message: string): never {
  console.error(`[ci-contract] ${message}`);
  process.exit(1);
}

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

const packageJson = JSON.parse(read("package.json"));
const scripts = packageJson.scripts ?? {};
for (const scriptName of [
  "validate:agent-contract",
  "validate:docs",
  "validate:architecture-docs",
  "validate:ci-contract",
  "validate:ci",
]) {
  if (typeof scripts[scriptName] !== "string" || scripts[scriptName].length === 0) {
    fail(`package.json missing script: ${scriptName}`);
  }
}

const validateCi = scripts["validate:ci"];
for (const requiredCommand of [
  "validate:agent-contract",
  "validate:architecture-docs",
  "validate:ci-contract",
]) {
  if (!validateCi.includes(requiredCommand)) {
    fail(`validate:ci does not include ${requiredCommand}`);
  }
}

const workflow = read(".github/workflows/validate.yml");
for (const requiredText of [
  "fetch-depth: 0",
  'bun-version: "1.3.13"',
  "bun install --frozen-lockfile",
  "node node_modules/playwright/cli.js install --with-deps --only-shell chromium",
  "bun run validate:agent-contract",
  "bun run validate:architecture-docs",
  "bun run validate:ci",
  "bun run validate:workflow-pins",
  "bun test --timeout=30000 scripts/__tests__/validate-packaged-artifacts.test.ts",
  "actions/upload-artifact",
  ".ci-logs",
]) {
  if (!workflow.includes(requiredText)) {
    fail(`validate workflow missing: ${requiredText}`);
  }
}

const circleci = read(".circleci/config.yml");
for (const requiredText of [
  "bun run validate:agent-contract",
  "bun run validate:architecture-docs",
  "bun run validate:ci",
  "bun run validate:workflow-pins",
  "bun test --timeout=30000 scripts/__tests__/validate-packaged-artifacts.test.ts",
]) {
  if (!circleci.includes(requiredText)) {
    fail(`CircleCI validate job missing: ${requiredText}`);
  }
}

for (const staleCommand of [
  "bun test --timeout=30000 2>&1",
  "find . -name '*.isolated.ts'",
]) {
  if (circleci.includes(staleCommand)) {
    fail(`CircleCI validate job still includes stale broad test discovery: ${staleCommand}`);
  }
}

const requiredSkills = [
  "repo-cartographer",
  "tdd-loop",
  "ui-screen-builder",
  "agent-workflow-architect",
  "automation-designer",
  "cloud-sync-architect",
  "storage-quota-architect",
  "security-rbac-reviewer",
  "release-validator",
  "mac-arm-builder",
  "ralph-loop-controller",
];

function createFixture(corruptSkill: boolean): string {
  const fixtureRoot = mkdtempSync(path.join(tmpdir(), "agent-contract-"));
  const docs = [
    "docs/tickets/README.md",
    "docs/tickets/TEMPLATE.md",
    "docs/worklog/README.md",
    "docs/validation/README.md",
    "docs/validation/baseline-commands.md",
    "docs/worklog/T000-bootstrap-agent-os.md",
  ];

  writeFileSync(
    path.join(fixtureRoot, "AGENTS.md"),
    "# Fixture\n\n## Absolute Rules\n\n## Required Worklog Format\n\n## TDD Loop\n\n## Subagent Usage\n\n## Definition of Done\n",
  );

  for (const doc of docs) {
    mkdirSync(path.dirname(path.join(fixtureRoot, doc)), { recursive: true });
    writeFileSync(path.join(fixtureRoot, doc), `# ${doc}\n`);
  }

  for (let index = 0; index < 41; index += 1) {
    const ticketPath = path.join(fixtureRoot, "docs/tickets", `T${String(index).padStart(3, "0")}-fixture.md`);
    writeFileSync(ticketPath, `# T${String(index).padStart(3, "0")} fixture\n\nStatus: TODO\n`);
  }

  for (const skill of requiredSkills) {
    const skillPath = path.join(fixtureRoot, ".agents/skills", skill, "SKILL.md");
    mkdirSync(path.dirname(skillPath), { recursive: true });
    const frontmatter = corruptSkill && skill === "repo-cartographer"
      ? "---\nname: broken-name\ndescription: broken fixture\n---\n# Broken\n"
      : `---\nname: ${skill}\ndescription: Fixture skill for ${skill}\n---\n# ${skill}\n`;
    writeFileSync(skillPath, frontmatter);
  }

  return fixtureRoot;
}

const invalidRoot = createFixture(true);
try {
  const result = spawnSync("bun", ["run", "scripts/validate-agent-contract.ts"], {
    cwd: root,
    env: { ...process.env, AGENT_CONTRACT_ROOT: invalidRoot },
    encoding: "utf8",
  });
  if (result.status === 0) {
    fail("validate-agent-contract accepted corrupt skill fixture");
  }
  if (!`${result.stdout}\n${result.stderr}`.includes("repo-cartographer")) {
    fail("corrupt skill fixture failed without naming the broken skill");
  }
} finally {
  rmSync(invalidRoot, { recursive: true, force: true });
}

const validRoot = createFixture(false);
try {
  const result = spawnSync("bun", ["run", "scripts/validate-agent-contract.ts"], {
    cwd: root,
    env: { ...process.env, AGENT_CONTRACT_ROOT: validRoot },
    encoding: "utf8",
  });
  if (result.status !== 0) {
    fail(`validate-agent-contract rejected valid fixture: ${result.stderr || result.stdout}`);
  }
} finally {
  rmSync(validRoot, { recursive: true, force: true });
}

console.log("[ci-contract] ok: workflow, package scripts, and validator fixture checks passed");
