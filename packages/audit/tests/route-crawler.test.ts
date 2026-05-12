import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { spawnDevServer, type DevServerHandle } from "../src/runners/dev-server-runner.ts";
import { crawlRoutes } from "../src/route-crawler.ts";
import { createPlaywrightRunner, type PlaywrightRunner } from "../src/runners/playwright-runner.ts";

const FIXTURE = join(import.meta.dir, "fixtures", "spa-fixture");
// bun executable: use process.execPath when running under bun (it resolves to the bun binary itself).
const BUN_BIN = process.execPath;
let server: DevServerHandle | null = null;
let pw: PlaywrightRunner | null = null;

beforeAll(async () => {
  server = await spawnDevServer({
    command: BUN_BIN,
    args: ["run", "dev"],
    cwd: FIXTURE,
    readyPattern: /Local:\s+(http:\/\/[^\s/]+\/?)/,
    timeoutMs: 30_000,
  });
  pw = await createPlaywrightRunner();
}, 60_000);

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
