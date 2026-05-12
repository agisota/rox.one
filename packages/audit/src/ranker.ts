import type { Finding } from "./probe.ts";
import { RANKER_CONFIG } from "./ranker.config.ts";

export function score(f: Finding): number {
  const base =
    RANKER_CONFIG.severityWeight[f.severity] *
    RANKER_CONFIG.surfaceWeight[f.surface] *
    f.confidence;
  const vdiSum = (f.vdiImpact.quality + f.vdiImpact.risk + f.vdiImpact.readiness) / 3;
  return base + vdiSum * RANKER_CONFIG.vdiBonusMax;
}

export function rank(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => {
    const sa = score(a);
    const sb = score(b);
    if (sa !== sb) return sb - sa; // descending by score
    return a.id.localeCompare(b.id); // stable tie-break
  });
}
