export type CliDomainNamespace = 'label' | 'source' | 'skill' | 'automation' | 'permission' | 'theme'

export interface CliDomainPolicy {
  namespace: CliDomainNamespace
  helpCommand: string
  workspacePathScopes: string[]
  readActions: string[]
  quickExamples: string[]
  /** Optional workspace-relative paths guarded for direct Bash operations */
  bashGuardPaths?: string[]
}

const POLICIES: Record<CliDomainNamespace, CliDomainPolicy> = {
  label: {
    namespace: 'label',
    helpCommand: 'rox-agent label --help',
    workspacePathScopes: ['labels/**'],
    readActions: ['list', 'get', 'auto-rule-list', 'auto-rule-validate'],
    quickExamples: [
      'rox-agent label list',
      'rox-agent label create --name "Bug" --color "accent"',
      'rox-agent label update bug --json \'{"name":"Bug Report"}\'',
    ],
    bashGuardPaths: ['labels/**'],
  },
  source: {
    namespace: 'source',
    helpCommand: 'rox-agent source --help',
    workspacePathScopes: ['sources/**'],
    readActions: ['list', 'get', 'validate', 'test', 'auth-help'],
    quickExamples: [
      'rox-agent source list',
      'rox-agent source get <slug>',
      'rox-agent source update <slug> --json "{...}"',
      'rox-agent source validate <slug>',
    ],
  },
  skill: {
    namespace: 'skill',
    helpCommand: 'rox-agent skill --help',
    workspacePathScopes: ['skills/**'],
    readActions: ['list', 'get', 'validate', 'where'],
    quickExamples: [
      'rox-agent skill list',
      'rox-agent skill get <slug>',
      'rox-agent skill update <slug> --json "{...}"',
      'rox-agent skill validate <slug>',
    ],
  },
  automation: {
    namespace: 'automation',
    helpCommand: 'rox-agent automation --help',
    workspacePathScopes: ['automations.json', 'automations-history.jsonl'],
    readActions: ['list', 'get', 'validate', 'history', 'last-executed', 'test', 'lint'],
    quickExamples: [
      'rox-agent automation list',
      'rox-agent automation create --event UserPromptSubmit --prompt "Summarize this prompt"',
      'rox-agent automation update <id> --json "{\"enabled\":false}"',
      'rox-agent automation history <id> --limit 20',
      'rox-agent automation validate',
    ],
    bashGuardPaths: ['automations.json', 'automations-history.jsonl'],
  },
  permission: {
    namespace: 'permission',
    helpCommand: 'rox-agent permission --help',
    workspacePathScopes: ['permissions.json', 'sources/*/permissions.json'],
    readActions: ['list', 'get', 'validate'],
    quickExamples: [
      'rox-agent permission list',
      'rox-agent permission get --source linear',
      'rox-agent permission add-mcp-pattern "list" --comment "All list ops" --source linear',
      'rox-agent permission validate',
    ],
    bashGuardPaths: ['permissions.json', 'sources/*/permissions.json'],
  },
  theme: {
    namespace: 'theme',
    helpCommand: 'rox-agent theme --help',
    workspacePathScopes: ['config.json', 'theme.json', 'themes/*.json'],
    readActions: ['get', 'validate', 'list-presets', 'get-preset'],
    quickExamples: [
      'rox-agent theme get',
      'rox-agent theme list-presets',
      'rox-agent theme set-color-theme nord',
      'rox-agent theme set-workspace-color-theme default',
      'rox-agent theme set-override --json "{\"accent\":\"#3b82f6\"}"',
    ],
    bashGuardPaths: ['config.json', 'theme.json', 'themes/*.json'],
  },
}

export const CLI_DOMAIN_POLICIES = POLICIES

export interface CliDomainScopeEntry {
  namespace: CliDomainNamespace
  scope: string
}

function dedupeScopes(scopes: string[]): string[] {
  return [...new Set(scopes)]
}

/**
 * Canonical workspace-relative path scopes owned by rox-agent CLI domains.
 * Use these for file-path ownership checks to avoid drift across call sites.
 */
export const ROX_AGENTS_CLI_OWNED_WORKSPACE_PATH_SCOPES = dedupeScopes(
  Object.values(POLICIES).flatMap(policy => policy.workspacePathScopes)
)

/**
 * Canonical workspace-relative path scopes guarded for direct Bash operations.
 */
export const ROX_AGENTS_CLI_OWNED_BASH_GUARD_PATH_SCOPES = dedupeScopes(
  Object.values(POLICIES).flatMap(policy => policy.bashGuardPaths ?? [])
)

/**
 * Namespace-aware workspace scope entries for rox-agent CLI owned paths.
 */
export const ROX_AGENTS_CLI_WORKSPACE_SCOPE_ENTRIES: CliDomainScopeEntry[] = Object.values(POLICIES)
  .flatMap(policy => policy.workspacePathScopes.map(scope => ({ namespace: policy.namespace, scope })))

/**
 * Namespace-aware Bash guard scope entries.
 */
export const ROX_AGENTS_CLI_BASH_GUARD_SCOPE_ENTRIES: CliDomainScopeEntry[] = Object.values(POLICIES)
  .flatMap(policy => (policy.bashGuardPaths ?? []).map(scope => ({ namespace: policy.namespace, scope })))

export interface BashPatternRule {
  pattern: string
  comment: string
}

/**
 * Derive the canonical Explore-mode read-only ROX agent bash patterns from
 * CLI domain policies. Keeps permissions regexes aligned with command metadata.
 */
export function getRoxAgentReadOnlyBashPatterns(): BashPatternRule[] {
  const namespaces = Object.keys(POLICIES) as CliDomainNamespace[]
  const namespaceAlternation = namespaces.join('|')

  const rules: BashPatternRule[] = namespaces.map((namespace) => {
    const policy = POLICIES[namespace]
    const actions = policy.readActions.join('|')
    return {
      pattern: `^rox-agent\\s+${namespace}\\s+(${actions})\\b`,
      comment: `rox-agent ${namespace} read-only operations`,
    }
  })

  rules.push(
    { pattern: '^rox-agent\\s*$', comment: 'rox-agent bare invocation (prints help)' },
    { pattern: `^rox-agent\\s+(${namespaceAlternation})\\s*$`, comment: 'rox-agent entity help' },
    { pattern: `^rox-agent\\s+(${namespaceAlternation})\\s+--help\\b`, comment: 'rox-agent entity help flags' },
    { pattern: '^rox-agent\\s+--(help|version|discover)\\b', comment: 'rox-agent global flags' },
  )

  return rules
}

export function getCliDomainPolicy(namespace: CliDomainNamespace): CliDomainPolicy {
  return POLICIES[namespace]
}
