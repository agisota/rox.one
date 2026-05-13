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
      "CraftAppIcon.tsx",
      "CraftAgentsLogo.tsx",
      "CraftAgentsSymbol.tsx",
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
      "CraftAppIcon",
      "CraftAgentsLogo",
      "CraftAgentsSymbol",
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

  test("renames non-UI Craft identifiers and files while preserving the deprecated config alias", () => {
    const expectedRenames = [
      {
        oldPath: "packages/pi-agent-server/src/craft-metadata-schema.ts",
        newPath: "packages/pi-agent-server/src/rox-agent-metadata-schema.ts",
      },
      {
        oldPath: "packages/shared/src/config/sync-craft-agent-bash-patterns.ts",
        newPath: "packages/shared/src/config/sync-agent-bash-patterns.ts",
      },
    ];

    expect(
      expectedRenames.filter(({ oldPath }) => existsSync(join(repoRoot, oldPath))).map(({ oldPath }) => oldPath),
      "legacy non-UI file names should be renamed",
    ).toEqual([]);
    expect(
      expectedRenames.filter(({ newPath }) => existsSync(join(repoRoot, newPath))).map(({ newPath }) => newPath),
      "canonical non-UI file names should exist",
    ).toEqual(expectedRenames.map(({ newPath }) => newPath));

    const sourceRoots = [
      "packages/shared/src",
      "packages/server-core/src",
      "packages/pi-agent-server/src",
    ];
    const forbiddenIdentifiers = [
      "CraftMcpClient",
      "CraftOAuth",
      "allowCraftMetadataProperties",
      "stripCraftMetadata",
      "getCraftAgentReadOnlyBashPatterns",
      "syncCraftAgentPatterns",
      "isCraftAgentPattern",
      "isCraftAgentConfig",
      "CRAFT_DISPLAY_NAME_KEY",
      "CRAFT_INTENT_KEY",
      "CRAFT_DISPLAY_NAME_SCHEMA",
      "CRAFT_INTENT_SCHEMA",
    ];

    const hits = sourceRoots
      .flatMap((root) => walkFiles(join(repoRoot, root)))
      .filter((path) => textExtensions.has(extensionOf(path)))
      .flatMap((path) => {
        const body = readText(path);
        return forbiddenIdentifiers
          .filter((identifier) => body.includes(identifier))
          .map((identifier) => `${relativePath(path)}: ${identifier}`);
      });

    expect(hits).toEqual([]);

    const claudeAgent = readText(join(repoRoot, "packages/shared/src/agent/claude-agent.ts"));
    expect(claudeAgent).toContain("export type { ClaudeAgentConfig as CraftAgentConfig }");
    expect(claudeAgent).toContain("@deprecated Use ClaudeAgentConfig instead; remove in v1.1.0.");
  });

  test("renames active test filenames that still carry legacy product tokens", () => {
    const expectedRenames = [
      {
        oldPath: "packages/shared/tests/permissions-craft-agent-sync.test.ts",
        newPath: "packages/shared/tests/permissions-agent-sync.test.ts",
      },
      {
        oldPath: "packages/shared/src/agent/__tests__/permissions-config-craft-cli-flag.test.ts",
        newPath: "packages/shared/src/agent/__tests__/permissions-config-cli-flag.test.ts",
      },
    ];

    expect(
      expectedRenames.filter(({ oldPath }) => existsSync(join(repoRoot, oldPath))).map(({ oldPath }) => oldPath),
      "legacy test file names should be renamed",
    ).toEqual([]);
    expect(
      expectedRenames.filter(({ newPath }) => existsSync(join(repoRoot, newPath))).map(({ newPath }) => newPath),
      "canonical test file names should exist",
    ).toEqual(expectedRenames.map(({ newPath }) => newPath));
  });
});
