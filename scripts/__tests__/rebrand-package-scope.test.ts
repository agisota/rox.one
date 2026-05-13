import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

const repoRoot = join(import.meta.dir, "../..");
const legacyStem = "cr" + "aft";
const legacyScope = `@${legacyStem}-agent`;
const roxScope = "@rox-one";
const packageName = "test-fixtures";
const legacyFixturePackage = `${legacyScope}/${packageName}`;
const roxFixturePackage = `${roxScope}/${packageName}`;

function readText(path: string): string {
  return readFileSync(join(repoRoot, path), "utf8");
}

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readText(path)) as Record<string, unknown>;
}

describe("R.5 package-scope rebrand", () => {
  test("renames the test-fixtures workspace package to the ROX scope", () => {
    const fixturePackageJson = readJson("packages/test-fixtures/package.json");
    expect(fixturePackageJson.name).toBe(roxFixturePackage);

    const sharedPackageJson = readJson("packages/shared/package.json");
    const sharedDevDependencies = sharedPackageJson.devDependencies as Record<string, string>;
    expect(sharedDevDependencies[roxFixturePackage]).toBe("workspace:*");
    expect(sharedDevDependencies[legacyFixturePackage]).toBeUndefined();

    const textFiles = [
      "packages/test-fixtures/README.md",
      "packages/test-fixtures/src/index.ts",
      "packages/shared/tests/mode-manager.test.ts",
      "packages/shared/tests/mode-manager-bash-validation.test.ts",
    ];

    for (const path of textFiles) {
      const body = readText(path);
      expect(body, path).toContain(roxFixturePackage);
      expect(body, path).not.toContain(legacyFixturePackage);
    }

    const lockfile = readText("bun.lock");
    expect(lockfile).toContain(roxFixturePackage);
    expect(lockfile).not.toContain(legacyFixturePackage);
  });
});
