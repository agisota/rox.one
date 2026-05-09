import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { findTsconfig } from "../discovery.ts";
import type { Finding, FindingSeverity, Probe, ProbeContext } from "../probe.ts";
import { computeFindingId, FINDING_SCHEMA_VERSION } from "../probe.ts";

// Map a tsc TS-code prefix range to severity. Conservative defaults.
function severityFor(code: string): FindingSeverity {
  // TS2xxx (assignability/argument-type) — high (likely real bugs)
  // TS7006 (implicit any) — medium (style + correctness signal)
  // TS6133 (unused) — low
  if (code === "TS6133" || code === "TS6196") return "low";
  if (code === "TS7006") return "medium";
  return "high";
}

interface TscDiagnostic {
  file: string;
  line: number;
  column: number;
  code: string;
  message: string;
}

function parseTscOutput(output: string, surfaceRoot: string): TscDiagnostic[] {
  // tsc default format: `path/to/file.ts(line,col): error TSxxxx: message`
  const re = /^(.+?)\((\d+),(\d+)\):\s*error\s+(TS\d+):\s*(.+)$/;
  const diags: TscDiagnostic[] = [];
  for (const raw of output.split("\n")) {
    const m = raw.match(re);
    if (!m) continue;
    const [, file, line, column, code, message] = m;
    diags.push({
      file: file!.startsWith(surfaceRoot) ? file! : join(surfaceRoot, file!),
      line: parseInt(line!, 10),
      column: parseInt(column!, 10),
      code: code!,
      message: message!.trim(),
    });
  }
  return diags;
}

export const staticTscProbe: Probe = {
  name: "static-tsc",
  phase: "A.1",
  applicableTo: () => true,
  async run(ctx: ProbeContext): Promise<Finding[]> {
    const tsconfigPath = findTsconfig(ctx.surfaceRoot);
    if (tsconfigPath === null) return [];
    const bunBin = process.execPath; // resolves to the bun binary that is running this process
    const result = spawnSync(bunBin, ["x", "tsc", "--noEmit", "-p", tsconfigPath], {
      cwd: ctx.surfaceRoot,
      encoding: "utf-8",
      timeout: ctx.timeoutMs,
    });
    const output = (result.stdout ?? "") + (result.stderr ?? "");
    const diags = parseTscOutput(output, ctx.surfaceRoot);
    const now = new Date().toISOString();
    return diags.map((d) => {
      const sev = severityFor(d.code);
      const id = computeFindingId({ probe: "static-tsc", rule: `tsc:${d.code}`, file: d.file, line: d.line });
      const finding: Finding = {
        schemaVersion: FINDING_SCHEMA_VERSION,
        id,
        probe: "static-tsc",
        surface: ctx.surface,
        phase: "A.1",
        severity: sev,
        rule: `tsc:${d.code}`,
        location: { file: d.file, line: d.line, column: d.column },
        message: d.message,
        confidence: 1,
        vdiImpact: { quality: 0.6, risk: 0.4, readiness: 0.3 },
        firstSeen: now,
        lastSeen: now,
      };
      return finding;
    });
  },
};
