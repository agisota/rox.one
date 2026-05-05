export type WorktreeInventoryEntry = {
  path: string;
  head?: string;
  branch?: string;
  detached?: boolean;
  bare?: boolean;
  prunable: boolean;
  prunableReason?: string;
};

export type WorktreeState = 'clean' | 'dirty' | 'prunable';

export type WorktreeRecommendation = 'keep' | 'investigate' | 'prune-candidate';

export type WorktreeClassification = {
  path: string;
  branch: string | null;
  head: string | null;
  state: WorktreeState;
  merged: boolean;
  upstream: string | null;
  recommendation: WorktreeRecommendation;
  flags: string[];
};

export type WorktreeClassificationContext = {
  dirtyPaths?: string[];
  mergedHeads?: string[];
  upstreamByBranch?: Record<string, string>;
};

export type GitRemotePolicyInput = {
  originUrl: string;
  repoNameWithOwner: string;
  isPrivate: boolean;
  expectedOriginUrl?: string;
  expectedRepoNameWithOwner?: string;
};

export type GitPolicyResult = {
  ok: boolean;
  reasons: string[];
};

export type PushPolicyInput = {
  branch?: string;
  remote?: string;
  force: boolean;
  destructiveApprovalArtifact?: string;
};

export type PushPolicyResult = GitPolicyResult & {
  command: string[] | null;
};

export type StagingAllowlistInput = {
  stagedPaths: string[];
  allowlist: string[];
};

export type StagingAllowlistResult = {
  ok: boolean;
  rejectedPaths: string[];
};

const DEFAULT_PRIVATE_ORIGIN_URL = 'https://github.com/agisota/rox-one-terminal.git';
const DEFAULT_PRIVATE_REPO = 'agisota/rox-one-terminal';

export function parseWorktreePorcelain(output: string): WorktreeInventoryEntry[] {
  return output
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map(parseWorktreeBlock);
}

function parseWorktreeBlock(block: string): WorktreeInventoryEntry {
  const entry: WorktreeInventoryEntry = {
    path: '',
    prunable: false,
  };

  for (const line of block.split('\n')) {
    if (line.startsWith('worktree ')) {
      entry.path = line.slice('worktree '.length).trim();
      continue;
    }

    if (line.startsWith('HEAD ')) {
      entry.head = line.slice('HEAD '.length).trim();
      continue;
    }

    if (line.startsWith('branch ')) {
      entry.branch = normalizeBranchRef(line.slice('branch '.length).trim());
      continue;
    }

    if (line === 'detached') {
      entry.detached = true;
      continue;
    }

    if (line === 'bare') {
      entry.bare = true;
      continue;
    }

    if (line.startsWith('prunable')) {
      entry.prunable = true;
      entry.prunableReason = line.slice('prunable'.length).trim() || undefined;
    }
  }

  if (!entry.path) {
    throw new Error('Invalid git worktree porcelain block: missing worktree path');
  }

  return entry;
}

function normalizeBranchRef(ref: string): string {
  return ref.startsWith('refs/heads/') ? ref.slice('refs/heads/'.length) : ref;
}

export function classifyWorktreeEntry(
  entry: WorktreeInventoryEntry,
  context: WorktreeClassificationContext = {},
): WorktreeClassification {
  const dirtyPaths = new Set(context.dirtyPaths ?? []);
  const mergedHeads = new Set(context.mergedHeads ?? []);
  const branch = entry.branch ?? null;
  const upstream = branch ? (context.upstreamByBranch ?? {})[branch] ?? null : null;
  const dirty = dirtyPaths.has(entry.path);
  const merged = entry.head ? mergedHeads.has(entry.head) : false;
  const flags: string[] = [];

  if (entry.prunable) flags.push('prunable');
  if (dirty) flags.push('dirty');
  if (merged) flags.push('merged');
  if (!merged) flags.push('unmerged');
  if (!upstream) flags.push('missing-upstream');

  const state: WorktreeState = entry.prunable ? 'prunable' : dirty ? 'dirty' : 'clean';
  const recommendation: WorktreeRecommendation =
    state === 'prunable' && merged && !dirty
      ? 'prune-candidate'
      : dirty || !merged
        ? 'investigate'
        : 'keep';

  return {
    path: entry.path,
    branch,
    head: entry.head ?? null,
    state,
    merged,
    upstream,
    recommendation,
    flags,
  };
}

export function validatePrivateOriginPolicy(input: GitRemotePolicyInput): GitPolicyResult {
  const expectedOriginUrl = input.expectedOriginUrl ?? DEFAULT_PRIVATE_ORIGIN_URL;
  const expectedRepoNameWithOwner = input.expectedRepoNameWithOwner ?? DEFAULT_PRIVATE_REPO;
  const reasons: string[] = [];

  if (input.originUrl !== expectedOriginUrl) {
    reasons.push('origin-url-mismatch');
  }

  if (input.repoNameWithOwner !== expectedRepoNameWithOwner) {
    reasons.push('repo-name-mismatch');
  }

  if (!input.isPrivate) {
    reasons.push('repo-not-private');
  }

  return {
    ok: reasons.length === 0,
    reasons,
  };
}

export function validatePushPolicy(input: PushPolicyInput): PushPolicyResult {
  const remote = input.remote ?? 'origin';
  const branch = input.branch ?? 'main';

  if (input.force && !input.destructiveApprovalArtifact) {
    return {
      ok: false,
      command: null,
      reasons: ['force-push-blocked'],
    };
  }

  return {
    ok: true,
    command: input.force
      ? ['git', 'push', '--force-with-lease', remote, branch]
      : ['git', 'push', remote, branch],
    reasons: [],
  };
}

export function validateStagingAllowlist(input: StagingAllowlistInput): StagingAllowlistResult {
  const rejectedPaths = input.stagedPaths.filter(
    (stagedPath) => !input.allowlist.some((allowedPattern) => matchesAllowlistPattern(stagedPath, allowedPattern)),
  );

  return {
    ok: rejectedPaths.length === 0,
    rejectedPaths,
  };
}

function matchesAllowlistPattern(path: string, pattern: string): boolean {
  if (pattern === path) {
    return true;
  }

  const regex = new RegExp(`^${escapeForRegex(pattern).replaceAll('*', '[^/]*')}$`);
  return regex.test(path);
}

function escapeForRegex(value: string): string {
  return value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
}
