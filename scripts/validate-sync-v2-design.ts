import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = process.cwd();
const designPath = join(repoRoot, "docs", "architecture", "sync-v2-design.md");

const requiredSections = [
  "# Sync V2 Design",
  "## Goals",
  "## Non-Goals",
  "## Sync Model",
  "## Snapshot Model",
  "## Operation Log",
  "## Conflict Detection",
  "## Deletions And Tombstones",
  "## Rename Handling",
  "## Failure And Retry",
  "## Security And Tenant Isolation",
  "## Quotas And Storage",
  "## API Boundaries",
  "## Migration From MVP",
  "## Test Plan",
];

const requiredPhrases = [
  "no transparent sync",
  "explicit push",
  "explicit pull",
  "base snapshot",
  "tombstone",
  "no silent overwrite",
  "tenant",
  "quota",
  "object storage",
  "idempotency",
  "conflict",
];

function fail(message: string): never {
  console.error(`[sync-v2-design] ${message}`);
  process.exit(1);
}

if (!existsSync(designPath)) {
  fail(`missing required file: ${designPath}`);
}

const markdown = readFileSync(designPath, "utf8");
const lowerMarkdown = markdown.toLowerCase();

for (const section of requiredSections) {
  const pattern = new RegExp(`^${section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "m");
  if (!pattern.test(markdown)) {
    fail(`missing section: ${section}`);
  }
}

for (const phrase of requiredPhrases) {
  if (!lowerMarkdown.includes(phrase)) {
    fail(`missing required phrase: ${phrase}`);
  }
}

console.log(`[sync-v2-design] validated ${designPath}`);
