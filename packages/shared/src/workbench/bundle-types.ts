export const WORKBENCH_BUNDLE_SKILL_SLUGS = [
  'prompt-rewriter-pack',
  'thinking-partner-pack',
  'spec-builder-pack',
  'multi-agent-planning-pack',
  'review-board-pack',
  'tdd-qa-verification-pack',
  'research-fact-check-pack',
  'founder-strategy-pack',
  'design-critique-pack',
  'security-compliance-pack',
  'code-review-agent-pack',
  'debugger-agent-pack',
  'release-manager-pack',
  'docs-writer-pack',
  'frontend-polish-pack',
  'backend-api-pack',
  'data-analysis-pack',
  'customer-support-pack',
  'automation-builder-pack',
  'artifact-editor-pack',
] as const;

export type WorkbenchBundleSkillSlug = typeof WORKBENCH_BUNDLE_SKILL_SLUGS[number];
