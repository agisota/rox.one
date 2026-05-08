#!/usr/bin/env bun
import { spawn } from 'bun';

const targetedWarningPatterns = [
  /Export "InputContainer" of module "apps\/electron\/src\/renderer\/components\/app-shell\/input\/InputContainer\.tsx" was reexported through module "apps\/electron\/src\/renderer\/components\/app-shell\/input\/index\.ts"/,
  /while both modules are dependencies of each other and will end up in different chunks by current Rollup settings/,
] as const;

async function readStream(
  stream: ReadableStream<Uint8Array> | null,
  onChunk: (text: string) => void,
): Promise<string> {
  if (!stream) return '';

  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let output = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      const tail = decoder.decode();
      if (tail) {
        output += tail;
        onChunk(tail);
      }
      break;
    }

    const chunk = decoder.decode(value, { stream: true });
    output += chunk;
    onChunk(chunk);
  }

  return output;
}

console.log('[electron-rollup-warnings] running electron renderer production build');

const proc = spawn({
  cmd: ['bun', 'run', 'electron:build:renderer'],
  stdout: 'pipe',
  stderr: 'pipe',
});

const stdoutTask = readStream(proc.stdout, (chunk) => process.stdout.write(chunk));
const stderrTask = readStream(proc.stderr, (chunk) => process.stderr.write(chunk));
const [exitCode, stdout, stderr] = await Promise.all([proc.exited, stdoutTask, stderrTask]);
const output = `${stdout}\n${stderr}`;

if (exitCode !== 0) {
  console.error(`[electron-rollup-warnings] renderer build exited with code ${exitCode}`);
  process.exit(exitCode);
}

const matchedWarnings = targetedWarningPatterns.filter((pattern) => pattern.test(output));
if (matchedWarnings.length > 0) {
  console.error(
    `[electron-rollup-warnings] targeted InputContainer circular chunk warning emitted: ${matchedWarnings
      .map((pattern) => pattern.source)
      .join(', ')}`,
  );
  process.exit(1);
}

console.log('[electron-rollup-warnings] targeted InputContainer circular chunk warning absent');
