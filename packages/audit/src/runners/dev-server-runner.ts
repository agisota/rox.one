import { spawn, type ChildProcess } from "node:child_process";

export interface SpawnDevServerInput {
  command: string;
  args: string[];
  cwd: string;
  readyPattern: RegExp;
  timeoutMs: number;
  env?: Record<string, string>;
}

export interface DevServerHandle {
  url: string;
  pid: number;
  kill: () => Promise<void>;
}

/**
 * Spawn a dev server process and wait until its stdout/stderr matches `readyPattern`.
 *
 * The first capture group of `readyPattern` is treated as the live URL.
 * Listens on both stdout and stderr because some Vite configs emit the ready
 * line to stderr (e.g. when --logLevel error is forced or sourcemap warnings
 * push log output around).
 *
 * On timeout the spawned process is killed and the promise rejects.
 * On success returns a handle with `kill()` that issues SIGTERM, then SIGKILL
 * after a 2s grace period if the process is still alive.
 */
export function spawnDevServer(input: SpawnDevServerInput): Promise<DevServerHandle> {
  return new Promise<DevServerHandle>((resolve, reject) => {
    let outputTail = "";
    const rememberOutput = (text: string): void => {
      outputTail = `${outputTail}${text}`;
      if (outputTail.length > 8000) {
        outputTail = outputTail.slice(-8000);
      }
    };

    const child: ChildProcess = spawn(input.command, input.args, {
      cwd: input.cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, ...(input.env ?? {}) },
    });

    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        child.kill("SIGKILL");
      } catch {
        // ignore — child may already have exited
      }
      const tail = outputTail.trim();
      reject(
        new Error(
          `spawnDevServer timeout: ready pattern not seen within ${input.timeoutMs}ms` +
            (tail ? `\nRecent output:\n${tail}` : ""),
        ),
      );
    }, input.timeoutMs);

    const onData = (chunk: Buffer | string): void => {
      if (settled) return;
      const text = typeof chunk === "string" ? chunk : chunk.toString("utf8");
      rememberOutput(text);
      const match = input.readyPattern.exec(text);
      if (match) {
        settled = true;
        clearTimeout(timer);
        const url = match[1] ?? match[0];
        const pid = child.pid;
        if (pid === undefined) {
          reject(new Error("spawnDevServer: child process has no pid"));
          return;
        }
        resolve({
          url,
          pid,
          kill: () => killChild(child),
        });
      }
    };

    child.stdout?.on("data", onData);
    child.stderr?.on("data", onData);

    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });

    child.on("exit", (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const tail = outputTail.trim();
      reject(
        new Error(
          `spawnDevServer: process exited before ready (code=${code}, signal=${signal})` +
            (tail ? `\nRecent output:\n${tail}` : ""),
        ),
      );
    });
  });
}

async function killChild(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  return new Promise<void>((resolve) => {
    let resolved = false;
    const finish = (): void => {
      if (resolved) return;
      resolved = true;
      resolve();
    };
    child.once("exit", finish);
    try {
      child.kill("SIGTERM");
    } catch {
      finish();
      return;
    }
    setTimeout(() => {
      if (resolved) return;
      try {
        child.kill("SIGKILL");
      } catch {
        // ignore
      }
      // Give SIGKILL a beat, then resolve regardless
      setTimeout(finish, 200);
    }, 2000);
  });
}
