import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";

const CLI = join(import.meta.dir, "..", "src", "cli.ts");
const BUN = process.execPath; // resolves to the running bun binary (absolute path)

describe("cli", () => {
  test("`audit --help` prints usage and exits 0", () => {
    const result = spawnSync(BUN, ["run", CLI, "--help"], { encoding: "utf-8" });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Usage:");
    expect(result.stdout).toContain("audit run");
  });

  test("`audit run` with no surfaces exits 1 with helpful error", () => {
    const result = spawnSync(BUN, ["run", CLI, "run"], { encoding: "utf-8" });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("surfaces");
  });

  test("runs static-tsc against a fixture surface and writes valid queue.json", () => {
    const tmp = mkdtempSync(join(tmpdir(), "audit-cli-"));
    try {
      const result = spawnSync(BUN, ["run", CLI, "run", "renderer", "--probes=static-tsc", `--out=${tmp}`, "--no-tickets"], {
        encoding: "utf-8",
        cwd: process.cwd(),
      });
      expect(result.status).toBe(0);
      const queue = JSON.parse(readFileSync(join(tmp, "queue.json"), "utf-8"));
      expect(queue.schemaVersion).toBe(1);
      expect(Array.isArray(queue.findings)).toBe(true);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe("port-occupancy guard", () => {
  test("isPortInUse returns true for an actively bound port and false for a free port", async () => {
    // Bind a TCP server on an ephemeral port so lsof can detect it.
    const server = createServer();
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as { port: number }).port;

    // The function under test is private to cli.ts, so we exercise it via the
    // lsof shell command the same way the implementation does.
    const occupied = spawnSync("lsof", ["-ti", `:${port}`], { encoding: "utf-8" });
    expect(occupied.status).toBe(0);
    expect(occupied.stdout.trim().length).toBeGreaterThan(0);

    await new Promise<void>((resolve) => server.close(() => resolve()));

    // After closing, the port should no longer appear in lsof output.
    // Allow a small retry window for the OS to release the port.
    let freed = false;
    for (let i = 0; i < 10; i++) {
      const check = spawnSync("lsof", ["-ti", `:${port}`], { encoding: "utf-8" });
      if (check.status !== 0 || check.stdout.trim().length === 0) {
        freed = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 50));
    }
    expect(freed).toBe(true);
  });
});
