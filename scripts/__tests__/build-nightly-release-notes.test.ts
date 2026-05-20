/**
 * Unit tests for scripts/build-nightly-release-notes.ts
 *
 * All tests run against in-process exports — no network, no `gh`, no `git`
 * calls are made. The `compareCommitsOverride` option injects a mock fixture.
 */

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'

import {
  buildReleaseNotes,
  extractHighlights,
  extractPrNumber,
  extractPrTitle,
  type CompareCommit,
  type ReleaseNotesJson,
} from '../build-nightly-release-notes'

// ── fixtures ─────────────────────────────────────────────────────────────────

/** Two commits that look like squash-merges with (#NNN) suffixes. */
const SQUASH_COMMITS: CompareCommit[] = [
  {
    sha: 'aaa000',
    commit: {
      message:
        'fix(mac): finish white-window root cause (#285)\n\nLonger body here.',
    },
    html_url: 'https://github.com/agisota/rox.one/commit/aaa000',
  },
  {
    sha: 'bbb111',
    commit: {
      message: 'feat(linux): AppImage auto-update support (#290)',
    },
    html_url: 'https://github.com/agisota/rox.one/commit/bbb111',
  },
]

/** Two commits that look like GitHub merge commits. */
const MERGE_COMMITS: CompareCommit[] = [
  {
    sha: 'ccc222',
    commit: {
      message:
        'Merge pull request #300 from agisota/fix/crash\n\nfix(core): prevent null deref on startup',
    },
    html_url: 'https://github.com/agisota/rox.one/commit/ccc222',
  },
  {
    sha: 'ddd333',
    commit: {
      message:
        'Merge pull request #301 from agisota/feat/dark-mode\n\nfeat(ui): dark mode toggle',
    },
    html_url: 'https://github.com/agisota/rox.one/commit/ddd333',
  },
]

/** A non-PR commit (no PR reference). */
const PLAIN_COMMIT: CompareCommit = {
  sha: 'eee444',
  commit: { message: 'chore: update lockfile' },
  html_url: 'https://github.com/agisota/rox.one/commit/eee444',
}

/** A duplicate of SQUASH_COMMITS[0] with a different SHA (same PR number). */
const DUPLICATE_PR_COMMIT: CompareCommit = {
  sha: 'fff555',
  commit: {
    message: 'fix(mac): finish white-window root cause (#285)',
  },
  html_url: 'https://github.com/agisota/rox.one/commit/fff555',
}

// ── extractPrNumber ───────────────────────────────────────────────────────────

describe('extractPrNumber', () => {
  test('parses squash-merge (#NNN) suffix', () => {
    expect(extractPrNumber('fix(mac): finish white-window root cause (#285)')).toBe(285)
  })

  test('parses GitHub merge-commit header', () => {
    expect(
      extractPrNumber('Merge pull request #300 from owner/branch\n\ntitle'),
    ).toBe(300)
  })

  test('returns null for plain commits with no PR reference', () => {
    expect(extractPrNumber('chore: update lockfile')).toBeNull()
  })

  test('returns null for empty string', () => {
    expect(extractPrNumber('')).toBeNull()
  })
})

// ── extractPrTitle ────────────────────────────────────────────────────────────

describe('extractPrTitle', () => {
  test('strips (#NNN) suffix from squash title', () => {
    expect(
      extractPrTitle('fix(mac): finish white-window root cause (#285)'),
    ).toBe('fix(mac): finish white-window root cause')
  })

  test('extracts second non-empty line from merge commit', () => {
    const msg =
      'Merge pull request #300 from agisota/fix/crash\n\nfix(core): prevent null deref on startup'
    expect(extractPrTitle(msg)).toBe('fix(core): prevent null deref on startup')
  })

  test('falls back to first line when merge commit body is empty', () => {
    const msg = 'Merge pull request #300 from agisota/fix/crash'
    expect(extractPrTitle(msg)).toBe('Merge pull request #300 from agisota/fix/crash')
  })
})

// ── extractHighlights ─────────────────────────────────────────────────────────

describe('extractHighlights', () => {
  const REPO = 'agisota/rox.one'

  test('extracts PR numbers and titles from squash commits', () => {
    const highlights = extractHighlights(SQUASH_COMMITS, REPO)
    expect(highlights).toHaveLength(2)
    expect(highlights[0]).toMatchObject({
      pr: 285,
      title: 'fix(mac): finish white-window root cause',
      url: 'https://github.com/agisota/rox.one/pull/285',
    })
    expect(highlights[1]).toMatchObject({
      pr: 290,
      title: 'feat(linux): AppImage auto-update support',
      url: 'https://github.com/agisota/rox.one/pull/290',
    })
  })

  test('extracts PR numbers and titles from merge commits', () => {
    const highlights = extractHighlights(MERGE_COMMITS, REPO)
    expect(highlights).toHaveLength(2)
    expect(highlights[0]).toMatchObject({
      pr: 300,
      title: 'fix(core): prevent null deref on startup',
    })
    expect(highlights[1]).toMatchObject({
      pr: 301,
      title: 'feat(ui): dark mode toggle',
    })
  })

  test('skips plain commits with no PR reference', () => {
    const highlights = extractHighlights([PLAIN_COMMIT, ...SQUASH_COMMITS], REPO)
    expect(highlights).toHaveLength(2)
    expect(highlights.every((h) => h.pr !== 0)).toBe(true)
  })

  test('deduplicates commits referencing the same PR', () => {
    const highlights = extractHighlights(
      [SQUASH_COMMITS[0]!, DUPLICATE_PR_COMMIT, SQUASH_COMMITS[1]!],
      REPO,
    )
    expect(highlights).toHaveLength(2)
    expect(highlights.filter((h) => h.pr === 285)).toHaveLength(1)
  })

  test('returns empty array when commits list is empty', () => {
    expect(extractHighlights([], REPO)).toEqual([])
  })
})

