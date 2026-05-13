import { readFileSync } from "node:fs";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

const repoRoot = join(import.meta.dir, "../..");
const legacyStem = "cr" + "aft";
const legacyScope = `@${legacyStem}-agent`;
const roxScope = "@rox-one";
const legacySharedPackage = `${legacyScope}/shared`;
const roxSharedPackage = `${roxScope}/shared`;
const legacyFixturePackage = `${legacyScope}/test-fixtures`;
const roxFixturePackage = `${roxScope}/test-fixtures`;
const legacyUiPackage = `${legacyScope}/ui`;
const roxUiPackage = `${roxScope}/ui`;
const legacyCorePackage = `${legacyScope}/core`;
const roxCorePackage = `${roxScope}/core`;
const legacyAuditPackage = `${legacyScope}/audit`;
const roxAuditPackage = `${roxScope}/audit`;
const legacySessionToolsCorePackage = `${legacyScope}/session-tools-core`;
const roxSessionToolsCorePackage = `${roxScope}/session-tools-core`;
const legacySessionMcpServerPackage = `${legacyScope}/session-mcp-server`;
const roxSessionMcpServerPackage = `${roxScope}/session-mcp-server`;
const legacyMessagingGatewayPackage = `${legacyScope}/messaging-gateway`;
const roxMessagingGatewayPackage = `${roxScope}/messaging-gateway`;
const legacyMessagingWhatsappWorkerPackage = `${legacyScope}/messaging-whatsapp-worker`;
const roxMessagingWhatsappWorkerPackage = `${roxScope}/messaging-whatsapp-worker`;
const legacyPiAgentServerPackage = `${legacyScope}/pi-agent-server`;
const roxPiAgentServerPackage = `${roxScope}/pi-agent-server`;
const legacyServerPackage = `${legacyScope}/server`;
const roxServerPackage = `${roxScope}/server`;
const legacyServerCorePackage = `${legacyScope}/server-core`;
const roxServerCorePackage = `${roxScope}/server-core`;
const appPackages = ["cli", "electron", "viewer", "webui"] as const;

function readText(path: string): string {
  return readFileSync(join(repoRoot, path), "utf8");
}

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readText(path)) as Record<string, unknown>;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function containsPackageReference(body: string, packageName: string): boolean {
  return new RegExp(`${escapeRegExp(packageName)}(?=$|[/@'"\\s,:\\]])`).test(body);
}

function listFiles(root: string): string[] {
  const absoluteRoot = join(repoRoot, root);
  const entries = readdirSync(absoluteRoot, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const relativePath = join(root, entry.name);
    const absolutePath = join(repoRoot, relativePath);
    if (entry.isDirectory()) {
      if (["dist", "node_modules", ".omc", ".omx"].includes(entry.name)) continue;
      files.push(...listFiles(relativePath));
      continue;
    }

    if (!entry.isFile()) continue;
    const stats = statSync(absolutePath);
    if (stats.size > 2_000_000) continue;
    if (!/\.(cjs|css|js|json|md|mjs|ts|tsx)$/.test(entry.name)) continue;
    files.push(relativePath);
  }

  return files;
}

