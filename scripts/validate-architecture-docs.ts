#!/usr/bin/env bun
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();

const requiredDocs = [
  "docs/architecture/repo-map.md",
  "docs/architecture/extension-points.md",
  "docs/architecture/test-harness-map.md",
  "docs/worklog/T001-repo-cartography.md",
];

const requiredHeadings = [
  "UI",
  "Server",
  "Workspaces",
  "Skills",
  "Automations",
  "Permissions",
  "Labels",
  "Remote Server",
  "Tests",
  "Build",
];

function fail(message: string): never {
  console.error(`[architecture-docs] ${message}`);
  process.exit(1);
}

for (const docPath of requiredDocs) {
  const absolutePath = path.join(root, docPath);
  if (!existsSync(absolutePath)) {
    fail(`missing required file: ${docPath}`);
  }
}

const docsWithSubsystemMaps = requiredDocs.slice(0, 3);
for (const docPath of docsWithSubsystemMaps) {
  const content = readFileSync(path.join(root, docPath), "utf8");
  for (const heading of requiredHeadings) {
    const headingPattern = new RegExp(`^#{1,4}\\s+${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "m");
    if (!headingPattern.test(content)) {
      fail(`${docPath} missing heading: ${heading}`);
    }
  }
}

const worklog = readFileSync(path.join(root, "docs/worklog/T001-repo-cartography.md"), "utf8");
for (const phrase of [
  "Task summary",
  "Repo context discovered",
  "Files inspected",
  "Validation commands run",
  "Acceptance criteria matrix",
]) {
  if (!worklog.includes(phrase)) {
    fail(`worklog missing section: ${phrase}`);
  }
}

console.log(`[architecture-docs] ok: ${requiredDocs.length} docs, ${requiredHeadings.length} subsystem headings`);
