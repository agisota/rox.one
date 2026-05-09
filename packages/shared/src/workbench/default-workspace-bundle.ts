import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { loadLabelConfig, saveLabelConfig } from '../labels/storage';
import type { LabelConfig, WorkspaceLabelConfig } from '../labels/types';
import { getDefaultStatusConfig, loadStatusConfig, saveStatusConfig } from '../statuses/storage';
import type { StatusConfig, WorkspaceStatusConfig } from '../statuses/types';
import type { EntityColor } from '../colors/types';
import type { FolderSourceConfig } from '../sources/types';
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

export const WORKBENCH_MCP_SOURCE_PRESET_SLUGS = [
  'exa',
  'byterover',
  'firecrawl',
  'github',
  'playwright',
  'zai-mcp-server',
] as const;

export type WorkbenchRequiredStatusId = typeof WORKBENCH_REQUIRED_STATUS_IDS[number];
export type WorkbenchRequiredLabelEntry = typeof WORKBENCH_REQUIRED_LABEL_ENTRIES[number];
export type WorkbenchMcpSourcePresetSlug = typeof WORKBENCH_MCP_SOURCE_PRESET_SLUGS[number];

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
  sourcePresets: WorkbenchMcpSourcePreset[];
}

export interface WorkbenchBundleInstallResult {
  createdSkillSlugs: WorkbenchBundleSkillSlug[];
  skippedExistingSkillSlugs: WorkbenchBundleSkillSlug[];
  createdSourceSlugs: WorkbenchMcpSourcePresetSlug[];
  skippedExistingSourceSlugs: WorkbenchMcpSourcePresetSlug[];
  createdStatusIds: WorkbenchRequiredStatusId[];
  skippedExistingStatusIds: WorkbenchRequiredStatusId[];
  createdLabelIds: string[];
  skippedExistingLabelIds: string[];
}

