import { describe, expect, it } from 'bun:test';

import {
  classifyWorktreeEntry,
  parseWorktreePorcelain,
  validatePrivateOriginPolicy,
  validatePushPolicy,
  validateStagingAllowlist,
} from '../git-worktree-integration';

const worktreePorcelain = `worktree /repo/main
HEAD 1111111111111111111111111111111111111111
branch refs/heads/main

worktree /repo/worktrees/T032-github-worktree-integration
HEAD 2222222222222222222222222222222222222222
branch refs/heads/feature/T032-github-worktree-integration

worktree /repo/worktrees/stale
HEAD 3333333333333333333333333333333333333333
branch refs/heads/codex/stale
prunable gitdir file points to non-existent location
`;

describe('git worktree integration', () => {
  it('parses git worktree porcelain entries deterministically', () => {
    const entries = parseWorktreePorcelain(worktreePorcelain);

    expect(entries).toEqual([
      {
        path: '/repo/main',
        head: '1111111111111111111111111111111111111111',
        branch: 'main',
        prunable: false,
      },
      {
        path: '/repo/worktrees/T032-github-worktree-integration',
        head: '2222222222222222222222222222222222222222',
        branch: 'feature/T032-github-worktree-integration',
        prunable: false,
      },
      {
        path: '/repo/worktrees/stale',
        head: '3333333333333333333333333333333333333333',
        branch: 'codex/stale',
        prunable: true,
        prunableReason: 'gitdir file points to non-existent location',
      },
    ]);
  });

  it('classifies clean, dirty, prunable, merged, unmerged, and missing-upstream entries', () => {
    const entries = parseWorktreePorcelain(worktreePorcelain);
    const main = entries[0]!;
    const feature = entries[1]!;
    const stale = entries[2]!;

    expect(
      classifyWorktreeEntry(main, {
        dirtyPaths: [],
        mergedHeads: [main.head!],
        upstreamByBranch: { main: 'origin/main' },
      }),
    ).toMatchObject({
      state: 'clean',
      merged: true,
      upstream: 'origin/main',
      recommendation: 'keep',
    });

    expect(
      classifyWorktreeEntry(feature, {
        dirtyPaths: ['/repo/worktrees/T032-github-worktree-integration'],
        mergedHeads: [],
        upstreamByBranch: {},
      }),
    ).toMatchObject({
      state: 'dirty',
      merged: false,
      upstream: null,
      recommendation: 'investigate',
      flags: expect.arrayContaining(['dirty', 'unmerged', 'missing-upstream']),
    });

    expect(
      classifyWorktreeEntry(stale, {
        dirtyPaths: [],
        mergedHeads: [stale.head!],
        upstreamByBranch: {},
      }),
    ).toMatchObject({
      state: 'prunable',
      merged: true,
      upstream: null,
      recommendation: 'prune-candidate',
      flags: expect.arrayContaining(['prunable', 'missing-upstream']),
    });
  });

  it('rejects push policy when origin is wrong or repository is public', () => {
    expect(
      validatePrivateOriginPolicy({
        originUrl: 'https://github.com/agisota/rox-one-terminal.git',
        repoNameWithOwner: 'agisota/rox-one-terminal',
        isPrivate: true,
      }).ok,
    ).toBe(true);

    expect(
      validatePrivateOriginPolicy({
        originUrl: 'https://github.com/agisota/craft.git',
        repoNameWithOwner: 'agisota/craft',
        isPrivate: true,
      }),
    ).toEqual({
      ok: false,
      reasons: ['origin-url-mismatch', 'repo-name-mismatch'],
    });

    expect(
      validatePrivateOriginPolicy({
        originUrl: 'https://github.com/agisota/rox-one-terminal.git',
        repoNameWithOwner: 'agisota/rox-one-terminal',
        isPrivate: false,
      }),
    ).toEqual({
      ok: false,
      reasons: ['repo-not-private'],
    });
  });

  it('blocks force-push unless an explicit destructive approval artifact exists', () => {
    expect(validatePushPolicy({ force: false })).toEqual({
      ok: true,
      command: ['git', 'push', 'origin', 'main'],
      reasons: [],
    });

    expect(validatePushPolicy({ force: true })).toEqual({
      ok: false,
      command: null,
      reasons: ['force-push-blocked'],
    });

    expect(
      validatePushPolicy({
        force: true,
        destructiveApprovalArtifact: '.swarm/approvals/force-push.md',
      }),
    ).toEqual({
      ok: true,
      command: ['git', 'push', '--force-with-lease', 'origin', 'main'],
      reasons: [],
    });
  });

  it('rejects staged files outside the worker allowlist', () => {
    const allowlist = [
      'docs/tickets/T032-github-worktree-integration.md',
      'docs/worklog/T032-github-worktree-integration.md',
      'packages/shared/src/workbench/*git*',
      'packages/shared/src/workbench/*worktree*',
      'packages/shared/src/workbench/__tests__/*git*',
      'packages/shared/src/workbench/__tests__/*worktree*',
    ];

    expect(
      validateStagingAllowlist({
        stagedPaths: [
          'docs/tickets/T032-github-worktree-integration.md',
          'packages/shared/src/workbench/git-worktree-integration.ts',
          'packages/shared/src/workbench/__tests__/git-worktree-integration.test.ts',
        ],
        allowlist,
      }),
    ).toEqual({ ok: true, rejectedPaths: [] });

    expect(
      validateStagingAllowlist({
        stagedPaths: [
          'apps/electron/src/renderer/components/workbench/experience-ui.tsx',
          'package.json',
        ],
        allowlist,
      }),
    ).toEqual({
      ok: false,
      rejectedPaths: [
        'apps/electron/src/renderer/components/workbench/experience-ui.tsx',
        'package.json',
      ],
    });
  });
});
