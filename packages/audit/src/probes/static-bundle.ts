import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { Finding, Probe, ProbeContext } from "../probe.ts";
import { computeFindingId, FINDING_SCHEMA_VERSION } from "../probe.ts";

/**
 * Expand a budget pattern key against the dist directory.
 *
 * Patterns containing `*` are glob-expanded against the actual files in the
 * resolved parent directory. Exact filenames (no `*`) fall back to a direct
 * existsSync check for backward compatibility.
 *
 * Returns the list of matching absolute file paths.
 */
function expandPattern(distRoot: string, pattern: string): string[] {
  if (!pattern.includes("*")) {
    // Exact-filename path — backward-compat.
    const filePath = join(distRoot, pattern);
    return existsSync(filePath) ? [filePath] : [];
  }

  // Glob path: split at the last path separator to get the containing dir and
  // the filename glob (e.g. "assets/main-*.js" → dir="assets", glob="main-*.js").
  const lastSlash = pattern.lastIndexOf("/");
  const dirPart = lastSlash >= 0 ? pattern.slice(0, lastSlash) : "";
  const filePart = lastSlash >= 0 ? pattern.slice(lastSlash + 1) : pattern;

  const searchDir = dirPart ? join(distRoot, dirPart) : distRoot;
  if (!existsSync(searchDir)) return [];

  // Convert the glob segment into a RegExp: escape special chars, then `*` → `[^/]*`.
  const escaped = filePart.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*");
  const re = new RegExp(`^${escaped}$`);

  let entries: string[];
  try {
    entries = readdirSync(searchDir);
  } catch {
    return [];
  }

  return entries
    .filter((name) => re.test(name) && statSync(join(searchDir, name)).isFile())
    .map((name) => join(searchDir, name));
}

export const staticBundleProbe: Probe = {
  name: "static-bundle",
  phase: "A.1",
  applicableTo: () => true,
  async run(ctx: ProbeContext): Promise<Finding[]> {
    const budgetPath = join(ctx.surfaceRoot, "budget.json");
    if (!existsSync(budgetPath)) return [];

    let budget: Record<string, number>;
    try {
      budget = JSON.parse(readFileSync(budgetPath, "utf-8")) as Record<string, number>;
    } catch {
      return [];
    }

    const distRoot = ctx.buildOutputRoot ?? join(ctx.surfaceRoot, "dist");
    const now = new Date().toISOString();
    const findings: Finding[] = [];

    for (const [pattern, maxBytes] of Object.entries(budget)) {
      const matchedPaths = expandPattern(distRoot, pattern);

      if (matchedPaths.length === 0) {
        if (pattern.includes("*")) {
          // Glob matched nothing — the budget entry is stale (chunk likely renamed).
          const rule = "_probe.bundle.budget-stale";
          const id = computeFindingId({ probe: "static-bundle", rule, file: pattern });
          findings.push({
            schemaVersion: FINDING_SCHEMA_VERSION,
            id,
            probe: "static-bundle",
            surface: ctx.surface,
            phase: "A.1",
            severity: "high",
            rule,
            location: { file: join(distRoot, pattern) },
            message: `budget pattern "${pattern}" matched no files in ${distRoot} — budget entry is stale (chunk may have been renamed)`,
            confidence: 0,
            vdiImpact: { quality: 0.5, risk: 0.4, readiness: 0.3 },
            firstSeen: now,
            lastSeen: now,
          });
        }
        // Exact-filename key with no match: skip silently (original behaviour).
        continue;
      }

      // Pick the largest matching file and compare to the budget.
      let largestBytes = 0;
      let largestPath = matchedPaths[0]!;
      for (const p of matchedPaths) {
        const sz = statSync(p).size;
        if (sz > largestBytes) {
          largestBytes = sz;
          largestPath = p;
        }
      }

      if (largestBytes <= maxBytes) continue;

      const rule = "bundle:over-budget";
      const id = computeFindingId({ probe: "static-bundle", rule, file: largestPath });
      const overage = largestBytes - maxBytes;
      const filename = largestPath.replace(`${distRoot}/`, "");
      findings.push({
        schemaVersion: FINDING_SCHEMA_VERSION,
        id,
        probe: "static-bundle",
        surface: ctx.surface,
        phase: "A.1",
        severity: "high",
        rule,
        location: { file: largestPath },
        message: `${filename} is ${largestBytes} bytes, exceeds budget of ${maxBytes} bytes by ${overage} bytes`,
        confidence: 1,
        vdiImpact: { quality: 0.5, risk: 0.4, readiness: 0.3 },
        firstSeen: now,
        lastSeen: now,
      });
    }

    return findings;
  },
};
