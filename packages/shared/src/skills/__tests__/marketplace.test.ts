import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  WORKBENCH_BUNDLE_SKILL_SLUGS,
  installDefaultWorkbenchBundle,
} from '../../workbench/default-workspace-bundle.ts';
import {
  SKILL_MARKETPLACE_ACCOUNT_LIMITED_MESSAGE,
  getSkillMarketplaceCatalog,
  installSkillMarketplaceEntry,
} from '../marketplace.ts';
import { loadWorkspaceSkills } from '../storage.ts';

let tempDir: string;
let workspaceRoot: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'skill-marketplace-test-'));
  workspaceRoot = join(tempDir, 'workspace');
});

afterEach(() => {
  if (tempDir && existsSync(tempDir)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

describe('skill marketplace catalog', () => {
  it('includes every bundled starter skill as an installable marketplace entry', () => {
    const catalog = getSkillMarketplaceCatalog();
    const bundledEntries = catalog.filter((entry) => entry.origin === 'bundled');

    expect(bundledEntries).toHaveLength(20);
    expect(bundledEntries.map((entry) => entry.slug).sort()).toEqual([...WORKBENCH_BUNDLE_SKILL_SLUGS].sort());
    expect(bundledEntries.every((entry) => entry.installable)).toBe(true);
    expect(bundledEntries.every((entry) => entry.installState === 'available')).toBe(true);
    expect(bundledEntries.every((entry) => entry.sourceLabel === 'ROX.ONE starter bundle')).toBe(true);
    expect(new Set(catalog.map((entry) => entry.id)).size).toBe(catalog.length);
  });

  it('overlays installed state from a workspace with the default bundle installed', () => {
    installDefaultWorkbenchBundle(workspaceRoot);

    const catalog = getSkillMarketplaceCatalog({ workspaceRoot });
    const bundledEntries = catalog.filter((entry) => entry.origin === 'bundled');

    expect(bundledEntries).toHaveLength(20);
    expect(bundledEntries.every((entry) => entry.installState === 'installed')).toBe(true);
  });

  it('keeps account-limited external catalog entries explicit', () => {
    const externalEntries = getSkillMarketplaceCatalog().filter((entry) => entry.origin === 'zed-catalog');

    expect(externalEntries.length).toBeGreaterThanOrEqual(4);
    expect(externalEntries.every((entry) => entry.installable === false)).toBe(true);
    expect(externalEntries.every((entry) => entry.installState === 'account-limited')).toBe(true);
    expect(externalEntries.every((entry) => entry.availabilityNote?.includes(SKILL_MARKETPLACE_ACCOUNT_LIMITED_MESSAGE))).toBe(true);
  });

  it('installs a bundled marketplace entry without overwriting a user-edited skill', () => {
    const created = installSkillMarketplaceEntry(workspaceRoot, 'artifact-editor-pack');

    expect(created).toEqual({ status: 'created', slug: 'artifact-editor-pack' });
    expect(loadWorkspaceSkills(workspaceRoot).map((skill) => skill.slug)).toContain('artifact-editor-pack');
    expect(readFileSync(join(workspaceRoot, 'skills', 'artifact-editor-pack', 'SKILL.md'), 'utf8')).toContain('Artifact Editor Pack');

    writeFileSync(join(workspaceRoot, 'skills', 'artifact-editor-pack', 'SKILL.md'), `---
name: "Custom Artifact Editor"
description: "User-edited skill"
---

Preserve this custom version.
`);

    const skipped = installSkillMarketplaceEntry(workspaceRoot, 'artifact-editor-pack');

    expect(skipped).toEqual({ status: 'skipped-existing', slug: 'artifact-editor-pack' });
    expect(readFileSync(join(workspaceRoot, 'skills', 'artifact-editor-pack', 'SKILL.md'), 'utf8')).toContain('Preserve this custom version.');
  });

  it('does not install account-limited external entries', () => {
    const external = getSkillMarketplaceCatalog().find((entry) => entry.origin === 'zed-catalog');
    expect(external).toBeDefined();

    const result = installSkillMarketplaceEntry(workspaceRoot, external!.id);

    expect(result).toEqual({
      status: 'unavailable',
      slug: external!.slug,
      reason: SKILL_MARKETPLACE_ACCOUNT_LIMITED_MESSAGE,
    });
    expect(loadWorkspaceSkills(workspaceRoot)).toHaveLength(0);
  });
});
