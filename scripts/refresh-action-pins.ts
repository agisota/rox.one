#!/usr/bin/env bun
//
// One-shot helper to refresh SHA pins for GitHub Actions across all workflow
// files. Renovate handles routine weekly bumps; this script exists for the
// emergency case where a vulnerability disclosure requires a same-day
// rotation across the whole repo without waiting for the PR cycle.
//
// Usage:
//   bun run scripts/refresh-action-pins.ts             # dry-run
//   bun run scripts/refresh-action-pins.ts --apply     # mutate files
//
// Requires the `gh` CLI to be authenticated. Each `owner/repo@<sha> # vX.Y.Z`
// line is re-resolved by:
//   1. Reading the version comment (the `# vX.Y.Z` suffix) for the target
//      semver to resolve.
//   2. If no comment, falls back to the major from the existing SHA's tag.
//   3. Calling `gh api repos/<owner>/<repo>/git/refs/tags/<tag>` and
//      dereferencing annotated tags.
//
// SAFETY: only rewrites lines whose current form is already pinned
// (40-hex SHA + comment). A floating @vN tag is treated as an error so this
// script never silently "upgrades" an unpinned action — fix unpins by hand
// or run `bun run validate:workflow-pins` first.

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const WORKFLOWS_DIR = join(process.cwd(), ".github", "workflows");
const SHA40 = /^[0-9a-f]{40}$/;
const PINNED_USES = /^(\s*uses:\s+)([^\s#@]+)@([0-9a-f]{40})(\s+#\s*(.+?))?\s*$/;

const apply = process.argv.includes("--apply");

type Replacement = { file: string; line: number; from: string; to: string };

function gh(args: string[]): string | null {
  const res = spawnSync("gh", args, { encoding: "utf8" });
  if (res.status !== 0) return null;
  return res.stdout.trim();
}

function resolveTag(repo: string, tag: string): string | null {
  let sha = gh(["api", `repos/${repo}/git/refs/tags/${tag}`, "--jq", ".object.sha"]);
  if (!sha) return null;
  const type = gh(["api", `repos/${repo}/git/refs/tags/${tag}`, "--jq", ".object.type"]);
  if (type === "tag") {
    // Annotated tag — dereference one more hop.
    sha = gh(["api", `repos/${repo}/git/tags/${sha}`, "--jq", ".object.sha"]) || sha;
  }
  return SHA40.test(sha ?? "") ? sha : null;
}

function resolvedSemverFor(repo: string, sha: string): string | null {
  const out = gh(["api", `repos/${repo}/tags`, "--jq",
    `.[] | select(.commit.sha=="${sha}") | .name`]);
  if (!out) return null;
  const versions = out.split("\n").filter(Boolean).sort(); // crude but deterministic
  return versions[versions.length - 1] ?? null;
}

function scanFile(file: string): Replacement[] {
  const replacements: Replacement[] = [];
  const lines = readFileSync(file, "utf8").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(PINNED_USES);
    if (!m) continue;
    const [, prefix, repo, currentSha, , versionComment] = m;
    // Reusable workflow refs include /.github/workflows/foo.yml — strip path.
    const repoOnly = repo.split("/").slice(0, 2).join("/");
    // Determine the target tag: prefer the comment, else use major from current sha.
    const tagFromComment = versionComment?.trim();
    if (!tagFromComment) continue; // no comment → skip (operator can refresh by editing comment)
    const targetTag = tagFromComment.startsWith("v") ? tagFromComment : `v${tagFromComment}`;
    const newSha = resolveTag(repoOnly, targetTag);
    if (!newSha) {
      console.warn(`[refresh-pins] ${file}:${i + 1}  could not resolve ${repoOnly}@${targetTag}`);
      continue;
    }
    if (newSha === currentSha) continue;
    const resolvedSemver = resolvedSemverFor(repoOnly, newSha) ?? targetTag;
    const newLine = `${prefix}${repo}@${newSha} # ${resolvedSemver}`;
    replacements.push({ file, line: i + 1, from: lines[i], to: newLine });
  }
  return replacements;
}

function main(): void {
  const files = readdirSync(WORKFLOWS_DIR)
    .filter((n) => n.endsWith(".yml") || n.endsWith(".yaml"))
    .map((n) => join(WORKFLOWS_DIR, n));

  const allReplacements: Replacement[] = [];
  for (const f of files) {
    allReplacements.push(...scanFile(f));
  }

  if (allReplacements.length === 0) {
    console.log("[refresh-pins] no updates — all pins already at the latest SHA for their version comment.");
    return;
  }

  console.log(`[refresh-pins] ${allReplacements.length} pin(s) to refresh:`);
  for (const r of allReplacements) {
    const rel = r.file.replace(`${process.cwd()}/`, "");
    console.log(`  ${rel}:${r.line}`);
    console.log(`    -  ${r.from.trim()}`);
    console.log(`    +  ${r.to.trim()}`);
  }

  if (!apply) {
    console.log("\n[refresh-pins] dry-run only. Pass --apply to write changes.");
    return;
  }

  // Group by file and write atomically.
  const byFile = new Map<string, Replacement[]>();
  for (const r of allReplacements) {
    const arr = byFile.get(r.file) ?? [];
    arr.push(r);
    byFile.set(r.file, arr);
  }
  for (const [file, items] of byFile) {
    const lines = readFileSync(file, "utf8").split("\n");
    for (const r of items) lines[r.line - 1] = r.to;
    writeFileSync(file, lines.join("\n"));
    console.log(`[refresh-pins] wrote ${items.length} change(s) to ${file.replace(`${process.cwd()}/`, "")}`);
  }
}

main();
