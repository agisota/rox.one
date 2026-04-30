import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { loadLabelConfig } from '../../labels/storage.ts';
import { loadWorkspaceSkills } from '../../skills/storage.ts';
import { loadStatusConfig } from '../../statuses/storage.ts';
import { createWorkspaceAtPath } from '../../workspaces/storage.ts';
import {
  WORKBENCH_BUNDLE_SKILL_SLUGS,
  WORKBENCH_REQUIRED_LABEL_ENTRIES,
  WORKBENCH_REQUIRED_STATUS_IDS,
  getDefaultWorkbenchBundleManifest,
  installDefaultWorkbenchBundle,
} from '../default-workspace-bundle.ts';

let tempDir: string;
let workspaceRoot: string;

const WORKBENCH_STATUSES_MISSING_FROM_REPO_DEFAULTS = [
  'inbox',
  'clarifying',
  'planned',
  'running',
  'needs-fix',
  'verified',
  'archived',
] as const;

function readSkill(slug: string): string {
  return readFileSync(join(workspaceRoot, 'skills', slug, 'SKILL.md'), 'utf8');
}

function skillCount(): number {
  return loadWorkspaceSkills(workspaceRoot).length;
}

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'workbench-bundle-test-'));
  workspaceRoot = join(tempDir, 'workspace');
});

afterEach(() => {
  if (tempDir && existsSync(tempDir)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

describe('default Agent Workbench workspace bundle', () => {
  it('defines the required stable skill, status, and label entries', () => {
    const manifest = getDefaultWorkbenchBundleManifest();

    expect(manifest.skills.map((skill) => skill.slug)).toEqual([...WORKBENCH_BUNDLE_SKILL_SLUGS]);
    expect(manifest.statuses.map((status) => status.id)).toEqual([...WORKBENCH_REQUIRED_STATUS_IDS]);
    expect(manifest.labelEntries).toEqual([...WORKBENCH_REQUIRED_LABEL_ENTRIES]);
    expect(manifest.skills).toHaveLength(10);

    for (const skill of manifest.skills) {
      expect(skill.name.length).toBeGreaterThan(0);
      expect(skill.description.length).toBeGreaterThan(0);
      expect(skill.instructions).toContain('Input contract');
      expect(skill.instructions).toContain('Output contract');
    }
  });

  it('installs skills, statuses, and labels into an empty workspace directory', () => {
    const result = installDefaultWorkbenchBundle(workspaceRoot);

    expect(result.createdSkillSlugs).toEqual([...WORKBENCH_BUNDLE_SKILL_SLUGS]);
    expect(result.skippedExistingSkillSlugs).toEqual([]);
    expect(result.createdStatusIds).toEqual([...WORKBENCH_STATUSES_MISSING_FROM_REPO_DEFAULTS]);
    expect(result.createdLabelIds).toEqual(['mode', 'priority', 'artifact', 'validation', 'scope']);
    expect(skillCount()).toBe(10);

    const skills = loadWorkspaceSkills(workspaceRoot);
    expect(skills.map((skill) => skill.slug).sort()).toEqual([...WORKBENCH_BUNDLE_SKILL_SLUGS].sort());
    expect(skills.every((skill) => skill.metadata.name && skill.metadata.description)).toBe(true);

    const statusConfig = loadStatusConfig(workspaceRoot);
    expect(WORKBENCH_REQUIRED_STATUS_IDS.every((statusId) => statusConfig.statuses.some((status) => status.id === statusId))).toBe(true);

    const labelConfig = loadLabelConfig(workspaceRoot);
    expect(labelConfig.labels.some((label) => label.id === 'mode' && label.valueType === 'string')).toBe(true);
    expect(labelConfig.labels.some((label) => label.id === 'priority' && label.valueType === 'number')).toBe(true);
    expect(labelConfig.labels.some((label) => label.id === 'artifact' && label.valueType === 'string')).toBe(true);
    expect(labelConfig.labels.some((label) => label.id === 'validation' && label.valueType === 'string')).toBe(true);
    expect(labelConfig.labels.some((label) => label.id === 'scope' && label.valueType === 'string')).toBe(true);
  });

  it('is idempotent when run twice', () => {
    installDefaultWorkbenchBundle(workspaceRoot);
    const secondResult = installDefaultWorkbenchBundle(workspaceRoot);

    expect(secondResult.createdSkillSlugs).toEqual([]);
    expect(secondResult.skippedExistingSkillSlugs).toEqual([...WORKBENCH_BUNDLE_SKILL_SLUGS]);
    expect(secondResult.createdStatusIds).toEqual([]);
    expect(secondResult.createdLabelIds).toEqual([]);
    expect(skillCount()).toBe(10);

    const statusIds = loadStatusConfig(workspaceRoot).statuses.map((status) => status.id);
    expect(new Set(statusIds).size).toBe(statusIds.length);

    const labelIds = loadLabelConfig(workspaceRoot).labels.map((label) => label.id);
    expect(new Set(labelIds).size).toBe(labelIds.length);
  });

  it('does not overwrite existing user-edited workspace skills', () => {
    mkdirSync(join(workspaceRoot, 'skills', 'prompt-rewriter-pack'), { recursive: true });
    writeFileSync(join(workspaceRoot, 'skills', 'prompt-rewriter-pack', 'SKILL.md'), `---
name: "Custom Prompt Rewriter"
description: "User edited skill"
---

Preserve this custom instruction.
`);

    const result = installDefaultWorkbenchBundle(workspaceRoot);

    expect(result.skippedExistingSkillSlugs).toContain('prompt-rewriter-pack');
    expect(readSkill('prompt-rewriter-pack')).toContain('Preserve this custom instruction.');
    expect(loadWorkspaceSkills(workspaceRoot).find((skill) => skill.slug === 'prompt-rewriter-pack')?.metadata.name).toBe('Custom Prompt Rewriter');
  });

  it('seeds the bundle during workspace creation', () => {
    createWorkspaceAtPath(workspaceRoot, 'Bundled Workspace');

    expect(skillCount()).toBe(10);
    expect(WORKBENCH_REQUIRED_STATUS_IDS.every((statusId) => loadStatusConfig(workspaceRoot).statuses.some((status) => status.id === statusId))).toBe(true);
    expect(loadLabelConfig(workspaceRoot).labels.some((label) => label.id === 'mode' && label.valueType === 'string')).toBe(true);
  });
});
