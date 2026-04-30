import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { loadLabelConfig, saveLabelConfig } from '../labels/storage';
import type { LabelConfig, WorkspaceLabelConfig } from '../labels/types';
import { getDefaultStatusConfig, loadStatusConfig, saveStatusConfig } from '../statuses/storage';
import type { StatusConfig, WorkspaceStatusConfig } from '../statuses/types';
import { WORKBENCH_BUNDLE_SKILL_SLUGS, type WorkbenchBundleSkillSlug } from './bundle-types';

export { WORKBENCH_BUNDLE_SKILL_SLUGS };
export type { WorkbenchBundleSkillSlug };

export const WORKBENCH_REQUIRED_STATUS_IDS = [
  'inbox',
  'clarifying',
  'planned',
  'running',
  'needs-review',
  'needs-fix',
  'verified',
  'done',
  'archived',
] as const;

export const WORKBENCH_REQUIRED_LABEL_ENTRIES = [
  'mode::rewrite',
  'mode::think',
  'mode::spec',
  'mode::build',
  'mode::review',
  'mode::verify',
  'priority::1',
  'priority::2',
  'priority::3',
  'artifact::prompt',
  'artifact::spec',
  'artifact::code',
  'artifact::report',
  'validation::passed',
  'validation::failed',
  'scope::local',
  'scope::cloud',
  'scope::team',
] as const;

export type WorkbenchRequiredStatusId = typeof WORKBENCH_REQUIRED_STATUS_IDS[number];
export type WorkbenchRequiredLabelEntry = typeof WORKBENCH_REQUIRED_LABEL_ENTRIES[number];

export interface WorkbenchBundleSkill {
  slug: WorkbenchBundleSkillSlug;
  name: string;
  description: string;
  icon: string;
  instructions: string;
}

export interface WorkbenchBundleManifest {
  version: 1;
  skills: WorkbenchBundleSkill[];
  statuses: StatusConfig[];
  labels: LabelConfig[];
  labelEntries: readonly WorkbenchRequiredLabelEntry[];
}

export interface WorkbenchBundleInstallResult {
  createdSkillSlugs: WorkbenchBundleSkillSlug[];
  skippedExistingSkillSlugs: WorkbenchBundleSkillSlug[];
  createdStatusIds: WorkbenchRequiredStatusId[];
  skippedExistingStatusIds: WorkbenchRequiredStatusId[];
  createdLabelIds: string[];
  skippedExistingLabelIds: string[];
}

const STRING_LABEL_VALUE_TYPE = 'string' as NonNullable<LabelConfig['valueType']>;
const NUMBER_LABEL_VALUE_TYPE = 'number' as NonNullable<LabelConfig['valueType']>;

function quoteYaml(value: string): string {
  return JSON.stringify(value);
}

function makeSkill(
  slug: WorkbenchBundleSkillSlug,
  name: string,
  description: string,
  icon: string,
  body: string,
): WorkbenchBundleSkill {
  return {
    slug,
    name,
    description,
    icon,
    instructions: `# ${name}

${body}

## Input contract
- User task, current mode, selected constraints, and relevant workspace artifacts.

## Output contract
- Structured guidance, concrete next actions, risks, and validation expectations.
`,
  };
}

