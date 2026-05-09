import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateTickets } from "../src/ticket-gen.ts";
import type { Finding } from "../src/probe.ts";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "audit-tg-"));
  mkdirSync(join(dir, "docs", "tickets"), { recursive: true });
});
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

const baseFinding = (overrides: Partial<Finding>): Finding => ({
  schemaVersion: 1,
  id: "1111111111111111",
  probe: "static-tsc",
  surface: "renderer",
  phase: "A.1",
  severity: "high",
  rule: "tsc:TS2345",
  location: { file: "x.ts", line: 10 },
  message: "type mismatch",
  confidence: 1,
  vdiImpact: { quality: 0.6, risk: 0.4, readiness: 0.3 },
  firstSeen: "2026-05-09T11:00:00Z",
  lastSeen: "2026-05-09T11:00:00Z",
  ...overrides,
});

describe("generateTickets — basic", () => {
  test("creates one ticket file per finding (top-K cap not hit)", async () => {
    await generateTickets({
      repoRoot: dir,
      findings: [baseFinding({ id: "aaaa", rule: "tsc:TS2345" }), baseFinding({ id: "bbbb", rule: "tsc:TS2322" })],
      topK: 50,
    });
    const created = readdirSync(join(dir, "docs/tickets"));
    expect(created.length).toBe(2);
  });

  test("ticket file contains frontmatter with findingId, firstSeen, lastSeen, status", async () => {
    await generateTickets({
      repoRoot: dir,
      findings: [baseFinding({ id: "abcd1234abcd1234" })],
      topK: 50,
    });
    const files = readdirSync(join(dir, "docs/tickets"));
    expect(files.length).toBe(1);
    const content = readFileSync(join(dir, "docs/tickets", files[0]!), "utf-8");
    expect(content).toContain("findingId: abcd1234abcd1234");
    expect(content).toContain("status: open");
    expect(content).toMatch(/firstSeen:\s+'?2026-05-09T11:00:00Z'?/);
  });

  test("respects topK cap, excluding overflow", async () => {
    const findings = Array.from({ length: 5 }, (_, i) =>
      baseFinding({ id: `id${i}id${i}id${i}id${i}`.slice(0, 16), rule: `r${i}` }),
    );
    await generateTickets({ repoRoot: dir, findings, topK: 3 });
    const files = readdirSync(join(dir, "docs/tickets"));
    expect(files.length).toBe(3);
  });

  test("next ticket number increments from existing T<N>", async () => {
    writeFileSync(join(dir, "docs/tickets", "T059-prior.md"), "# prior");
    writeFileSync(join(dir, "docs/tickets", "T060-also-prior.md"), "# prior");
    await generateTickets({
      repoRoot: dir,
      findings: [baseFinding({ id: "aaaa", rule: "tsc:TS2345" })],
      topK: 50,
    });
    const files = readdirSync(join(dir, "docs/tickets"));
    const newest = files.find((f) => !f.startsWith("T059") && !f.startsWith("T060-also"));
    expect(newest).toBeDefined();
    expect(newest!.startsWith("T061-")).toBe(true);
  });
});

describe("generateTickets — idempotency", () => {
  test("re-run on same findings creates 0 new tickets", async () => {
    const findings = [baseFinding({ id: "aaaa1111aaaa1111", rule: "tsc:TS2345" })];
    await generateTickets({ repoRoot: dir, findings, topK: 50 });
    const filesAfterFirstRun = readdirSync(join(dir, "docs/tickets"));
    await generateTickets({ repoRoot: dir, findings, topK: 50 });
    const filesAfterSecondRun = readdirSync(join(dir, "docs/tickets"));
    expect(filesAfterSecondRun.length).toBe(filesAfterFirstRun.length);
  });

  test("re-run with mutated lastSeen updates ticket but does not create new file", async () => {
    const id = "abcd5678abcd5678";
    await generateTickets({
      repoRoot: dir,
      findings: [baseFinding({ id, lastSeen: "2026-05-09T11:00:00Z" })],
      topK: 50,
    });
    const filesAfterFirst = readdirSync(join(dir, "docs/tickets"));
    expect(filesAfterFirst.length).toBe(1);

    await generateTickets({
      repoRoot: dir,
      findings: [baseFinding({ id, lastSeen: "2026-05-09T12:30:00Z" })],
      topK: 50,
    });
    const filesAfterSecond = readdirSync(join(dir, "docs/tickets"));
    expect(filesAfterSecond.length).toBe(1);
    const updatedContent = readFileSync(join(dir, "docs/tickets", filesAfterSecond[0]!), "utf-8");
    expect(updatedContent).toContain("lastSeen: '2026-05-09T12:30:00Z'");
  });

  test("removed finding causes ticket to be marked auto-resolved", async () => {
    const id = "deadbeefdeadbeef";
    await generateTickets({ repoRoot: dir, findings: [baseFinding({ id })], topK: 50 });
    await generateTickets({ repoRoot: dir, findings: [], topK: 50 });
    const files = readdirSync(join(dir, "docs/tickets"));
    expect(files.length).toBe(1);
    const content = readFileSync(join(dir, "docs/tickets", files[0]!), "utf-8");
    expect(content).toContain("status: auto-resolved");
    expect(content).not.toContain("status: open");
  });
});
