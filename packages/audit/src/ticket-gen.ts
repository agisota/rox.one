import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";
import type { Finding } from "./probe.ts";

export interface GenerateTicketsInput {
  repoRoot: string;
  findings: Finding[];
  topK: number;
}

interface TicketFrontmatter {
  findingId: string;
  probe: string;
  surface: string;
  rule: string;
  severity: string;
  firstSeen: string;
  lastSeen: string;
  status: "open" | "auto-resolved";
}

const RE_TICKET = /^T(\d+)-/;

function highestExistingTicketNumber(ticketsDir: string): number {
  if (!existsSync(ticketsDir)) return 0;
  let max = 0;
  for (const name of readdirSync(ticketsDir)) {
    const m = name.match(RE_TICKET);
    if (m) max = Math.max(max, parseInt(m[1]!, 10));
  }
  return max;
}

function findingsByExistingTicket(ticketsDir: string): Map<string, string> {
  // Map findingId → existing filename
  const out = new Map<string, string>();
  if (!existsSync(ticketsDir)) return out;
  for (const name of readdirSync(ticketsDir)) {
    if (!RE_TICKET.test(name)) continue;
    try {
      const content = readFileSync(join(ticketsDir, name), "utf-8");
      const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (!fmMatch) continue;
      const fm = yaml.load(fmMatch[1]!) as TicketFrontmatter | null;
      if (fm?.findingId) out.set(fm.findingId, name);
    } catch {
      // skip malformed
    }
  }
  return out;
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60) || "finding";
}

function atomicWrite(path: string, content: string): void {
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, content);
  renameSync(tmp, path);
}

function ticketBody(f: Finding): string {
  return `# ${f.rule} — ${f.surface} — ${f.location.file}${f.location.line ? `:${f.location.line}` : ""}

## Summary

${f.message}

Detected by probe **\`${f.probe}\`** at \`${f.location.file}${f.location.line ? `:${f.location.line}` : ""}\`. Severity **${f.severity}**, confidence **${f.confidence}**.

## Acceptance Criteria

- [ ] Defect at \`${f.location.file}\` no longer reported by \`${f.probe}\` on next audit run.
- [ ] Tests covering this code path remain green.
- [ ] No new defects of the same rule (\`${f.rule}\`) introduced elsewhere.

## TDD Test Shape

Per AGENTS.md, write a test that demonstrates the defect first. For \`${f.rule}\`, the existing test fixtures or a new targeted unit test should fail before the fix and pass after.

## Files Affected

- \`${f.location.file}\`
${f.suggestedFix ? `\n## Suggested Fix\n\n${f.suggestedFix}\n` : ""}
`;
}

export async function generateTickets(input: GenerateTicketsInput): Promise<{ created: number; updated: number; resolved: number }> {
  const ticketsDir = join(input.repoRoot, "docs", "tickets");
  mkdirSync(ticketsDir, { recursive: true });

  const top = input.findings.slice(0, input.topK);
  const existing = findingsByExistingTicket(ticketsDir);
  let nextNum = highestExistingTicketNumber(ticketsDir) + 1;

  let created = 0;
  let updated = 0;
  let resolved = 0;

  // Create new tickets / update existing ones for top-K findings
  const seenIds = new Set<string>();
  for (const f of top) {
    seenIds.add(f.id);
    const existingName = existing.get(f.id);
    const fm: TicketFrontmatter = {
      findingId: f.id,
      probe: f.probe,
      surface: f.surface,
      rule: f.rule,
      severity: f.severity,
      firstSeen: f.firstSeen,
      lastSeen: f.lastSeen,
      status: "open",
    };
    const yamlFm = yaml.dump(fm);
    const fullContent = `---\n${yamlFm}---\n\n${ticketBody(f)}`;

    if (existingName) {
      atomicWrite(join(ticketsDir, existingName), fullContent);
      updated++;
    } else {
      const filename = `T${String(nextNum).padStart(3, "0")}-${slugify(`${f.probe}-${f.rule}-${f.surface}-${f.location.file.split("/").pop()}`)}.md`;
      atomicWrite(join(ticketsDir, filename), fullContent);
      nextNum++;
      created++;
    }
  }

  // Mark tickets whose finding disappeared as auto-resolved
  for (const [findingId, filename] of existing.entries()) {
    if (seenIds.has(findingId)) continue;
    const path = join(ticketsDir, filename);
    const content = readFileSync(path, "utf-8");
    if (content.includes("status: auto-resolved")) continue; // already resolved
    const updatedContent = content.replace(/status:\s*open/, "status: auto-resolved");
    if (updatedContent !== content) {
      atomicWrite(path, updatedContent);
      resolved++;
    }
  }

  return { created, updated, resolved };
}
