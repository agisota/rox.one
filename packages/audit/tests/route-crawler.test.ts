import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { spawnDevServer, type DevServerHandle } from "../src/runners/dev-server-runner.ts";
import { crawlRoutes } from "../src/route-crawler.ts";
import { createPlaywrightRunner, type PlaywrightRunner } from "../src/runners/playwright-runner.ts";

const REPO_ROOT = join(import.meta.dir, "..", "..", "..");
const FIXTURE = join(import.meta.dir, "fixtures", "spa-fixture");
const VITE_BIN = join(
  REPO_ROOT,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "vite.cmd" : "vite",
);
const SERVER_TIMEOUT_MS = process.env.CI ? 90_000 : 30_000;
let server: DevServerHandle | null = null;
let pw: PlaywrightRunner | null = null;

beforeAll(async () => {
  if (!existsSync(VITE_BIN)) {
    throw new Error(`missing root Vite binary: ${VITE_BIN}; run bun install`);
  }
  server = await spawnDevServer({
    command: VITE_BIN,
    args: ["--host", "127.0.0.1", "--port", "5174"],
    cwd: FIXTURE,
    readyPattern: /Local:\s+(http:\/\/[^\s/]+\/?)/,
    timeoutMs: SERVER_TIMEOUT_MS,
  });
  pw = await createPlaywrightRunner();
}, SERVER_TIMEOUT_MS + 30_000);

afterAll(async () => {
  if (pw) await pw.close();
  if (server) await server.kill();
});

describe("crawlRoutes", () => {
  test("discovers /, /about, /contact from SPA fixture", async () => {
    if (!server || !pw) throw new Error("server or pw not initialised");
    const routes = await crawlRoutes({
      baseUrl: server.url,
      playwright: pw,
      maxDepth: 2,
      maxRoutes: 20,
    });
    expect(routes).toContain("/");
    expect(routes).toContain("/about");
    expect(routes).toContain("/contact");
  }, 60_000);
});
