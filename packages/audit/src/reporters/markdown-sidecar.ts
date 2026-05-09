import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Finding, FindingSeverity } from "../probe.ts";

const SEVERITY_ORDER: FindingSeverity[] = ["critical", "high", "medium", "low"];

function escapeMd(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/`/g, "\\`");
}

export interface WriteMarkdownSidecarInput {
  outDir: string;
  runId: string;
  findings: Finding[];
}

function atomicWrite(path: string, content: string): void {
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, content);
  renameSync(tmp, path);
}

function findingToBullet(f: Finding): string {
  const loc = f.location.line ? `${f.location.file}:${f.location.line}` : f.location.file;
  return `- **[${f.surface}]** \`${f.rule}\` — ${escapeMd(f.message)} \`(${loc})\` _confidence ${f.confidence}_ \`id:${f.id}\``;
}

export async function writeMarkdownSidecar(input: WriteMarkdownSidecarInput): Promise<void> {
  mkdirSync(input.outDir, { recursive: true });
  const lines: string[] = [
    `# Audit Queue — ${input.runId}`,
    "",
    `Generated: ${new Date().toISOString()}`,
    `Total: ${input.findings.length} finding${input.findings.length === 1 ? "" : "s"}`,
    "",
  ];

  for (const sev of SEVERITY_ORDER) {
    const group = input.findings.filter((f) => f.severity === sev);
    if (group.length === 0) continue;
    lines.push(`## ${sev[0]!.toUpperCase() + sev.slice(1)} (${group.length})`, "");
    for (const f of group) lines.push(findingToBullet(f));
    lines.push("");
  }

  atomicWrite(join(input.outDir, "queue.md"), lines.join("\n"));
}
