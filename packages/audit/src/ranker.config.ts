import type { FindingSeverity, Surface } from "./probe.ts";

// Hand-edited weights. Changes are reviewable PRs to keep ranking stable across runs.
export const RANKER_CONFIG = {
  severityWeight: {
    critical: 1000,
    high: 100,
    medium: 10,
    low: 1,
  } as Record<FindingSeverity, number>,
  surfaceWeight: {
    renderer: 4,
    webui: 3,
    viewer: 2,
  } as Record<Surface, number>,
  vdiBonusMax: 50, // additive cap when vdiImpact = {1,1,1}
} as const;
