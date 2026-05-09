import { spawnSync } from "node:child_process";
import { findEslintConfig } from "../discovery.ts";
import type { Finding, FindingSeverity, Probe, ProbeContext } from "../probe.ts";
import { computeFindingId, FINDING_SCHEMA_VERSION } from "../probe.ts";

interface EslintMessage {
  ruleId: string | null;
  severity: number; // 2 = error, 1 = warning
  message: string;
  line?: number;
  column?: number;
}

interface EslintFileReport {
  filePath: string;
  messages: EslintMessage[];
}

function severityFor(eslintSeverity: number): FindingSeverity {
  return eslintSeverity >= 2 ? "high" : "medium";
}

export const staticEslintProbe: Probe = {
  name: "static-eslint",
  phase: "A.1",
  applicableTo: () => true,
  async run(ctx: ProbeContext): Promise<Finding[]> {
    // Find config file via discovery (surfaceRoot, then walk up to repo root)
    const found = findEslintConfig(ctx.surfaceRoot);
    if (found === null) return [];

    const isLegacyConfig = found.format === "legacy";
    const bunBin = process.execPath;

    // Build eslint args
    const args = ["x", "eslint", "--format=json", "--no-error-on-unmatched-pattern"];
    if (isLegacyConfig) {
      args.push("--no-eslintrc", "--config", found.path);
    }
    args.push("src/");

    const result = spawnSync(bunBin, args, {
      cwd: ctx.surfaceRoot,
      encoding: "utf-8",
      timeout: ctx.timeoutMs,
    });

    // ESLint exits non-zero when violations found — that's expected
    const rawOutput = result.stdout ?? "";
    if (!rawOutput.trim().startsWith("[")) return [];

    let reports: EslintFileReport[];
    try {
      reports = JSON.parse(rawOutput) as EslintFileReport[];
    } catch {
      return [];
    }

    const now = new Date().toISOString();
    const findings: Finding[] = [];

    for (const report of reports) {
      for (const msg of report.messages) {
        const ruleId = msg.ruleId ?? "unknown";
        const rule = `eslint:${ruleId}`;
        const id = computeFindingId({
          probe: "static-eslint",
          rule,
          file: report.filePath,
          line: msg.line,
        });
        const finding: Finding = {
          schemaVersion: FINDING_SCHEMA_VERSION,
          id,
          probe: "static-eslint",
          surface: ctx.surface,
          phase: "A.1",
          severity: severityFor(msg.severity),
          rule,
          location: {
            file: report.filePath,
            line: msg.line,
            column: msg.column,
          },
          message: msg.message,
          confidence: 1,
          vdiImpact: { quality: 0.5, risk: 0.3, readiness: 0.2 },
          firstSeen: now,
          lastSeen: now,
        };
        findings.push(finding);
      }
    }

    return findings;
  },
};
