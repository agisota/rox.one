import { createHash } from "node:crypto";
import type { PlaywrightRunner } from "./runners/playwright-runner.ts";

export type Surface = "renderer" | "webui" | "viewer" | "marketing";
export type Phase = "A.1" | "A.2" | "A.3" | "A.4";
export type FindingSeverity = "critical" | "high" | "medium" | "low";

export const FINDING_SCHEMA_VERSION = 1 as const;

export interface ProbeContext {
  surface: Surface;
  workspaceRoot: string;
  surfaceRoot: string;
  buildOutputRoot?: string;
  timeoutMs: number;
  // A.2+ probes that need a browser receive a shared runner via this field.
  playwright?: PlaywrightRunner;
}

export interface Probe {
  readonly name: string;
  readonly phase: Phase;
  applicableTo(surface: Surface): boolean;
  run(ctx: ProbeContext): Promise<Finding[]>;
}

export interface FindingLocation {
  file: string;
  line?: number;
  column?: number;
  selector?: string;
  route?: string;
}

export interface FindingEvidence {
  screenshot?: string;
  codeSnippet?: string;
  consoleLog?: string;
}

export interface VdiImpact {
  quality: number;
  risk: number;
  readiness: number;
}

export interface Finding {
  schemaVersion: typeof FINDING_SCHEMA_VERSION;
  id: string;
  probe: string;
  surface: Surface;
  phase: Phase;
  severity: FindingSeverity;
  rule: string;
  location: FindingLocation;
  message: string;
  evidence?: FindingEvidence;
  suggestedFix?: string;
  confidence: number;
  vdiImpact: VdiImpact;
  firstSeen: string;
  lastSeen: string;
}

export interface FindingIdInput {
  probe: string;
  rule: string;
  file: string;
  line?: number;
}

export function computeFindingId(input: FindingIdInput): string {
  const key = [input.probe, input.rule, input.file, input.line ?? ""].join("|");
  return createHash("sha256").update(key).digest("hex").slice(0, 16);
}
