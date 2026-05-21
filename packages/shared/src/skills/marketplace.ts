import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import {
  getDefaultWorkbenchBundleManifest,
  type WorkbenchBundleSkill,
} from '../workbench/default-workspace-bundle.ts';
import type { WorkbenchBundleSkillSlug } from '../workbench/bundle-types.ts';
import { getWorkspaceSkillsPath } from '../workspaces/storage.ts';
import { invalidateSkillsCache, loadActiveSkills, skillExists } from './storage.ts';

export const SKILL_MARKETPLACE_ACCOUNT_LIMITED_MESSAGE = 'Skill not found or unavailable to this account.';

export type SkillMarketplaceOrigin = 'bundled' | 'zed-catalog';
export type SkillMarketplaceInstallState = 'available' | 'installed' | 'account-limited';
export type SkillMarketplaceCategory =
  | 'prompting'
  | 'planning'
  | 'review'
  | 'verification'
  | 'research'
  | 'strategy'
  | 'design'
  | 'security'
  | 'engineering'
  | 'release'
  | 'documentation'
  | 'data'
  | 'support'
  | 'automation'
  | 'artifact'
  | 'external-catalog';

export interface SkillMarketplaceEntry {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  category: SkillMarketplaceCategory;
  origin: SkillMarketplaceOrigin;
  sourceLabel: string;
  recommended: boolean;
  installable: boolean;
  installState: SkillMarketplaceInstallState;
  availabilityNote?: string;
}

export interface SkillMarketplaceCatalogOptions {
  workspaceRoot?: string;
  projectRoot?: string;
}

export type SkillMarketplaceInstallResult =
  | { status: 'created'; slug: string }
  | { status: 'skipped-existing'; slug: string }
  | { status: 'unavailable'; slug: string; reason: string }
  | { status: 'not-found'; entryId: string; reason: string };

interface SkillMarketplaceSeed extends Omit<SkillMarketplaceEntry, 'installState'> {
  defaultInstallState: SkillMarketplaceInstallState;
  markdown?: string;
}

const BUNDLED_SKILL_CATEGORIES: Record<WorkbenchBundleSkillSlug, SkillMarketplaceCategory> = {
  'prompt-rewriter-pack': 'prompting',
  'thinking-partner-pack': 'planning',
  'spec-builder-pack': 'planning',
  'multi-agent-planning-pack': 'planning',
  'review-board-pack': 'review',
  'tdd-qa-verification-pack': 'verification',
  'research-fact-check-pack': 'research',
  'founder-strategy-pack': 'strategy',
  'design-critique-pack': 'design',
  'security-compliance-pack': 'security',
  'code-review-agent-pack': 'engineering',
  'debugger-agent-pack': 'engineering',
  'release-manager-pack': 'release',
  'docs-writer-pack': 'documentation',
  'frontend-polish-pack': 'design',
  'backend-api-pack': 'engineering',
  'data-analysis-pack': 'data',
  'customer-support-pack': 'support',
  'automation-builder-pack': 'automation',
  'artifact-editor-pack': 'artifact',
};

const EXTERNAL_ACCOUNT_LIMITED_SEEDS: SkillMarketplaceSeed[] = [
  makeExternalAccountLimitedSeed(
    'zed:autopilot',
    'autopilot',
    'Autopilot',
    'Autonomous multi-step execution workflow from the external ZED skill catalog.',
  ),
  makeExternalAccountLimitedSeed(
    'zed:deepsearch',
    'deepsearch',
    'Deep Search',
    'Source-backed research workflow from the external ZED skill catalog.',
  ),
  makeExternalAccountLimitedSeed(
    'zed:code-review',
    'code-review',
    'Code Review',
    'Diff and implementation review workflow from the external ZED skill catalog.',
  ),
  makeExternalAccountLimitedSeed(
    'zed:browser-use',
    'browser-use',
    'Browser Use',
    'Browser automation helper from the external ZED skill catalog.',
  ),
  makeExternalAccountLimitedSeed(
    'zed:context-save',
    'context-save',
    'Context Save',
    'Session context persistence helper from the external ZED skill catalog.',
  ),
];

