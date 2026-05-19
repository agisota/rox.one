/**
 * Cross-platform renderer build script
 */

import { spawn } from "bun";
import { existsSync, rmSync } from "fs";
import { join } from "path";

const ROOT_DIR = join(import.meta.dir, "..");
const ELECTRON_DIR = join(ROOT_DIR, "apps/electron");
const CIRCULAR_CHUNK_PATTERN = /Circular chunk:/;

async function forwardAndCapture(
  stream: ReadableStream<Uint8Array> | null,
  write: (chunk: string) => void,
): Promise<string> {
  if (!stream) return "";

  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let output = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      const remainder = decoder.decode();
      if (remainder) {
        output += remainder;
        write(remainder);
      }
      break;
    }

    const text = decoder.decode(value, { stream: true });
    output += text;
    write(text);
  }

  return output;
}

// Clean renderer dist first
const rendererDir = join(ELECTRON_DIR, "dist/renderer");
if (existsSync(rendererDir)) {
  rmSync(rendererDir, { recursive: true, force: true });
}

const proc = spawn({
  cmd: ["bun", "run", "vite", "build", "--config", "apps/electron/vite.config.ts"],
  cwd: ROOT_DIR,
  stdout: "pipe",
  stderr: "pipe",
  env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=4096" },
});

const [stdout, stderr, exitCode] = await Promise.all([
  forwardAndCapture(proc.stdout, (chunk) => process.stdout.write(chunk)),
  forwardAndCapture(proc.stderr, (chunk) => process.stderr.write(chunk)),
  proc.exited,
]);

const combinedOutput = `${stdout}\n${stderr}`;
if (CIRCULAR_CHUNK_PATTERN.test(combinedOutput)) {
  console.error(
    "[renderer-build] Vite emitted Rollup circular chunks. "
    + "Treating this as fatal because previous circular React/i18n chunks made the packaged app hang on the loading screen.",
  );
  process.exit(1);
}

process.exit(exitCode);
