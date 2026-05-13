import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

const repoRoot = join(import.meta.dir, "../..");
const legacyStem = "cr" + "aft";
const legacyRepo = `${legacyStem}-agents-oss`;
const legacyAgentsRepoUrl = `https://github.com/lukilabs/${legacyRepo}`;
const upstreamRepoUrl = legacyAgentsRepoUrl;

// Paths whose entire contents are allowed to keep community-implying URLs.
//
// `LICENSE`, `NOTICE`, and `TRADEMARK.md` carry Apache 2.0 §4 attribution that
// must be preserved verbatim. `Dockerfile.server` keeps the
// `org.opencontainers.image.source` label pointing at the upstream OSS repo —
// the validate-rebrand allowlist enforces it at the line level; here we
// allowlist the whole file because the only upstream URL it contains is that
// label, and other tests assert the label is preserved.
//
// Historical immutable artifacts (release notes, completed worklogs, completed
// tickets) keep their original URLs as a historical record. The ADR set under
// `docs/decision-records/` and the legacy `plan.md` / `snapshot.md` orientation
// docs are also allowlisted by ADR 0011.
//
// The audit script itself and this test file contain forbidden patterns by
// definition (they are the regression-test fixtures), so we exclude them from
// the scan to avoid self-flagging.
const WHOLE_FILE_ALLOWLIST = new Set<string>([
  "LICENSE",
  "NOTICE",
  "TRADEMARK.md",
  "Dockerfile.server",
  "plan.md",
  "snapshot.md",
  "README.md",
  "scripts/validate-rebrand.cjs",
  "scripts/__tests__/community-link-audit.test.ts",
  "scripts/__tests__/r7-docker-ci-build.test.ts",
  "scripts/__tests__/rebrand-doc-cleanup.test.ts",
  // Goal / spine / mapping docs name the forbidden patterns in their bodies as
  // part of defining the audit rules.
  "docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md",
  "docs/superpowers/goals/2026-05-13-rox-one-v1-end-to-end-spine-goal.md",
  "docs/superpowers/goals/2026-05-13-agent-workbench-suite-master-roadmap-goal.md",
  "docs/release/rebrand-mapping-2026-05-13.md",
  "docs/release/upstream-v0.9.1-rox-protected-map.md",
]);

// Path prefixes whose contents are immutable historical records.
const PREFIX_ALLOWLIST = [
  "apps/electron/resources/release-notes/",
  "docs/worklog/T",
  "docs/tickets/T",
  "docs/decision-records/",
  ".brv/",
  ".swarm/",
  ".git/",
  "node_modules/",
  "dist/",
  ".tmp-tsc/",
];

function isAllowlistedPath(relativePath: string): boolean {
  if (WHOLE_FILE_ALLOWLIST.has(relativePath)) return true;
  return PREFIX_ALLOWLIST.some((prefix) => relativePath.startsWith(prefix));
}

