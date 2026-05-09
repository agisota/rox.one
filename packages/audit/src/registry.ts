import { computeFindingId, FINDING_SCHEMA_VERSION } from "./probe.ts";
import type { Finding, Probe, ProbeContext, Surface } from "./probe.ts";

function makeMetaFinding(
  probe: string,
  surface: Surface,
  rule: "_probe.timeout" | "_probe.crash",
  message: string,
): Finding {
  const now = new Date().toISOString();
  return {
    schemaVersion: FINDING_SCHEMA_VERSION,
    id: computeFindingId({ probe, rule, file: `<probe:${probe}>`, line: 0 }),
    probe,
    surface,
    phase: "A.1",
    severity: "low",
    rule,
    location: { file: `<probe:${probe}>` },
    message,
    confidence: 0,
    vdiImpact: { quality: 0, risk: 0, readiness: 0 },
    firstSeen: now,
    lastSeen: now,
  };
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<{ ok: true; value: T } | { ok: false; reason: "timeout" }> {
  return await Promise.race([
    promise.then((value) => ({ ok: true as const, value })),
    new Promise<{ ok: false; reason: "timeout" }>((resolve) =>
      setTimeout(() => resolve({ ok: false, reason: "timeout" }), ms),
    ),
  ]);
}

export interface RegistryRunOptions {
  surfaces: Surface[];
  probes: string[];
  workerCap: number;
  contextFor: (surface: Surface) => ProbeContext;
}

export interface RegistryRunResult {
  findings: Finding[];
  runProbes: string[];
  executedPairs: { probe: string; surface: Surface }[];
  crashed: { probe: string; surface: Surface; error: string }[];
}

export class ProbeRegistry {
  private probes = new Map<string, Probe>();

  register(probe: Probe): void {
    if (this.probes.has(probe.name)) {
      throw new Error(`Probe already registered: ${probe.name}`);
    }
    this.probes.set(probe.name, probe);
  }

  list(): Probe[] {
    return Array.from(this.probes.values());
  }

  async run(opts: RegistryRunOptions): Promise<RegistryRunResult> {
    const selected = opts.probes
      .map((name) => this.probes.get(name))
      .filter((p): p is Probe => p !== undefined);

    const pairs: { probe: Probe; surface: Surface }[] = [];
    for (const probe of selected) {
      for (const surface of opts.surfaces) {
        if (probe.applicableTo(surface)) pairs.push({ probe, surface });
      }
    }

    const allFindings: Finding[] = [];
    const crashed: RegistryRunResult["crashed"] = [];
    const queue = [...pairs];
    const cap = Math.max(1, opts.workerCap);

    async function worker(): Promise<void> {
      while (queue.length > 0) {
        const next = queue.shift();
        if (!next) return;
        const ctx = opts.contextFor(next.surface);
        const outcome = await withTimeout(
          (async () => next.probe.run(ctx))().catch((e) => {
            throw e instanceof Error ? e : new Error(String(e));
          }),
          ctx.timeoutMs,
        ).catch((e: Error) => ({ ok: false as const, reason: "crash" as const, err: e }));

        if (outcome.ok === true) {
          allFindings.push(...outcome.value);
        } else if (outcome.reason === "timeout") {
          allFindings.push(makeMetaFinding(next.probe.name, next.surface, "_probe.timeout", `probe exceeded ${ctx.timeoutMs}ms`));
          crashed.push({ probe: next.probe.name, surface: next.surface, error: "timeout" });
        } else {
          const msg = (outcome as { err: Error }).err.message;
          allFindings.push(makeMetaFinding(next.probe.name, next.surface, "_probe.crash", msg));
          crashed.push({ probe: next.probe.name, surface: next.surface, error: msg });
        }
      }
    }

    const workers = Array.from({ length: Math.min(cap, queue.length) }, () => worker());
    await Promise.all(workers);

    return {
      findings: allFindings,
      runProbes: selected.map((p) => p.name),
      executedPairs: pairs.map(({ probe, surface }) => ({ probe: probe.name, surface })),
      crashed,
    };
  }
}
