import { test, expect } from "bun:test";
import { execFileSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";

const hookPath = join(process.cwd(), ".husky/pre-commit");

test("pre-commit hook runs gitleaks protect against staged changes", () => {
  const tmpDir = mkdtempSync(join(tmpdir(), "gitleaks-hook-"));
  const binDir = join(tmpDir, "bin");
  const argsFile = join(tmpDir, "args.txt");
  const fakeGitleaks = join(binDir, "gitleaks");

  mkdirSync(binDir);
  writeFileSync(fakeGitleaks, [
    "#!/usr/bin/env sh",
    "printf '%s\\n' \"$@\" > \"$GITLEAKS_ARGS_FILE\"",
    "exit 37",
    "",
  ].join("\n"));
  chmodSync(fakeGitleaks, 0o755);

  try {
    expect(() => execFileSync("/bin/sh", [hookPath], {
      env: {
        ...process.env,
        GITLEAKS_ARGS_FILE: argsFile,
        PATH: `${binDir}${delimiter}${process.env.PATH ?? ""}`,
      },
      encoding: "utf8",
    })).toThrow();

    expect(readFileSync(argsFile, "utf8").trim().split("\n")).toEqual([
      "protect",
      "--staged",
      "--redact",
      "--no-banner",
    ]);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("pre-commit hook is fail-open when local gitleaks is missing", () => {
  const tmpDir = mkdtempSync(join(tmpdir(), "gitleaks-hook-missing-"));
  const binDir = join(tmpDir, "bin");

  try {
    mkdirSync(binDir);
    const output = execFileSync("/bin/sh", [hookPath], {
      env: {
        PATH: binDir,
      },
      encoding: "utf8",
    });

    expect(output).toContain("gitleaks not installed; skipping secret scan");
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});
