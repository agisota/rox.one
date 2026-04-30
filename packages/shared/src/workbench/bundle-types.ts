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
] as const;

export type WorkbenchBundleSkillSlug = typeof WORKBENCH_BUNDLE_SKILL_SLUGS[number];
