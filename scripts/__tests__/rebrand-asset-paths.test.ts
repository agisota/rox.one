import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, test } from "bun:test";

const repoRoot = join(import.meta.dir, "../..");
const legacyStem = "cr" + "aft";
const legacyAgentCommand = `${legacyStem}-agent`;
const legacyCliDoc = `${legacyStem}-cli`;

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

  test("renames bundled CLI binary, doc, and tool icon paths to Rox names", () => {
    const expectedRenames = [
      {
        oldPath: `apps/electron/resources/tool-icons/${legacyAgentCommand}.png`,
        newPath: "apps/electron/resources/tool-icons/rox-agent.png",
      },
      {
        oldPath: `apps/electron/resources/docs/${legacyCliDoc}.md`,
        newPath: "apps/electron/resources/docs/rox-cli.md",
      },
      {
        oldPath: `apps/electron/resources/bin/${legacyAgentCommand}`,
        newPath: "apps/electron/resources/bin/rox-agent",
      },
      {
        oldPath: `apps/electron/resources/bin/${legacyAgentCommand}.cmd`,
        newPath: "apps/electron/resources/bin/rox-agent.cmd",
      },
    ];

    expect(
      expectedRenames.filter(({ oldPath }) => existsSync(join(repoRoot, oldPath))).map(({ oldPath }) => oldPath),
      "legacy CLI asset paths should be renamed",
    ).toEqual([]);
    expect(
      expectedRenames.filter(({ newPath }) => existsSync(join(repoRoot, newPath))).map(({ newPath }) => newPath),
      "canonical CLI asset paths should exist",
    ).toEqual(expectedRenames.map(({ newPath }) => newPath));

    const roxCliDoc = readText(join(repoRoot, "apps/electron/resources/docs/rox-cli.md"));
    expect(roxCliDoc).toContain("`rox-agent` is the preferred interface");
    expect(roxCliDoc).not.toContain(legacyAgentCommand);

    const mainProcess = readText(join(repoRoot, "apps/electron/src/main/index.ts"));
    expect(mainProcess).toContain("'rox-cli.md'");
    expect(mainProcess).not.toContain(`'${legacyCliDoc}.md'`);

    const docRefs = readText(join(repoRoot, "packages/shared/src/docs/index.ts"));
    expect(docRefs).toContain("roxCli:");
    expect(docRefs).toContain("/docs/rox-cli.md");
    expect(docRefs).not.toContain(`${legacyStem}Cli:`);
    expect(docRefs).not.toContain(`/docs/${legacyCliDoc}.md`);

    const systemPrompt = readText(join(repoRoot, "packages/shared/src/prompts/system.ts"));
    expect(systemPrompt).toContain("ROX CLI");
    expect(systemPrompt).toContain("DOC_REFS.roxCli");
    expect(systemPrompt).toContain("rox-agent");
    expect(systemPrompt).not.toContain(`DOC_REFS.${legacyStem}Cli`);

    const linkedDocs = [
      "apps/electron/resources/docs/automations.md",
      "apps/electron/resources/docs/labels.md",
      "apps/electron/resources/docs/permissions.md",
      "apps/electron/resources/docs/skills.md",
      "apps/electron/resources/docs/sources.md",
    ];
    for (const relativePath of linkedDocs) {
      const body = readText(join(repoRoot, relativePath));
      expect(body).toContain("[rox-cli.md](./rox-cli.md)");
      expect(body).not.toContain(`[${legacyCliDoc}.md](./${legacyCliDoc}.md)`);
    }

    const toolIcons = readText(join(repoRoot, "apps/electron/resources/tool-icons/tool-icons.json"));
    expect(toolIcons).toContain('"id": "rox-agent"');
    expect(toolIcons).toContain('"icon": "rox-agent.png"');
    expect(toolIcons).toContain('"commands": ["rox-agent"]');
    expect(toolIcons).not.toContain(`${legacyAgentCommand}.png`);
  });
});
