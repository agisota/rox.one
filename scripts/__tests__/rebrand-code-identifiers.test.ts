import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, test } from "bun:test";

const repoRoot = join(import.meta.dir, "../..");

const textExtensions = new Set([
  ".cjs",
  ".css",
  ".cts",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".mjs",
  ".mts",
  ".ts",
  ".tsx",
]);

function walkFiles(root: string): string[] {
  const entries = readdirSync(root, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) return walkFiles(path);
    return entry.isFile() ? [path] : [];
  });
}

function extensionOf(path: string): string {
  const match = path.match(/(\.[^.]+)$/);
  return match?.[1] ?? "";
}

function readText(path: string): string {
  return readFileSync(path, "utf8");
}

function relativePath(path: string): string {
  return relative(repoRoot, path);
}

describe("R.2 code identifier rebrand", () => {
  test("renames UI icon component identifiers and files to Rox names", () => {
    const iconsDir = join(repoRoot, "apps/electron/src/renderer/components/icons");
    const rendererDir = join(repoRoot, "apps/electron/src/renderer");

    const oldIconFiles = [
      "RoxAppIcon.tsx",
      "RoxAgentsLogo.tsx",
      "RoxAgentsSymbol.tsx",
    ];
    const newIconFiles = [
      "RoxAppIcon.tsx",
      "RoxAgentsLogo.tsx",
      "RoxAgentsSymbol.tsx",
    ];

    expect(
      oldIconFiles.filter((file) => existsSync(join(iconsDir, file))),
      "legacy icon component files should be renamed",
    ).toEqual([]);
    expect(
      newIconFiles.filter((file) => existsSync(join(iconsDir, file))),
      "canonical icon component files should exist",
    ).toEqual(newIconFiles);

    const forbiddenIdentifiers = [
      "RoxAppIcon",
      "RoxAgentsLogo",
      "RoxAgentsSymbol",
    ];

    const hits = walkFiles(rendererDir)
      .filter((path) => textExtensions.has(extensionOf(path)))
      .flatMap((path) => {
        const body = readText(path);
        return forbiddenIdentifiers
          .filter((identifier) => body.includes(identifier))
          .map((identifier) => `${relativePath(path)}: ${identifier}`);
      });

    expect(hits).toEqual([]);
  });
});
