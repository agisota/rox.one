#!/usr/bin/env bun
//
// Supply-chain hardening guard: ensure every `uses:` line in any workflow
// under .github/workflows/ pins the action to a full 40-character commit SHA
// (NOT a floating @v4 / @v2 tag). Floating tags are a known compromise
// vector — a tag-move attack on a popular action ships malicious code to
// every consumer on next CI run.
//
// Failure mode is deliberately loud: print every offending file:line and
// exit non-zero so the PR is blocked at validate.yml time, not at release
// time.
//
// Permissible exceptions (local `./...` or `docker://` refs, or fully
// reusable workflow callouts) are passed through.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const WORKFLOWS_DIR = join(process.cwd(), ".github", "workflows");
const SHA40 = /^[0-9a-f]{40}$/;
// Recognise `uses: owner/repo@<ref>` and `uses: owner/repo/path@<ref>`.
// Reusable workflow callouts (`./.github/...` or `owner/repo/.github/workflows/x.yml@<ref>`)
// follow the same pinning rule.
const USES_PATTERN = /^\s*uses:\s+([^\s#@]+)@([^\s#]+)(\s+#.*)?$/;

type Offender = { file: string; line: number; raw: string; ref: string };

function listWorkflowFiles(): string[] {
  return readdirSync(WORKFLOWS_DIR)
    .filter((name) => name.endsWith(".yml") || name.endsWith(".yaml"))
    .map((name) => join(WORKFLOWS_DIR, name));
}

function isLocalRef(usesTarget: string): boolean {
  // Local action paths (`./...`) don't have a versioning concept.
  // Docker actions (`docker://...`) carry their own versioning.
  return usesTarget.startsWith("./") || usesTarget.startsWith("docker://");
}

function scanFile(file: string): Offender[] {
  const lines = readFileSync(file, "utf8").split("\n");
  const offenders: Offender[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(USES_PATTERN);
    if (!match) continue;
    const [, target, ref] = match;
    if (isLocalRef(target)) continue;
    if (!SHA40.test(ref)) {
      offenders.push({ file, line: i + 1, raw: line.trim(), ref });
    }
  }
  return offenders;
}

function main(): void {
  const files = listWorkflowFiles();
  if (files.length === 0) {
    console.warn(`[workflow-pins] no workflow files found under ${WORKFLOWS_DIR}`);
    return;
  }

  const offenders: Offender[] = [];
  for (const file of files) {
    offenders.push(...scanFile(file));
  }

  if (offenders.length === 0) {
    console.log(`[workflow-pins] OK — all ${files.length} workflow file(s) pin actions to SHA.`);
    return;
  }

  console.error(`[workflow-pins] FAIL — ${offenders.length} unpinned action reference(s):`);
  for (const o of offenders) {
    // Use the GitHub Actions ::error:: annotation format so violations surface
    // inline in PR diff view when this script runs in CI.
    const rel = o.file.replace(`${process.cwd()}/`, "");
    console.error(
      `::error file=${rel},line=${o.line}::Action must be pinned to a 40-char commit SHA, got "@${o.ref}". See SECURITY.md (Workflow action pinning).`,
    );
    console.error(`  ${rel}:${o.line}  ${o.raw}`);
  }
  console.error(
    "\nFix: replace @<floating-tag> with @<40-char-sha> and add a `# <version>` comment.\n" +
      "Example: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4.3.1",
  );
  process.exit(1);
}

main();
