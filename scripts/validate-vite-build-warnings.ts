#!/usr/bin/env bun
import { spawn } from 'bun';

type BuildCheck = {
  name: string;
  command: string[];
};

const checks: BuildCheck[] = [
  {
    name: 'electron renderer',
    command: ['bun', 'run', 'electron:build:renderer'],
  },
  {
    name: 'webui',
    command: ['bun', 'run', 'webui:build'],
  },
];

const deprecatedJotaiWarningPatterns = [
  /\[DEPRECATED\] jotai\/babel\/plugin-debug-label is deprecated/,
  /\[DEPRECATED\] jotai\/babel\/plugin-react-refresh is deprecated/,
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

async function runBuildCheck(check: BuildCheck): Promise<{ failed: boolean; output: string }> {
  console.log(`[vite-build-warnings] running ${check.name}: ${check.command.join(' ')}`);

  const proc = spawn({
    cmd: check.command,
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const stdoutTask = readStream(proc.stdout, (chunk) => process.stdout.write(chunk));
  const stderrTask = readStream(proc.stderr, (chunk) => process.stderr.write(chunk));
  const [exitCode, stdout, stderr] = await Promise.all([proc.exited, stdoutTask, stderrTask]);
  const output = `${stdout}\n${stderr}`;

  if (exitCode !== 0) {
    console.error(`[vite-build-warnings] ${check.name} exited with code ${exitCode}`);
    return { failed: true, output };
  }

  const matchedWarnings = deprecatedJotaiWarningPatterns.filter((pattern) => pattern.test(output));
  if (matchedWarnings.length > 0) {
    console.error(
      `[vite-build-warnings] ${check.name} emitted deprecated Jotai Babel warning(s): ${matchedWarnings
        .map((pattern) => pattern.source)
        .join(', ')}`,
    );
    return { failed: true, output };
  }

  console.log(`[vite-build-warnings] ${check.name} passed deprecated Jotai warning gate`);
  return { failed: false, output };
}

let failed = false;

for (const check of checks) {
  const result = await runBuildCheck(check);
  failed = failed || result.failed;
}

if (failed) {
  console.error('[vite-build-warnings] deprecated Jotai Babel warning gate failed');
  process.exit(1);
}

console.log('[vite-build-warnings] production Vite builds emitted no deprecated Jotai Babel warnings');