function listPackageScopeCloseoutFiles(): string[] {
  return [
    ...listFiles("apps"),
    ...listFiles("packages"),
    ...listFiles("scripts"),
    "package.json",
    "tsconfig.base.json",
    "tsconfig.json",
  ].filter((path) =>
    /\.(ts|tsx)$/.test(path) ||
    path.endsWith("package.json") ||
    /(^|\/)tsconfig[^/]*\.json$/.test(path),
  );
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

  test("renames the shared UI workspace package to the ROX scope", () => {
    const uiPackageJson = readJson("packages/ui/package.json");
    expect(uiPackageJson.name).toBe(roxUiPackage);

    const dependencyPackages = [
      "apps/electron/package.json",
      "apps/viewer/package.json",
      "apps/webui/package.json",
    ];

    for (const path of dependencyPackages) {
      const packageJson = readJson(path);
      const dependencies = packageJson.dependencies as Record<string, string>;
      expect(dependencies[roxUiPackage], path).toBe("workspace:*");
      expect(dependencies[legacyUiPackage], path).toBeUndefined();
    }

    const activeFiles = [...listFiles("apps"), ...listFiles("packages"), "bun.lock"];
    const legacyMatches = activeFiles.filter((path) => readText(path).includes(legacyUiPackage));
    expect(legacyMatches).toEqual([]);

    const roxMatches = activeFiles.filter((path) => readText(path).includes(roxUiPackage));
    expect(roxMatches.length).toBeGreaterThan(0);
    expect(readText("bun.lock")).toContain(roxUiPackage);
  });

  test("renames the core workspace package to the ROX scope", () => {
    const corePackageJson = readJson("packages/core/package.json");
    expect(corePackageJson.name).toBe(roxCorePackage);

    const dependencyPackages = [
      "apps/electron/package.json",
      "apps/viewer/package.json",
      "packages/messaging-gateway/package.json",
      "packages/server/package.json",
      "packages/server-core/package.json",
      "packages/shared/package.json",
      "packages/ui/package.json",
    ];

    for (const path of dependencyPackages) {
      const packageJson = readJson(path);
      const dependencies = packageJson.dependencies as Record<string, string>;
      expect(dependencies[roxCorePackage], path).toBe("workspace:*");
      expect(dependencies[legacyCorePackage], path).toBeUndefined();
    }

    const activeFiles = [...listFiles("apps"), ...listFiles("packages"), "bun.lock"];
    const legacyMatches = activeFiles.filter((path) => readText(path).includes(legacyCorePackage));
    expect(legacyMatches).toEqual([]);

    const roxMatches = activeFiles.filter((path) => readText(path).includes(roxCorePackage));
    expect(roxMatches.length).toBeGreaterThan(0);
    expect(readText("bun.lock")).toContain(roxCorePackage);
  });

  test("renames the audit workspace package to the ROX scope", () => {
    const auditPackageJson = readJson("packages/audit/package.json");
    expect(auditPackageJson.name).toBe(roxAuditPackage);

    const activeFiles = [...listFiles("apps"), ...listFiles("packages"), "bun.lock"];
    const legacyMatches = activeFiles.filter((path) => readText(path).includes(legacyAuditPackage));
    expect(legacyMatches).toEqual([]);

    const roxMatches = activeFiles.filter((path) => readText(path).includes(roxAuditPackage));
    expect(roxMatches.length).toBeGreaterThan(0);
    expect(readText("bun.lock")).toContain(roxAuditPackage);
  });

  test("renames the session tools core workspace package to the ROX scope", () => {
    const sessionToolsCorePackageJson = readJson("packages/session-tools-core/package.json");
    expect(sessionToolsCorePackageJson.name).toBe(roxSessionToolsCorePackage);

    const dependencyPackages = [
      "packages/session-mcp-server/package.json",
      "packages/shared/package.json",
    ];

    for (const path of dependencyPackages) {
      const packageJson = readJson(path);
      const dependencies = packageJson.dependencies as Record<string, string>;
      expect(dependencies[roxSessionToolsCorePackage], path).toBe("workspace:*");
      expect(dependencies[legacySessionToolsCorePackage], path).toBeUndefined();
    }

    const activeFiles = [...listFiles("apps"), ...listFiles("packages"), "bun.lock"];
    const legacyMatches = activeFiles.filter((path) => readText(path).includes(legacySessionToolsCorePackage));
    expect(legacyMatches).toEqual([]);

    const roxMatches = activeFiles.filter((path) => readText(path).includes(roxSessionToolsCorePackage));
    expect(roxMatches.length).toBeGreaterThan(0);
    expect(readText("bun.lock")).toContain(roxSessionToolsCorePackage);
  });

  test("renames the session MCP server workspace package to the ROX scope", () => {
    const sessionMcpServerPackageJson = readJson("packages/session-mcp-server/package.json");
    expect(sessionMcpServerPackageJson.name).toBe(roxSessionMcpServerPackage);

    const activeFiles = [...listFiles("apps"), ...listFiles("packages"), "bun.lock"];
    const legacyMatches = activeFiles.filter((path) => readText(path).includes(legacySessionMcpServerPackage));
    expect(legacyMatches).toEqual([]);

    const roxMatches = activeFiles.filter((path) => readText(path).includes(roxSessionMcpServerPackage));
    expect(roxMatches.length).toBeGreaterThan(0);
    expect(readText("bun.lock")).toContain(roxSessionMcpServerPackage);
  });

  test("renames the messaging workspace packages to the ROX scope", () => {
    const messagingGatewayPackageJson = readJson("packages/messaging-gateway/package.json");
    expect(messagingGatewayPackageJson.name).toBe(roxMessagingGatewayPackage);

    const whatsappWorkerPackageJson = readJson("packages/messaging-whatsapp-worker/package.json");
    expect(whatsappWorkerPackageJson.name).toBe(roxMessagingWhatsappWorkerPackage);

    const gatewayDependencyPackages = [
      "apps/electron/package.json",
      "packages/server/package.json",
    ];

    for (const path of gatewayDependencyPackages) {
      const packageJson = readJson(path);
      const dependencies = packageJson.dependencies as Record<string, string>;
      expect(dependencies[roxMessagingGatewayPackage], path).toBe("workspace:*");
      expect(dependencies[legacyMessagingGatewayPackage], path).toBeUndefined();
    }

    const messagingGatewayDependencies = messagingGatewayPackageJson.dependencies as Record<string, string>;
    expect(messagingGatewayDependencies[roxMessagingWhatsappWorkerPackage]).toBe("workspace:*");
    expect(messagingGatewayDependencies[legacyMessagingWhatsappWorkerPackage]).toBeUndefined();

    const activeFiles = [...listFiles("apps"), ...listFiles("packages"), "bun.lock"];
    const legacyGatewayMatches = activeFiles.filter((path) => readText(path).includes(legacyMessagingGatewayPackage));
    expect(legacyGatewayMatches).toEqual([]);

    const legacyWorkerMatches = activeFiles.filter((path) => readText(path).includes(legacyMessagingWhatsappWorkerPackage));
    expect(legacyWorkerMatches).toEqual([]);

    const roxGatewayMatches = activeFiles.filter((path) => readText(path).includes(roxMessagingGatewayPackage));
    expect(roxGatewayMatches.length).toBeGreaterThan(0);

    const roxWorkerMatches = activeFiles.filter((path) => readText(path).includes(roxMessagingWhatsappWorkerPackage));
    expect(roxWorkerMatches.length).toBeGreaterThan(0);

    const lockfile = readText("bun.lock");
    expect(lockfile).toContain(roxMessagingGatewayPackage);
    expect(lockfile).toContain(roxMessagingWhatsappWorkerPackage);
  });

  test("renames the Pi agent server workspace package to the ROX scope", () => {
    const piAgentServerPackageJson = readJson("packages/pi-agent-server/package.json");
    expect(piAgentServerPackageJson.name).toBe(roxPiAgentServerPackage);

    const activeFiles = [...listFiles("apps"), ...listFiles("packages"), "bun.lock"];
    const legacyMatches = activeFiles.filter((path) => readText(path).includes(legacyPiAgentServerPackage));
    expect(legacyMatches).toEqual([]);

    const roxMatches = activeFiles.filter((path) => readText(path).includes(roxPiAgentServerPackage));
    expect(roxMatches.length).toBeGreaterThan(0);
    expect(readText("bun.lock")).toContain(roxPiAgentServerPackage);
  });

  test("renames the server workspace packages to the ROX scope", () => {
    const serverPackageJson = readJson("packages/server/package.json");
    expect(serverPackageJson.name).toBe(roxServerPackage);

    const serverCorePackageJson = readJson("packages/server-core/package.json");
    expect(serverCorePackageJson.name).toBe(roxServerCorePackage);

    const dependencyPackages = [
      "apps/cli/package.json",
      "apps/electron/package.json",
      "packages/messaging-gateway/package.json",
      "packages/server/package.json",
    ];

    for (const path of dependencyPackages) {
      const packageJson = readJson(path);
      const dependencies = packageJson.dependencies as Record<string, string>;
      expect(dependencies[roxServerCorePackage], path).toBe("workspace:*");
      expect(dependencies[legacyServerCorePackage], path).toBeUndefined();
    }

    const activeFiles = [...listFiles("apps"), ...listFiles("packages"), "scripts/build-server.ts", "bun.lock"];
    const legacyServerMatches = activeFiles.filter((path) =>
      containsPackageReference(readText(path), legacyServerPackage),
    );
    expect(legacyServerMatches).toEqual([]);

    const legacyServerCoreMatches = activeFiles.filter((path) =>
      containsPackageReference(readText(path), legacyServerCorePackage),
    );
    expect(legacyServerCoreMatches).toEqual([]);

    const roxServerMatches = activeFiles.filter((path) =>
      containsPackageReference(readText(path), roxServerPackage),
    );
    expect(roxServerMatches.length).toBeGreaterThan(0);

    const roxServerCoreMatches = activeFiles.filter((path) =>
      containsPackageReference(readText(path), roxServerCorePackage),
    );
    expect(roxServerCoreMatches.length).toBeGreaterThan(0);

    const lockfile = readText("bun.lock");
    expect(containsPackageReference(lockfile, roxServerPackage)).toBe(true);
    expect(containsPackageReference(lockfile, roxServerCorePackage)).toBe(true);
  });

  test("renames the shared workspace package to the ROX scope", () => {
    const sharedPackageJson = readJson("packages/shared/package.json");
    expect(sharedPackageJson.name).toBe(roxSharedPackage);

    const dependencyPackages = [
      "apps/cli/package.json",
      "apps/electron/package.json",
      "apps/webui/package.json",
      "packages/messaging-gateway/package.json",
      "packages/server/package.json",
      "packages/server-core/package.json",
      "packages/session-mcp-server/package.json",
      "packages/ui/package.json",
    ];

    for (const path of dependencyPackages) {
      const packageJson = readJson(path);
      const dependencies = packageJson.dependencies as Record<string, string>;
      expect(dependencies[roxSharedPackage], path).toBe("workspace:*");
      expect(dependencies[legacySharedPackage], path).toBeUndefined();
    }

    const activeFiles = [
      ...listFiles("apps"),
      ...listFiles("packages"),
      ...listFiles("scripts"),
      "package.json",
      "bun.lock",
    ];
    const legacyMatches = activeFiles.filter((path) =>
      containsPackageReference(readText(path), legacySharedPackage),
    );
    expect(legacyMatches).toEqual([]);

    const roxMatches = activeFiles.filter((path) =>
      containsPackageReference(readText(path), roxSharedPackage),
    );
    expect(roxMatches.length).toBeGreaterThan(0);
    expect(containsPackageReference(readText("bun.lock"), roxSharedPackage)).toBe(true);
  });

  test("renames the app workspace packages to the ROX scope", () => {
    for (const app of appPackages) {
      const appPackageJson = readJson(`apps/${app}/package.json`);
      expect(appPackageJson.name).toBe(`${roxScope}/${app}`);
    }

    const activeFiles = [
      ...listFiles("apps"),
      ...listFiles("packages"),
      ...listFiles("scripts"),
      "package.json",
      "bun.lock",
    ];

    for (const app of appPackages) {
      const legacyPackage = `${legacyScope}/${app}`;
      const roxPackage = `${roxScope}/${app}`;
      const legacyMatches = activeFiles.filter((path) =>
        containsPackageReference(readText(path), legacyPackage),
      );
      expect(legacyMatches).toEqual([]);

      const roxMatches = activeFiles.filter((path) =>
        containsPackageReference(readText(path), roxPackage),
      );
      expect(roxMatches.length).toBeGreaterThan(0);
      expect(containsPackageReference(readText("bun.lock"), roxPackage)).toBe(true);
    }
  });

  test("keeps active package-scope surfaces free of legacy workspace scope", () => {
    const activeFiles = listPackageScopeCloseoutFiles();
    const legacyMatches = activeFiles.filter((path) => readText(path).includes(`${legacyScope}/`));

    expect(legacyMatches).toEqual([]);
  });
});