function quoteYaml(value: string): string {
  return JSON.stringify(value);
}

function skillToMarkdown(skill: WorkbenchBundleSkill): string {
  return `---
name: ${quoteYaml(skill.name)}
description: ${quoteYaml(skill.description)}
icon: ${quoteYaml(skill.icon)}
---

${skill.instructions}`;
}

function makeBundledSeed(skill: WorkbenchBundleSkill): SkillMarketplaceSeed {
  return {
    id: skill.slug,
    slug: skill.slug,
    name: skill.name,
    description: skill.description,
    icon: skill.icon,
    category: BUNDLED_SKILL_CATEGORIES[skill.slug],
    origin: 'bundled',
    sourceLabel: 'ROX.ONE starter bundle',
    recommended: true,
    installable: true,
    defaultInstallState: 'available',
    markdown: skillToMarkdown(skill),
  };
}

function makeExternalAccountLimitedSeed(
  id: string,
  slug: string,
  name: string,
  description: string,
): SkillMarketplaceSeed {
  return {
    id,
    slug,
    name,
    description,
    icon: '🔒',
    category: 'external-catalog',
    origin: 'zed-catalog',
    sourceLabel: 'skills.api.zed.md',
    recommended: false,
    installable: false,
    defaultInstallState: 'account-limited',
    availabilityNote: SKILL_MARKETPLACE_ACCOUNT_LIMITED_MESSAGE,
  };
}

function buildMarketplaceSeeds(): SkillMarketplaceSeed[] {
  return [
    ...getDefaultWorkbenchBundleManifest().skills.map(makeBundledSeed),
    ...EXTERNAL_ACCOUNT_LIMITED_SEEDS,
  ];
}

function toPublicEntry(seed: SkillMarketplaceSeed, installedSlugs: Set<string>): SkillMarketplaceEntry {
  return {
    id: seed.id,
    slug: seed.slug,
    name: seed.name,
    description: seed.description,
    icon: seed.icon,
    category: seed.category,
    origin: seed.origin,
    sourceLabel: seed.sourceLabel,
    recommended: seed.recommended,
    installable: seed.installable,
    installState: installedSlugs.has(seed.slug) ? 'installed' : seed.defaultInstallState,
    availabilityNote: seed.availabilityNote,
  };
}

export function getSkillMarketplaceCatalog(options: SkillMarketplaceCatalogOptions = {}): SkillMarketplaceEntry[] {
  const installedSlugs = options.workspaceRoot
    ? new Set(loadActiveSkills(options.workspaceRoot, options.projectRoot).map((skill) => skill.slug))
    : new Set<string>();

  return buildMarketplaceSeeds().map((seed) => toPublicEntry(seed, installedSlugs));
}

export function installSkillMarketplaceEntry(workspaceRoot: string, entryId: string): SkillMarketplaceInstallResult {
  const seed = buildMarketplaceSeeds().find((entry) => entry.id === entryId || entry.slug === entryId);

  if (!seed) {
    return {
      status: 'not-found',
      entryId,
      reason: 'Skill marketplace entry not found.',
    };
  }

  if (!seed.installable || !seed.markdown) {
    return {
      status: 'unavailable',
      slug: seed.slug,
      reason: seed.availabilityNote ?? 'This marketplace entry is not locally installable.',
    };
  }

  if (skillExists(workspaceRoot, seed.slug)) {
    return {
      status: 'skipped-existing',
      slug: seed.slug,
    };
  }

  const skillDir = join(getWorkspaceSkillsPath(workspaceRoot), seed.slug);
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(join(skillDir, 'SKILL.md'), seed.markdown);
  invalidateSkillsCache();

  return {
    status: 'created',
    slug: seed.slug,
  };
}