function buildSkills(): WorkbenchBundleSkill[] {
  return [
    makeSkill(
      'prompt-rewriter-pack',
      'Prompt Rewriter Pack',
      'Rewrites raw user prompts into executable, constraint-aware prompts.',
      'wand',
      'Turn vague or overloaded requests into clear roles, objectives, context, deliverables, acceptance criteria, and verification plans.',
    ),
    makeSkill(
      'thinking-partner-pack',
      'Thinking Partner Pack',
      'Frames ambiguous work through hypotheses, roles, questions, and option cards.',
      'brain',
      'Decompose early-stage ideas into assumptions, unknowns, tradeoffs, role perspectives, and selectable requirement candidates.',
    ),
    makeSkill(
      'spec-builder-pack',
      'Spec Builder Pack',
      'Compiles selected requirements into PRDs, task specs, and validation matrices.',
      'list-checks',
      'Convert user-selected options into implementation-ready specs with explicit constraints, deliverables, risks, and acceptance criteria.',
    ),
    makeSkill(
      'multi-agent-planning-pack',
      'Multi-Agent Planning Pack',
      'Plans role-based agent pipelines with safe handoff contracts.',
      'network',
      'Derive agent roles, dependencies, parallel lanes, artifact handoffs, and validation gates from mode plus selected requirements.',
    ),
    makeSkill(
      'review-board-pack',
      'Review Board Pack',
      'Runs structured critique across logic, facts, UX, security, and business value.',
      'shield-check',
      'Inspect artifacts with reviewer roles, severity, evidence, fix recommendations, and pass/warn/fail decisions.',
    ),
    makeSkill(
      'tdd-qa-verification-pack',
      'TDD / QA / Verification Pack',
      'Forces test-first implementation plans and completion evidence.',
      'test-tube',
      'Generate unit, integration, UI, E2E, security, and build validation plans before implementation begins.',
    ),
    makeSkill(
      'research-fact-check-pack',
      'Research / Fact Check Pack',
      'Structures source-backed research and fact verification workflows.',
      'search',
      'Define source requirements, recency needs, citation expectations, evidence quality, and uncertainty boundaries.',
    ),
    makeSkill(
      'founder-strategy-pack',
      'Founder / Strategy Pack',
      'Evaluates product, positioning, monetization, and execution tradeoffs.',
      'rocket',
      'Translate product ideas into strategic options, risks, sequencing, and measurable business outcomes.',
    ),
    makeSkill(
      'design-critique-pack',
      'Design Critique Pack',
      'Reviews interface quality, hierarchy, copy, interaction, and visual coherence.',
      'palette',
      'Critique screens and flows against clarity, information architecture, accessibility, aesthetics, and user intent.',
    ),
    makeSkill(
      'security-compliance-pack',
      'Security / Compliance Pack',
      'Checks RBAC, tenant isolation, secrets, storage, browser/tool permissions, and audit trails.',
      'lock',
      'Surface trust boundaries, deny-by-default cases, quota bypasses, path traversal risks, and secret leakage risks.',
    ),
  ];
}

function categoryFromDefault(statusId: string, fallbackId = 'todo'): StatusConfig['category'] {
  const defaults = getDefaultStatusConfig().statuses;
  return (
    defaults.find((status) => status.id === statusId)?.category ??
    defaults.find((status) => status.id === fallbackId)?.category ??
    defaults[0]!.category
  );
}

function buildStatuses(): StatusConfig[] {
  return [
    {
      id: 'inbox',
      label: 'Inbox',
      icon: 'inbox' as StatusConfig['icon'],
      category: categoryFromDefault('backlog'),
      isFixed: false,
      isDefault: true,
      order: 10,
    },
    {
      id: 'clarifying',
      label: 'Clarifying',
      icon: 'message-circle-question' as StatusConfig['icon'],
      category: categoryFromDefault('todo'),
      isFixed: false,
      isDefault: false,
      order: 20,
    },
    {
      id: 'planned',
      label: 'Planned',
      icon: 'clipboard-list' as StatusConfig['icon'],
      category: categoryFromDefault('todo'),
      isFixed: false,
      isDefault: false,
      order: 30,
    },
    {
      id: 'running',
      label: 'Running',
      icon: 'play-circle' as StatusConfig['icon'],
      category: categoryFromDefault('todo'),
      isFixed: false,
      isDefault: false,
      order: 40,
    },
    {
      id: 'needs-review',
      label: 'Needs Review',
      icon: 'eye' as StatusConfig['icon'],
      category: categoryFromDefault('needs-review'),
      isFixed: false,
      isDefault: false,
      order: 50,
    },
    {
      id: 'needs-fix',
      label: 'Needs Fix',
      icon: 'wrench' as StatusConfig['icon'],
      category: categoryFromDefault('needs-review'),
      isFixed: false,
      isDefault: false,
      order: 60,
    },
    {
      id: 'verified',
      label: 'Verified',
      icon: 'badge-check' as StatusConfig['icon'],
      category: categoryFromDefault('done'),
      isFixed: false,
      isDefault: false,
      order: 70,
    },
    {
      id: 'done',
      label: 'Done',
      icon: 'check-circle' as StatusConfig['icon'],
      category: categoryFromDefault('done'),
      isFixed: false,
      isDefault: false,
      order: 80,
    },
    {
      id: 'archived',
      label: 'Archived',
      icon: 'archive' as StatusConfig['icon'],
      category: categoryFromDefault('cancelled'),
      isFixed: false,
      isDefault: false,
      order: 90,
    },
  ];
}

