import { afterEach, describe, expect, test } from "bun:test";
import { spawnDevServer, type DevServerHandle } from "../../src/runners/dev-server-runner.ts";

let handle: DevServerHandle | null = null;
afterEach(async () => {
  if (handle) {
    await handle.kill();
    handle = null;
  }
});

describe("spawnDevServer", () => {
  test("rejects when ready line never appears within timeout", async () => {
    await expect(
      spawnDevServer({
        command: "node",
        args: ["-e", "console.error('booting fixture server'); setInterval(() => {}, 1000)"],
        cwd: process.cwd(),
        readyPattern: /Local:\s+(http:\/\/[^\s]+)/,
        timeoutMs: 500,
      }),
    ).rejects.toThrow(/booting fixture server/);
  });

  test("resolves with URL when ready pattern matches", async () => {
    handle = await spawnDevServer({
      command: "node",
      args: ["-e", "console.log('Local: http://localhost:9999/'); setInterval(() => {}, 1000);"],
      cwd: process.cwd(),
      readyPattern: /Local:\s+(http:\/\/[^\s]+)/,
      timeoutMs: 5000,
    });
    expect(handle.url).toBe("http://localhost:9999/");
  });

  test("resolves when colored dev-server output wraps the ready URL", async () => {
    handle = await spawnDevServer({
      command: "node",
      args: [
        "-e",
        "console.log('\\x1b[32mLocal:\\x1b[0m   \\x1b[36mhttp://localhost:9997/\\x1b[0m'); setInterval(() => {}, 1000);",
      ],
      cwd: process.cwd(),
      readyPattern: /Local:\s+(http:\/\/[^\s]+)/,
      timeoutMs: 5000,
    });
    expect(handle.url).toBe("http://localhost:9997/");
  });

  test("kill() terminates the spawned process", async () => {
    handle = await spawnDevServer({
      command: "node",
      args: ["-e", "console.log('Local: http://localhost:9998/'); setInterval(() => {}, 1000);"],
      cwd: process.cwd(),
      readyPattern: /Local:\s+(http:\/\/[^\s]+)/,
      timeoutMs: 5000,
    });
    await handle.kill();
    handle = null;
  });
});