interface WorkbenchMcpSourcePreset {
  config: FolderSourceConfig & { slug: WorkbenchMcpSourcePresetSlug };
  guide: string;
  permissions: {
    allowedMcpPatterns: Array<{ pattern: string; comment: string }>;
  };
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

function makeStdioSourcePreset(
  slug: WorkbenchMcpSourcePresetSlug,
  name: string,
  provider: string,
  command: string,
  args: string[],
  guide: string,
  patterns: Array<{ pattern: string; comment: string }>,
  options?: {
    icon?: string;
    tagline?: string;
    brandColor?: EntityColor;
    needsAuth?: boolean;
  },
): WorkbenchMcpSourcePreset {
  return {
    config: {
      id: `source_${slug}`,
      name,
      slug,
      enabled: true,
      provider,
      type: 'mcp',
      mcp: {
        transport: 'stdio',
        command,
        args,
      },
      icon: options?.icon,
      tagline: options?.tagline,
      brand: options?.brandColor ? { color: options.brandColor } : undefined,
      isAuthenticated: options?.needsAuth ? false : true,
      connectionStatus: options?.needsAuth ? 'needs_auth' : 'untested',
    },
    guide,
    permissions: {
      allowedMcpPatterns: patterns,
    },
  };
}

function buildSourcePresets(): WorkbenchMcpSourcePreset[] {
  return [
    makeStdioSourcePreset(
      'exa',
      'Exa',
      'exa',
      'npx',
      ['-y', 'exa-mcp-server'],
      `# Exa

Research search and web discovery through the Exa MCP server.

## Scope
- Use for web search, research discovery, source finding, and citation leads.
- Requires \`EXA_API_KEY\` in the app process environment or source credential flow before live validation.

## Guidelines
- Prefer precise research queries and cite retrieved sources.
- Do not use this source for local filesystem search.
`,
      [
        { pattern: 'search*', comment: 'Read-only web and neural search.' },
        { pattern: 'web_search*', comment: 'Read-only web search.' },
        { pattern: 'get_contents*', comment: 'Fetch selected result contents.' },
      ],
      {
        icon: 'EXA',
        tagline: 'Research search and source discovery via Exa MCP.',
        brandColor: { light: '#2563eb', dark: '#60a5fa' },
        needsAuth: true,
      },
    ),
    makeStdioSourcePreset(
      'byterover',
      'ByteRover',
      'byterover',
      'npx',
      ['-y', 'byterover-mcp'],
      `# ByteRover

Knowledge memory layer for agent context and project decisions.

## Scope
- Use for querying curated context, project patterns, and prior decisions.
- Local ByteRover CLI \`brv\` can manage the same context tree outside the app.

## Guidelines
- Query before broad architectural work.
- Store only sanitized project knowledge; do not store secrets or raw credentials.
`,
      [
        { pattern: 'search*', comment: 'Read-only memory/context search.' },
        { pattern: 'query*', comment: 'Read-only context query.' },
        { pattern: 'list*', comment: 'Read-only context inventory.' },
      ],
      {
        icon: 'BR',
        tagline: 'Project memory and context retrieval via ByteRover MCP.',
        brandColor: { light: '#7c3aed', dark: '#a78bfa' },
      },
    ),
    makeStdioSourcePreset(
      'firecrawl',
      'Firecrawl',
      'firecrawl',
      'npx',
      ['-y', 'firecrawl-mcp'],
      `# Firecrawl

Web crawl, scrape, and extraction source for research workflows.

## Scope
- Use for targeted crawling, page extraction, and structured web snapshots.
- Requires \`FIRECRAWL_API_KEY\` in the app process environment before live validation.

## Guidelines
- Keep crawls narrow and source-specific.
- Respect robots, rate limits, and site terms.
`,
      [
        { pattern: 'scrape*', comment: 'Fetch one selected page.' },
        { pattern: 'crawl*', comment: 'Run bounded crawls only.' },
        { pattern: 'map*', comment: 'Map site links for planning.' },
      ],
      {
        icon: 'FC',
        tagline: 'Targeted web crawl and extraction via Firecrawl MCP.',
        brandColor: { light: '#ea580c', dark: '#fb923c' },
        needsAuth: true,
      },
    ),
    makeStdioSourcePreset(
      'github',
      'GitHub',
      'github',
      'docker',
      ['run', '-i', '--rm', '-e', 'GITHUB_PERSONAL_ACCESS_TOKEN', 'ghcr.io/github/github-mcp-server'],
      `# GitHub

Repository, issue, pull request, and code-hosting context via GitHub MCP.

## Scope
- Use for repository lookup, issue/PR triage, and source-backed GitHub context.
- Requires \`GITHUB_PERSONAL_ACCESS_TOKEN\` in the app process environment before live validation.

## Guidelines
- Treat write actions as explicit user intent only.
- Prefer read-only lookup for default planning and review flows.
`,
      [
        { pattern: 'search*', comment: 'Read-only repository and issue search.' },
        { pattern: 'get*', comment: 'Read-only GitHub object retrieval.' },
        { pattern: 'list*', comment: 'Read-only GitHub inventory.' },
      ],
      {
        icon: 'GH',
        tagline: 'GitHub repository, issue, and PR context.',
        brandColor: { light: '#24292f', dark: '#f0f6fc' },
        needsAuth: true,
      },
    ),
    makeStdioSourcePreset(
      'playwright',
      'Playwright',
      'playwright',
      'npx',
      ['-y', '@playwright/mcp@latest', '--browser', 'chrome', '--caps', 'vision,pdf,devtools'],
      `# Playwright

Browser automation and visual evidence source for local or remote UI checks.

## Scope
- Use for navigation, screenshots, UI smoke checks, PDF capture, and devtools-backed inspection.
- Prefer bounded smoke evidence over open-ended browsing.

## Guidelines
- Capture screenshots or trace evidence for UI claims.
- Do not use this source for credential entry unless the user explicitly directs it.
`,
      [
        { pattern: 'browser_*', comment: 'Browser automation and inspection.' },
        { pattern: 'page_*', comment: 'Page-level read/check operations.' },
        { pattern: 'screenshot*', comment: 'Visual evidence capture.' },
      ],
      {
        icon: 'PW',
        tagline: 'Browser automation and UI evidence via Playwright MCP.',
        brandColor: { light: '#16a34a', dark: '#4ade80' },
      },
    ),
    makeStdioSourcePreset(
      'zai-mcp-server',
      'Z.AI',
      'zai',
      'npx',
      ['-y', '@z_ai/mcp-server'],
      `# Z.AI

Z.AI model/tooling bridge through the local MCP server.

## Scope
- Use only when a workflow explicitly needs Z.AI-backed model/tool context.
- Requires \`Z_AI_API_KEY\` in the app process environment before live validation.

## Guidelines
- Keep this source opt-in at the session/source selection layer.
- Do not route sensitive prompts through it without explicit user intent.
`,
      [
        { pattern: 'list*', comment: 'Read-only capability inventory.' },
        { pattern: 'get*', comment: 'Read-only model/tool metadata.' },
        { pattern: 'search*', comment: 'Read-only lookup operations.' },
      ],
      {
        icon: 'Z',
        tagline: 'Z.AI MCP bridge for opt-in model/tool workflows.',
        brandColor: { light: '#0891b2', dark: '#67e8f9' },
        needsAuth: true,
      },
    ),
  ];
}

export function getDefaultWorkbenchBundleManifest(): WorkbenchBundleManifest {
  return {
    version: 1,
    skills: buildSkills(),
    statuses: buildStatuses(),
    labels: buildLabels(),
    labelEntries: WORKBENCH_REQUIRED_LABEL_ENTRIES,
    sourcePresets: buildSourcePresets(),
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

function sourceExists(rootPath: string, slug: string): boolean {
  return existsSync(join(rootPath, 'sources', slug, 'config.json'));
}

function installSourcePreset(rootPath: string, preset: WorkbenchMcpSourcePreset, now: number): void {
  const sourceDir = join(rootPath, 'sources', preset.config.slug);
  mkdirSync(sourceDir, { recursive: true });
  writeFileSync(join(sourceDir, 'config.json'), JSON.stringify({
    ...preset.config,
    createdAt: preset.config.createdAt ?? now,
    updatedAt: now,
  }, null, 2));
  writeFileSync(join(sourceDir, 'guide.md'), preset.guide);
  writeFileSync(join(sourceDir, 'permissions.json'), JSON.stringify(preset.permissions, null, 2));
}

export function installDefaultWorkbenchBundle(rootPath: string): WorkbenchBundleInstallResult {
  const manifest = getDefaultWorkbenchBundleManifest();
  const skillsPath = join(rootPath, 'skills');
  mkdirSync(skillsPath, { recursive: true });

  const createdSkillSlugs: WorkbenchBundleSkillSlug[] = [];
  const skippedExistingSkillSlugs: WorkbenchBundleSkillSlug[] = [];
  const createdSourceSlugs: WorkbenchMcpSourcePresetSlug[] = [];
  const skippedExistingSourceSlugs: WorkbenchMcpSourcePresetSlug[] = [];

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

  const now = Date.now();
  mkdirSync(join(rootPath, 'sources'), { recursive: true });
  for (const sourcePreset of manifest.sourcePresets) {
    const slug = sourcePreset.config.slug;
    if (sourceExists(rootPath, slug)) {
      skippedExistingSourceSlugs.push(slug);
      continue;
    }

    installSourcePreset(rootPath, sourcePreset, now);
    createdSourceSlugs.push(slug);
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
    createdSourceSlugs,
    skippedExistingSourceSlugs,
    createdStatusIds,
    skippedExistingStatusIds,
    createdLabelIds,
    skippedExistingLabelIds,
  };
}
