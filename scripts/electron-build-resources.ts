/**
 * Cross-platform resources copy script
 */

import { cpSync, existsSync, lstatSync, mkdirSync, rmSync } from "fs";
import { dirname, join } from "path";

const ROOT_DIR = join(import.meta.dir, "..");
const ELECTRON_DIR = join(ROOT_DIR, "apps/electron");

const srcDir = join(ELECTRON_DIR, "resources");
const destDir = join(ELECTRON_DIR, "dist/resources");
const sdkSourceDir = join(
  ROOT_DIR,
  "node_modules",
  "@anthropic-ai",
  "claude-agent-sdk",
);
const sdkDestDir = join(
  ELECTRON_DIR,
  "node_modules",
  "@anthropic-ai",
  "claude-agent-sdk",
);
const sdkCliPath = join(sdkDestDir, "cli.js");

if (existsSync(srcDir)) {
  cpSync(srcDir, destDir, { recursive: true, force: true });
  console.log("📦 Copied resources to dist");
} else {
  console.log("⚠️ No resources directory found");
}

if (!existsSync(sdkSourceDir)) {
  throw new Error(`SDK not found at ${sdkSourceDir}. Run 'bun install' first.`);
}

mkdirSync(dirname(sdkDestDir), { recursive: true });
if (existsSync(sdkDestDir)) {
  rmSync(sdkDestDir, { recursive: true, force: true });
}

cpSync(sdkSourceDir, sdkDestDir, {
  recursive: true,
  dereference: true,
  force: true,
});
console.log("📦 Copied claude-agent-sdk into apps/electron/node_modules");

if (!existsSync(sdkCliPath)) {
  throw new Error(`SDK verification failed: cli.js not found at ${sdkCliPath}`);
}

const cliStats = lstatSync(sdkCliPath);
if (cliStats.isSymbolicLink()) {
  throw new Error("SDK verification failed: cli.js is a symlink");
}

if (cliStats.size < 1_000_000) {
  throw new Error(
    `SDK verification failed: cli.js too small (${cliStats.size} bytes)`,
  );
}

console.log(
  `✅ Verified claude-agent-sdk bundle: cli.js is ${(cliStats.size / 1024 / 1024).toFixed(1)} MB`,
);
