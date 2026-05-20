#!/usr/bin/env bun
/**
 * build-nightly-release-notes.ts — T320
 *
 * Generates a richer `release-notes.json` for nightly builds by enumerating
 * the PRs merged since the previous nightly tag.
 *
 * CLI:
 *   bun run scripts/build-nightly-release-notes.ts \
 *     --current-sha=<sha>   \   # HEAD of the current build (required)
 *     --out=<path>           \   # destination path for release-notes.json (required)
 *     [--previous-tag=<tag>]     # if omitted, resolved via `gh release list`
 *
 * The script is intentionally side-effect-free aside from writing the JSON
 * file; it shells out to `git` and `gh` (GitHub CLI) but does NOT modify
 * any workflow files.
 *
 * ─── HOW TO WIRE THIS INTO THE AGGREGATE JOB ───────────────────────────────
 *
 * Replace the inline "Build release-notes.json" shell block in
 * `.github/workflows/multi-platform-on-merge.yml` (the aggregate job,
 * currently lines ~656-668) with:
 *
 *   - name: Build release-notes.json
 *     env:
 *       GH_TOKEN: ${{ github.token }}
 *     run: |
 *       set -euo pipefail
 *       bun run scripts/build-nightly-release-notes.ts \
 *         --current-sha="${COMMIT_SHA}" \
 *         --out=".manifest-out/release-notes.json"
 *
 * The NIGHTLY_TAG env-var is already set by the aggregate job so the script
 * will use it as the `version` field automatically.
 *
 * ────────────────────────────────────────────────────────────────────────────
 */

import { spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

// ── types ────────────────────────────────────────────────────────────────────

export interface PrHighlight {
  pr: number
  title: string
  url: string
}

export interface ReleaseNotesJson {
  version: string
  publishedAt: string
  compareUrl: string
  previousNightly: string
  highlights: PrHighlight[]
  rawCommitCount: number
}

export interface BuildOptions {
  /** HEAD SHA of the current build. */
  currentSha: string
  /** Absolute path where release-notes.json will be written. */
  out: string
  /** Previous nightly tag. Resolved via `gh release list` if absent. */
  previousTag?: string
  /**
   * Override for the nightly tag name (version). Defaults to the NIGHTLY_TAG
   * env-var, then falls back to `nightly-<short-sha>`.
   */
  nightlyTag?: string
  /** GitHub repo slug used for API calls and URLs. */
  repoSlug?: string
  /**
   * Injected for tests: replace the `gh api compare` network call with a
   * pre-built commit list.
   */
  compareCommitsOverride?: CompareCommit[]
}

export interface CompareCommit {
  sha: string
  commit: { message: string }
  html_url: string
}

// ── helpers ──────────────────────────────────────────────────────────────────

/** Run a command synchronously and return trimmed stdout. Throws on non-zero. */
function run(cmd: string, args: string[]): string {
  const result = spawnSync(cmd, args, { encoding: 'utf8' })
  if (result.status !== 0) {
    const stderr = (result.stderr ?? '').trim()
    throw new Error(
      `Command failed (exit ${result.status}): ${[cmd, ...args].join(' ')}${stderr ? `\n${stderr}` : ''}`,
    )
  }
  return (result.stdout ?? '').trim()
}

/**
 * Resolve the previous nightly tag.
 *
 * Queries `gh release list --limit 50 --json tagName` and returns the tag
 * immediately before the most recent nightly- tag (i.e. the second-most-
 * recent nightly). If fewer than two nightly releases exist, returns null.
 */
export function resolvePreviousNightlyTag(currentTag?: string): string | null {
  let listJson: string
  try {
    listJson = run('gh', [
      'release',
      'list',
      '--limit',
      '50',
      '--json',
      'tagName',
    ])
  } catch {
    return null
  }

  let releases: Array<{ tagName: string }>
  try {
    releases = JSON.parse(listJson) as Array<{ tagName: string }>
  } catch {
    return null
  }

  const nightlyTags = releases
    .map((r) => r.tagName)
    .filter((t) => t.startsWith('nightly-'))

  // Skip the current tag so we find the one before it.
  const filtered = currentTag
    ? nightlyTags.filter((t) => t !== currentTag)
    : nightlyTags

  // The list is ordered most-recent-first by gh release list.
  return filtered[0] ?? null
}

/**
 * Resolve a tag to its commit SHA using `git ls-remote` so it works even if
 * the tag is not locally fetched.
 */
export function resolveTagSha(tag: string): string | null {
  try {
    const output = run('git', ['ls-remote', 'origin', `refs/tags/${tag}`])
    // output format: "<sha>\trefs/tags/<tag>" or "<sha>^{}\trefs/tags/<tag>^{}"
    // Prefer the peeled ref (^{}) when present (annotated tags).
    const lines = output
      .split('\n')
      .filter((l) => l.includes(`refs/tags/${tag}`))
    const peeled = lines.find((l) => l.includes('^{}'))
    const chosen = peeled ?? lines[0]
    return chosen ? (chosen.split('\t')[0]?.trim() ?? null) : null
  } catch {
    return null
  }
}

// Matches "Merge pull request #NNN" style commit messages.
const MERGE_PR_RE = /^Merge pull request #(\d+)/m
// Matches "(#NNN)" suffix in squash-merge titles.
const SQUASH_PR_RE = /\(#(\d+)\)\s*$/m

/**
 * Extract a PR number from a commit message. Returns null when no PR reference
 * is found.
 */
export function extractPrNumber(message: string): number | null {
  const mergeMatch = MERGE_PR_RE.exec(message)
  if (mergeMatch) return parseInt(mergeMatch[1]!, 10)
  const squashMatch = SQUASH_PR_RE.exec(message)
  if (squashMatch) return parseInt(squashMatch[1]!, 10)
  return null
}

/**
 * Extract a one-line PR title from the commit message.
 *
 * For merge commits the second line is the PR title; for squash commits the
 * first line (minus the `(#NNN)` suffix) is used.
 */
export function extractPrTitle(message: string): string {
  const lines = message.split('\n').map((l) => l.trim())
  if (MERGE_PR_RE.test(message)) {
    // "Merge pull request #NNN from owner/branch\n\nPR title here"
    const titleLine = lines.find((l, i) => i > 0 && l.length > 0)
    return titleLine ?? lines[0]!
  }
  // Squash: first line is "Title of the PR (#NNN)"
  return (lines[0] ?? '').replace(/\s*\(#\d+\)\s*$/, '').trim()
}

/**
 * Fetch the commit comparison from GitHub API and return deduplicated PR
 * highlights in merge order (oldest first).
 */
export function extractHighlights(
  commits: CompareCommit[],
  repoSlug: string,
): PrHighlight[] {
  const seen = new Set<number>()
  const highlights: PrHighlight[] = []

  for (const c of commits) {
    const prNum = extractPrNumber(c.commit.message)
    if (prNum === null || seen.has(prNum)) continue
    seen.add(prNum)
    highlights.push({
      pr: prNum,
      title: extractPrTitle(c.commit.message),
      url: `https://github.com/${repoSlug}/pull/${prNum}`,
    })
  }

  return highlights
}

/**
 * Fetch commits between two SHAs using the GitHub compare API.
 * Returns an empty array on any error (graceful degradation).
 */
function fetchCompareCommits(
  repoSlug: string,
  previousSha: string,
  currentSha: string,
): CompareCommit[] {
  // gh api compare endpoint uses three-dot notation for merge-base comparison.
  const endpoint = `repos/${repoSlug}/compare/${previousSha}...${currentSha}`
  let raw: string
  try {
    raw = run('gh', ['api', endpoint, '--paginate'])
  } catch {
    return []
  }

  // --paginate may return multiple JSON objects concatenated; handle both.
  let parsed: { commits?: CompareCommit[] } | null = null
  try {
    parsed = JSON.parse(raw) as { commits?: CompareCommit[] }
  } catch {
    // Try extracting the last complete JSON object.
    const lastBrace = raw.lastIndexOf('}')
    if (lastBrace !== -1) {
      try {
        parsed = JSON.parse(raw.slice(0, lastBrace + 1)) as {
          commits?: CompareCommit[]
        }
      } catch {
        return []
      }
    }
  }

  return parsed?.commits ?? []
}

// ── main exported build function ─────────────────────────────────────────────

export async function buildReleaseNotes(
  opts: BuildOptions,
): Promise<ReleaseNotesJson> {
  const repoSlug = opts.repoSlug ?? 'agisota/rox.one'
  const currentSha = opts.currentSha
  const publishedAt = new Date().toISOString()

  // Resolve nightly tag (version string).
  const nightlyTag =
    opts.nightlyTag ??
    process.env['NIGHTLY_TAG'] ??
    `nightly-${currentSha.slice(0, 7)}`

  // Resolve previous nightly tag.
  const previousTag =
    opts.previousTag ?? resolvePreviousNightlyTag(nightlyTag) ?? 'HEAD~100'

  // Resolve previous tag's SHA.
  const previousSha = resolveTagSha(previousTag) ?? previousTag

  // Fetch commits via GitHub API (or use override for tests).
  const commits: CompareCommit[] =
    opts.compareCommitsOverride ??
    fetchCompareCommits(repoSlug, previousSha, currentSha)

  const highlights = extractHighlights(commits, repoSlug)

  const result: ReleaseNotesJson = {
    version: nightlyTag,
    publishedAt,
    compareUrl: `https://github.com/${repoSlug}/compare/${previousTag}...${nightlyTag}`,
    previousNightly: previousTag,
    highlights,
    rawCommitCount: commits.length,
  }

  writeFileSync(opts.out, `${JSON.stringify(result, null, 2)}\n`, 'utf8')
  return result
}

// ── CLI entry point ───────────────────────────────────────────────────────────

function fail(msg: string): never {
  console.error(`[build-nightly-release-notes] ${msg}`)
  process.exit(1)
}

function parseCliArgs(argv: string[]): {
  currentSha: string
  out: string
  previousTag?: string
} {
  const args = argv.slice(2) // strip `bun` and script name
  const get = (prefix: string) =>
    args.find((a) => a.startsWith(prefix))?.slice(prefix.length)

  const currentSha = get('--current-sha=')
  const out = get('--out=')
  const previousTag = get('--previous-tag=')

  if (!currentSha) fail('--current-sha=<sha> is required')
  if (!out) fail('--out=<path> is required')

  return { currentSha, out: resolve(out), previousTag }
}

// Only run as CLI when this is the entry module.
if (import.meta.main) {
  const { currentSha, out, previousTag } = parseCliArgs(process.argv)

  buildReleaseNotes({ currentSha, out, previousTag })
    .then((notes) => {
      console.log(
        `[build-nightly-release-notes] wrote ${out} — ${notes.highlights.length} PRs, ${notes.rawCommitCount} commits`,
      )
    })
    .catch((err: unknown) => {
      fail(String(err))
    })
}
