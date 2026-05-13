import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'

import {
  formatReport,
  parseValidatorGates,
  runPreflight,
} from '../rc-preflight-runner'

const realChecklistMarkdown = `# header

## 1. Validator gates (CI)

Some prose.

| Validator | Owner | Duration |
| --- | --- | --- |
| \`bun run validate:rebrand\` | CI | 5s |
| \`bun run validate:agent-contract\` | CI | 10s |
| \`bun run validate:roadmap\` | CI | 5s |

Aggregate gate: \`bun run validate:ci\` must exit 0.

## 2. Automated test suites

| Suite | Command | Owner | Duration |
| --- | --- | --- | --- |
| Unit | \`bun run test:units\` | CI | 5 min |
`

describe('parseValidatorGates', () => {
  test('extracts validator suffixes from section 1 in order', () => {
    const gates = parseValidatorGates(realChecklistMarkdown)
    expect(gates).toEqual(['rebrand', 'agent-contract', 'roadmap'])
  })

  test('skips aggregate gates such as validate:ci', () => {
    const gates = parseValidatorGates(realChecklistMarkdown)
    expect(gates).not.toContain('ci')
  })

  test('throws when section 1 heading is missing', () => {
    expect(() => parseValidatorGates('# nothing here\n')).toThrow(
      /Validator gates/,
    )
  })
})

interface FixtureProject {
  root: string
  checklistRelative: string
}

function buildFixtureProject(
  fixtures: Array<{ name: string; exitCode: number; stderr?: string }>,
): FixtureProject {
  const root = mkdtempSync(join(tmpdir(), 'rc-preflight-runner-'))
  const scriptsDir = join(root, 'scripts')
  mkdirSync(scriptsDir, { recursive: true })
  const checklistDir = join(root, 'docs', 'release')
  mkdirSync(checklistDir, { recursive: true })

  const scripts: Record<string, string> = {}
  for (const fixture of fixtures) {
    const scriptPath = join(scriptsDir, `validate-${fixture.name}.ts`)
    const stderrLiteral = JSON.stringify(fixture.stderr ?? '')
    writeFileSync(
      scriptPath,
      `if (${stderrLiteral}.length > 0) {\n` +
        `  console.error(${stderrLiteral})\n` +
        `}\n` +
        `process.exit(${fixture.exitCode})\n`,
      'utf8',
    )
    scripts[`validate:${fixture.name}`] = `bun run scripts/validate-${fixture.name}.ts`
  }
  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify({ name: 'rc-preflight-fixture', scripts }, null, 2),
    'utf8',
  )

  const checklistRows = fixtures
    .map(
      (fixture) =>
        `| \`bun run validate:${fixture.name}\` | CI | 1s |`,
    )
    .join('\n')
  const markdown =
    '# fixture checklist\n\n' +
    '## 1. Validator gates (CI)\n\n' +
    '| Validator | Owner | Duration |\n' +
    '| --- | --- | --- |\n' +
    checklistRows +
    '\n\n' +
    '## 2. Other section\n\n' +
    '| Suite | Command | Owner | Duration |\n' +
    '| --- | --- | --- | --- |\n' +
    '| Unit | `bun run test:units` | CI | 5 min |\n'
  const checklistRelative = 'docs/release/v1-rc-preflight-checklist.md'
  writeFileSync(join(root, checklistRelative), markdown, 'utf8')
  return { root, checklistRelative }
}

describe('runPreflight against stub validators', () => {
  let happyFixture: FixtureProject
  let failureFixture: FixtureProject

  beforeAll(() => {
    happyFixture = buildFixtureProject([
      { name: 'alpha', exitCode: 0 },
      { name: 'beta', exitCode: 0 },
    ])
    failureFixture = buildFixtureProject([
      { name: 'alpha', exitCode: 0 },
      { name: 'beta', exitCode: 1, stderr: 'boom-error-text' },
      { name: 'gamma', exitCode: 0 },
    ])
  })

  afterAll(() => {
    rmSync(happyFixture.root, { recursive: true, force: true })
    rmSync(failureFixture.root, { recursive: true, force: true })
  })

  test('happy path: every gate green, allPassed true', async () => {
    const report = await runPreflight({
      repoRoot: happyFixture.root,
      checklistRelativePath: happyFixture.checklistRelative,
    })
    expect(report.allPassed).toBe(true)
    expect(report.gatesParsed).toBe(2)
    expect(report.results).toHaveLength(2)
    expect(report.results[0]?.gate).toBe('alpha')
    expect(report.results[0]?.passed).toBe(true)
    expect(report.results[1]?.gate).toBe('beta')
    expect(report.results[1]?.exitCode).toBe(0)
    expect(report.shortCircuited).toBe(false)
  })

  test('failure short-circuits by default and surfaces stderr tail', async () => {
    const report = await runPreflight({
      repoRoot: failureFixture.root,
      checklistRelativePath: failureFixture.checklistRelative,
    })
    expect(report.allPassed).toBe(false)
    expect(report.shortCircuited).toBe(true)
    expect(report.results).toHaveLength(3)
    const beta = report.results.find((entry) => entry.gate === 'beta')
    expect(beta?.passed).toBe(false)
    expect(beta?.exitCode).toBe(1)
    expect(beta?.stderrTail).toContain('boom-error-text')
    const gamma = report.results.find((entry) => entry.gate === 'gamma')
    expect(gamma?.skipped).toBe(true)
  })

  test('--continue-on-failure runs every gate even after a red', async () => {
    const report = await runPreflight({
      repoRoot: failureFixture.root,
      checklistRelativePath: failureFixture.checklistRelative,
      continueOnFailure: true,
    })
    expect(report.allPassed).toBe(false)
    expect(report.shortCircuited).toBe(false)
    expect(report.results.map((entry) => entry.gate)).toEqual([
      'alpha',
      'beta',
      'gamma',
    ])
    expect(report.results.every((entry) => !entry.skipped)).toBe(true)
    const gamma = report.results[2]
    expect(gamma?.passed).toBe(true)
  })

  test('formatReport renders a header row and the failure summary', async () => {
    const report = await runPreflight({
      repoRoot: failureFixture.root,
      checklistRelativePath: failureFixture.checklistRelative,
      continueOnFailure: true,
    })
    const rendered = formatReport(report)
    expect(rendered).toContain('gate')
    expect(rendered).toContain('status')
    expect(rendered).toContain('duration')
    expect(rendered).toContain('alpha')
    expect(rendered).toContain('fail')
    expect(rendered).toMatch(/red — 1 failed/)
  })

  test('throws when checklist file is missing', async () => {
    await expect(
      runPreflight({
        repoRoot: happyFixture.root,
        checklistRelativePath: 'does/not/exist.md',
      }),
    ).rejects.toThrow(/checklist missing/)
  })
})