function buildLabels(): LabelConfig[] {
  return [
    {
      id: 'mode',
      name: 'Mode',
      valueType: STRING_LABEL_VALUE_TYPE,
    },
    {
      id: 'priority',
      name: 'Priority',
      valueType: NUMBER_LABEL_VALUE_TYPE,
    },
    {
      id: 'artifact',
      name: 'Artifact',
      valueType: STRING_LABEL_VALUE_TYPE,
    },
    {
      id: 'validation',
      name: 'Validation',
      valueType: STRING_LABEL_VALUE_TYPE,
    },
    {
      id: 'scope',
      name: 'Scope',
      valueType: STRING_LABEL_VALUE_TYPE,
    },
  ];
}

export function getDefaultWorkbenchBundleManifest(): WorkbenchBundleManifest {
  return {
    version: 1,
    skills: buildSkills(),
    statuses: buildStatuses(),
    labels: buildLabels(),
    labelEntries: WORKBENCH_REQUIRED_LABEL_ENTRIES,
  };
}

function hasStatusConfig(rootPath: string): boolean {
  return existsSync(join(rootPath, 'statuses', 'config.json'));
}

function hasLabelConfig(rootPath: string): boolean {
  return existsSync(join(rootPath, 'labels', 'config.json'));
}

function loadExistingStatusConfig(rootPath: string): WorkspaceStatusConfig {
  if (hasStatusConfig(rootPath)) {
    return loadStatusConfig(rootPath);
  }

  return getDefaultStatusConfig();
}

function loadExistingLabelConfig(rootPath: string): WorkspaceLabelConfig {
  if (hasLabelConfig(rootPath)) {
    return loadLabelConfig(rootPath);
  }

  return {
    version: 1,
    labels: [],
  };
}

function skillToMarkdown(skill: WorkbenchBundleSkill): string {
  return `---
name: ${quoteYaml(skill.name)}
description: ${quoteYaml(skill.description)}
icon: ${quoteYaml(skill.icon)}
---

${skill.instructions}`;
}

export function installDefaultWorkbenchBundle(rootPath: string): WorkbenchBundleInstallResult {
  const manifest = getDefaultWorkbenchBundleManifest();
  const skillsPath = join(rootPath, 'skills');
  mkdirSync(skillsPath, { recursive: true });

  const createdSkillSlugs: WorkbenchBundleSkillSlug[] = [];
  const skippedExistingSkillSlugs: WorkbenchBundleSkillSlug[] = [];

  for (const skill of manifest.skills) {
    const skillDir = join(skillsPath, skill.slug);
    const skillPath = join(skillDir, 'SKILL.md');

    if (existsSync(skillPath)) {
      skippedExistingSkillSlugs.push(skill.slug);
      continue;
    }

    mkdirSync(skillDir, { recursive: true });
    writeFileSync(skillPath, skillToMarkdown(skill));
    createdSkillSlugs.push(skill.slug);
  }

  const statusConfig = loadExistingStatusConfig(rootPath);
  const existingStatusIds = new Set(statusConfig.statuses.map((status) => status.id));
  const createdStatusIds: WorkbenchRequiredStatusId[] = [];
  const skippedExistingStatusIds: WorkbenchRequiredStatusId[] = [];

  for (const status of manifest.statuses) {
    const statusId = status.id as WorkbenchRequiredStatusId;
    if (existingStatusIds.has(status.id)) {
      skippedExistingStatusIds.push(statusId);
      continue;
    }

    statusConfig.statuses.push(status);
    existingStatusIds.add(status.id);
    createdStatusIds.push(statusId);
  }

  if (!statusConfig.defaultStatusId || !existingStatusIds.has(statusConfig.defaultStatusId)) {
    statusConfig.defaultStatusId = 'inbox';
  }

  saveStatusConfig(rootPath, statusConfig);

  const labelConfig = loadExistingLabelConfig(rootPath);
  const existingLabelIds = new Set(labelConfig.labels.map((label) => label.id));
  const createdLabelIds: string[] = [];
  const skippedExistingLabelIds: string[] = [];

  for (const label of manifest.labels) {
    if (existingLabelIds.has(label.id)) {
      skippedExistingLabelIds.push(label.id);
      continue;
    }

    labelConfig.labels.push(label);
    existingLabelIds.add(label.id);
    createdLabelIds.push(label.id);
  }

  saveLabelConfig(rootPath, labelConfig);

  return {
    createdSkillSlugs,
    skippedExistingSkillSlugs,
    createdStatusIds,
    skippedExistingStatusIds,
    createdLabelIds,
    skippedExistingLabelIds,
  };
}
