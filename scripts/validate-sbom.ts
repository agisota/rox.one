#!/usr/bin/env bun
/**
 * T508: CycloneDX SBOM validator.
 *
 * Checks that a generated SBOM file is structurally valid and meets
 * the minimum quality bar for release gating:
 *   - JSON-parseable
 *   - bomFormat == "CycloneDX"
 *   - specVersion >= 1.5
 *   - at least 100 components listed
 *
 * Usage: bun run scripts/validate-sbom.ts <path-to-sbom.json>
 *
 * Exit 0 on success, exit 1 on any validation failure.
 */
import { existsSync, readFileSync } from 'node:fs';

const MIN_COMPONENTS = 100;
const MIN_SPEC_VERSION = 1.5;

function fail(message: string): never {
  console.error(`[validate-sbom] FAIL: ${message}`);
  process.exit(1);
}

function pass(message: string): void {
  console.log(`[validate-sbom] OK: ${message}`);
}

const [, , sbomPath] = process.argv;

if (!sbomPath) {
  fail('Usage: bun run scripts/validate-sbom.ts <path-to-sbom.json>');
}

if (!existsSync(sbomPath)) {
  fail(`File not found: ${sbomPath}`);
}

// 1. JSON parses
let sbom: Record<string, unknown>;
try {
  const raw = readFileSync(sbomPath, 'utf-8');
  sbom = JSON.parse(raw) as Record<string, unknown>;
} catch (err) {
  fail(`JSON parse failed: ${err instanceof Error ? err.message : String(err)}`);
}

// 2. bomFormat == "CycloneDX"
const bomFormat = sbom['bomFormat'];
if (bomFormat !== 'CycloneDX') {
  fail(`Expected bomFormat "CycloneDX", got: ${JSON.stringify(bomFormat)}`);
}
pass(`bomFormat = "${bomFormat}"`);

// 3. specVersion >= 1.5
const specVersionRaw = sbom['specVersion'];
if (typeof specVersionRaw !== 'string' && typeof specVersionRaw !== 'number') {
  fail(`specVersion missing or wrong type: ${JSON.stringify(specVersionRaw)}`);
}
const specVersion = parseFloat(String(specVersionRaw));
if (isNaN(specVersion)) {
  fail(`specVersion is not a number: ${JSON.stringify(specVersionRaw)}`);
}
if (specVersion < MIN_SPEC_VERSION) {
  fail(`specVersion ${specVersion} < required ${MIN_SPEC_VERSION}`);
}
pass(`specVersion = ${specVersion}`);

// 4. At least 100 components
const components = sbom['components'];
if (!Array.isArray(components)) {
  fail(`components field missing or not an array`);
}
if (components.length < MIN_COMPONENTS) {
  fail(`Only ${components.length} components found; need at least ${MIN_COMPONENTS}`);
}
pass(`components count = ${components.length}`);

console.log(`[validate-sbom] PASS: ${sbomPath} is a valid CycloneDX SBOM`);
