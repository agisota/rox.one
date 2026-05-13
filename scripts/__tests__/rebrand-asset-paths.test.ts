import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, test } from "bun:test";

const repoRoot = join(import.meta.dir, "../..");
const legacyStem = "cr" + "aft";

const textExtensions = new Set([
  ".cjs",
  ".json",
  ".md",
  ".ts",
  ".tsx",
  ".yml",
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

describe("R.3 asset path rebrand", () => {
  test("renames logo asset directory and filenames to Rox names", () => {
    const expectedRenames = [
      {
        oldPath: `apps/electron/resources/${legacyStem}-logos`,
        newPath: "apps/electron/resources/rox-logos",
      },
      {
        oldPath: `apps/electron/resources/${legacyStem}-logos/${legacyStem}_app_icon.png`,
        newPath: "apps/electron/resources/rox-logos/rox_app_icon.png",
      },
      {
        oldPath: `apps/electron/resources/${legacyStem}-logos/${legacyStem}_app_icon_dark.png`,
        newPath: "apps/electron/resources/rox-logos/rox_app_icon_dark.png",
      },
      {
        oldPath: `apps/electron/resources/${legacyStem}-logos/${legacyStem}_logo_black.png`,
        newPath: "apps/electron/resources/rox-logos/rox_logo_black.png",
      },
      {
        oldPath: `apps/electron/resources/${legacyStem}-logos/${legacyStem}_logo_white.png`,
        newPath: "apps/electron/resources/rox-logos/rox_logo_white.png",
      },
      {
        oldPath: `apps/electron/src/renderer/assets/${legacyStem}_logo_c.svg`,
        newPath: "apps/electron/src/renderer/assets/rox_logo_c.svg",
      },
    ];

    expect(
      expectedRenames.filter(({ oldPath }) => existsSync(join(repoRoot, oldPath))).map(({ oldPath }) => oldPath),
      "legacy logo asset paths should be renamed",
    ).toEqual([]);
    expect(
      expectedRenames.filter(({ newPath }) => existsSync(join(repoRoot, newPath))).map(({ newPath }) => newPath),
      "canonical logo asset paths should exist",
    ).toEqual(expectedRenames.map(({ newPath }) => newPath));

    const scanRoots = [
      "apps/electron/resources/AGENTS.md",
      "apps/electron/electron-builder.yml",
      "apps/electron/scripts",
      "apps/electron/src",
      "packages/shared/src",
    ];
    const forbiddenRefs = [
      `${legacyStem}-logos`,
      `${legacyStem}_app_icon`,
      `${legacyStem}_logo_black`,
      `${legacyStem}_logo_white`,
      `${legacyStem}_logo_c`,
    ];

    const hits = scanRoots
      .flatMap((root) => {
        const absolute = join(repoRoot, root);
        return root.endsWith(".md") || root.endsWith(".yml") ? [absolute] : walkFiles(absolute);
      })
      .filter((path) => textExtensions.has(extensionOf(path)))
      .flatMap((path) => {
        const body = readText(path);
        return forbiddenRefs
          .filter((token) => body.includes(token))
          .map((token) => `${relativePath(path)}: ${token}`);
      });

    expect(hits).toEqual([]);
  });
});