// ── buildReleaseNotes (full integration, no network) ─────────────────────────

describe('buildReleaseNotes', () => {
  let tmpDir: string

  beforeAll(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'rox-release-notes-'))
  })

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  test('writes valid release-notes.json and returns correct shape', async () => {
    const outPath = join(tmpDir, 'release-notes.json')
    const allCommits = [...SQUASH_COMMITS, PLAIN_COMMIT, ...MERGE_COMMITS]

    const result = await buildReleaseNotes({
      currentSha: 'abc1234567890',
      out: outPath,
      previousTag: 'nightly-prev0001',
      nightlyTag: 'nightly-abc1234',
      repoSlug: 'agisota/rox.one',
      compareCommitsOverride: allCommits,
    })

    // Return value shape
    expect(result.version).toBe('nightly-abc1234')
    expect(result.previousNightly).toBe('nightly-prev0001')
    expect(result.compareUrl).toBe(
      'https://github.com/agisota/rox.one/compare/nightly-prev0001...nightly-abc1234',
    )
    expect(result.rawCommitCount).toBe(allCommits.length)
    expect(result.highlights).toHaveLength(4) // 4 PRs, 1 plain commit skipped
    expect(typeof result.publishedAt).toBe('string')
    // ISO-8601
    expect(() => new Date(result.publishedAt)).not.toThrow()
    expect(new Date(result.publishedAt).toISOString()).toBe(result.publishedAt)

    // highlights ordering: squash first, then merge
    expect(result.highlights[0]?.pr).toBe(285)
    expect(result.highlights[1]?.pr).toBe(290)
    expect(result.highlights[2]?.pr).toBe(300)
    expect(result.highlights[3]?.pr).toBe(301)

    // Written file matches returned value
    const written = JSON.parse(readFileSync(outPath, 'utf8')) as ReleaseNotesJson
    expect(written).toMatchObject({
      version: result.version,
      previousNightly: result.previousNightly,
      rawCommitCount: result.rawCommitCount,
    })
    expect(written.highlights).toHaveLength(4)
  })

  test('falls back to NIGHTLY_TAG env-var for version when nightlyTag not passed', async () => {
    const outPath = join(tmpDir, 'release-notes-env.json')
    const origEnv = process.env['NIGHTLY_TAG']
    process.env['NIGHTLY_TAG'] = 'nightly-from-env'

    try {
      const result = await buildReleaseNotes({
        currentSha: 'deadbeef',
        out: outPath,
        previousTag: 'nightly-prev',
        repoSlug: 'agisota/rox.one',
        compareCommitsOverride: [],
      })
      expect(result.version).toBe('nightly-from-env')
    } finally {
      if (origEnv === undefined) {
        delete process.env['NIGHTLY_TAG']
      } else {
        process.env['NIGHTLY_TAG'] = origEnv
      }
    }
  })

  test('derives version from currentSha when neither nightlyTag nor NIGHTLY_TAG set', async () => {
    const outPath = join(tmpDir, 'release-notes-sha.json')
    const origEnv = process.env['NIGHTLY_TAG']
    delete process.env['NIGHTLY_TAG']

    try {
      const result = await buildReleaseNotes({
        currentSha: 'feedface99',
        out: outPath,
        previousTag: 'nightly-prev',
        repoSlug: 'agisota/rox.one',
        compareCommitsOverride: [],
      })
      expect(result.version).toBe('nightly-feedfac')
    } finally {
      if (origEnv !== undefined) {
        process.env['NIGHTLY_TAG'] = origEnv
      }
    }
  })

  test('produces zero highlights and correct commit count when no PRs in range', async () => {
    const outPath = join(tmpDir, 'release-notes-empty.json')
    const result = await buildReleaseNotes({
      currentSha: 'abc1234',
      out: outPath,
      previousTag: 'nightly-prev',
      nightlyTag: 'nightly-abc1234',
      repoSlug: 'agisota/rox.one',
      compareCommitsOverride: [PLAIN_COMMIT],
    })
    expect(result.highlights).toHaveLength(0)
    expect(result.rawCommitCount).toBe(1)
  })
})
