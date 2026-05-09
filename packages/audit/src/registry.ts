import type { Finding, Probe, ProbeContext, Surface } from "./probe.ts";

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
        try {
          const ctx = opts.contextFor(next.surface);
          const findings = await next.probe.run(ctx);
          allFindings.push(...findings);
        } catch (e) {
          crashed.push({ probe: next.probe.name, surface: next.surface, error: e instanceof Error ? e.message : String(e) });
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