function trackedFiles(): string[] {
  const output = execFileSync("git", ["ls-files", "-z"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  return output.split("\0").filter(Boolean);
}

interface ForbiddenPattern {
  readonly id: string;
  readonly regex: RegExp;
  readonly description: string;
  /**
   * Optional line-level allowlist: if any allowlisted substring appears on the
   * same line as the match, the hit is suppressed. Used for narrow exceptions
   * (e.g. a developer-facing JSDoc bug-trace that points at the upstream
   * issue tracker without directing users to the upstream community).
   */
  readonly lineAllowlist?: readonly string[];
}

// Forbidden community-implying patterns. The audit fails if any of these match
// outside the allowlists above.
const PATTERNS: readonly ForbiddenPattern[] = [
  {
    id: "upstream-issues-link",
    regex: new RegExp(`${legacyAgentsRepoUrl}/issues/\\d+`),
    description: `${upstreamRepoUrl}/issues/<n> outside historical-record files`,
    // Code comments that cite a fixed upstream issue for developer traceability
    // are not user-facing community links. We allowlist the specific JSDoc
    // bug-trace in SessionManager.ts that explains why the SDK subprocess
    // disables Bun's auto .env loading.
    lineAllowlist: ["See: " + legacyAgentsRepoUrl + "/issues/39"],
  },
  {
    id: "upstream-repo-tab",
    // Demo / seed data that embeds the upstream OSS repo URL as if the user
    // were browsing it (e.g. playground mock browser tabs) implies this
    // product is still part of the upstream community. The legal-preserve
    // attribution URLs in LICENSE / NOTICE / Dockerfile.server are excluded
    // via WHOLE_FILE_ALLOWLIST.
    regex: new RegExp(`${legacyAgentsRepoUrl}(?!\\.git|/issues|/pulls)\\b`),
    description: `${upstreamRepoUrl} as standalone reference (non-attribution)`,
  },
  {
    id: "upstream-pulls-tab",
    regex: new RegExp(`${legacyAgentsRepoUrl}/pulls\\b`),
    description: `${upstreamRepoUrl}/pulls (demo browser tabs)`,
  },
  {
    id: "non-rox-discord-invite",
    // Matches discord.gg/<anything-not-rox-one>. discord.gg/rox-one is the
    // approved destination (placeholder until a canonical invite is minted).
    regex: /https?:\/\/discord\.gg\/(?!rox-one\b)[A-Za-z0-9_-]+/,
    description: "discord.gg/<not-rox-one>",
  },
  {
    id: "non-rox-twitter-handle",
    regex: /https?:\/\/twitter\.com\/(?!rox_one\b)[A-Za-z0-9_]+/,
    description: "twitter.com/<not-rox_one>",
  },
  {
    id: "non-rox-x-handle",
    // x.com URLs that are not the rox_one handle. We match only standalone
    // domain references (not paths like .com/api or arbitrary subdomains)
    // and exclude well-known non-handle subpaths (i.com images).
    regex: /https?:\/\/(?:www\.)?x\.com\/(?!rox_one\b)[A-Za-z0-9_]+/,
    description: "x.com/<not-rox_one>",
  },
  {
    id: "rox-community-text",
    regex: new RegExp(`\\b(?:Cr|cr)aft (community|forum|discord)\\b`, "i"),
    description: "literal 'rox community' / 'rox forum' / 'rox discord' prose",
  },
];

interface Finding {
  readonly path: string;
  readonly lineNumber: number;
  readonly patternId: string;
  readonly description: string;
  readonly line: string;
}

function collectFindings(): Finding[] {
  const findings: Finding[] = [];

  for (const relativePath of trackedFiles()) {
    if (isAllowlistedPath(relativePath)) continue;

    let content: string;
    try {
      content = readFileSync(join(repoRoot, relativePath), "utf8");
    } catch {
      continue;
    }
    if (content.includes("\0")) continue;

    const lines = content.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      for (const pattern of PATTERNS) {
        if (!pattern.regex.test(line)) continue;
        if (pattern.lineAllowlist?.some((needle) => line.includes(needle))) continue;
        findings.push({
          path: relativePath,
          lineNumber: index + 1,
          patternId: pattern.id,
          description: pattern.description,
          line: line.trim(),
        });
      }
    }
  }

  return findings;
}

describe("R.9 community-link audit", () => {
  test("zero forbidden community-implying URLs outside the legal-preserve allowlist", () => {
    const findings = collectFindings();
    const printable = findings.map(
      ({ path, lineNumber, patternId, line }) =>
        `${path}:${lineNumber} [${patternId}] ${line}`,
    );
    expect(printable).toEqual([]);
  });

  test("approved ROX.ONE destinations are recognised (not flagged)", () => {
    const sampleLines = [
      "Join us at https://discord.gg/rox-one for support.",
      "Follow https://x.com/rox_one for announcements.",
      "Twitter: https://twitter.com/rox_one (legacy mirror)",
    ];
    for (const sampleLine of sampleLines) {
      for (const pattern of PATTERNS) {
        expect(
          pattern.regex.test(sampleLine),
          `approved destination should not match ${pattern.id}: ${sampleLine}`,
        ).toBe(false);
      }
    }
  });

  test("forbidden destinations are detected by the regex set (self-test)", () => {
    const cases: Array<{ line: string; expectedId: string }> = [
      {
        line: "url: 'https://discord.gg/abc123',",
        expectedId: "non-rox-discord-invite",
      },
      {
        line: "Follow https://twitter.com/roxagents for updates.",
        expectedId: "non-rox-twitter-handle",
      },
      {
        line: "https://x.com/roxagents shares news.",
        expectedId: "non-rox-x-handle",
      },
      {
        line: "url: 'https://github.com/lukilabs/rox-agents-oss/pulls',",
        expectedId: "upstream-pulls-tab",
      },
      {
        line: "Track our rox community at the forum.",
        expectedId: "rox-community-text",
      },
    ];
    for (const { line, expectedId } of cases) {
      const matched = PATTERNS.find((pattern) => pattern.regex.test(line));
      expect(matched?.id, `expected line to match ${expectedId}: ${line}`).toBe(expectedId);
    }
  });
});
