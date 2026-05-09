/**
 * Cross-platform resources copy script
 */

import { cpSync, existsSync } from "fs";
import { join } from "path";
import {
  copySDK,
  copyPiAgentServer,
  copySessionServer,
  verifySDKCopy,
  verifyMcpServersExist,
  type Arch,
  type BuildConfig,
  type Platform,
} from "./build/common";

const ROOT_DIR = join(import.meta.dir, "..");
const ELECTRON_DIR = join(ROOT_DIR, "apps/electron");

const srcDir = join(ELECTRON_DIR, "resources");
const destDir = join(ELECTRON_DIR, "dist/resources");
function resolvePlatform(): Platform {
  switch (process.platform) {
    case "darwin":
    case "linux":
    case "win32":
      return process.platform;
    default:
      throw new Error(`Unsupported Electron build platform: ${process.platform}`);
  }
}

function resolveArch(): Arch {
  switch (process.arch) {
    case "arm64":
    case "x64":
      return process.arch;
    default:
      throw new Error(`Unsupported Electron build architecture: ${process.arch}`);
  }
}

const config: BuildConfig = {
  platform: resolvePlatform(),
  arch: resolveArch(),
  upload: false,
  uploadLatest: false,
  uploadScript: false,
  rootDir: ROOT_DIR,
  electronDir: ELECTRON_DIR,
};

copySessionServer(config);
copyPiAgentServer(config);
verifyMcpServersExist(config);

if (existsSync(srcDir)) {
  cpSync(srcDir, destDir, { recursive: true, force: true });
  console.log("📦 Copied resources to dist");
} else {
  console.log("⚠️ No resources directory found");
}

copySDK(config);
verifySDKCopy(config);
