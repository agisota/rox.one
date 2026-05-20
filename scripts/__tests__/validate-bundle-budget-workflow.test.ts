/**
 * Workflow assertion for the bundle-budget CI gate (PZD-52).
 *
 * Asserts that:
 *   - .github/workflows/bundle-budget.yml exists
 *   - all `uses:` action refs are pinned to 40-char commit SHAs
 *   - the workflow runs `bun run bundle:budget`
 *   - the workflow triggers on pull_request and push to main
 *   - the workflow uses path filters for bundle-relevant paths
 */

import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'bun:test'

const repoRoot = join(import.meta.dir, '../..')
const workflowPath = join(repoRoot, '.github/workflows/bundle-budget.yml')

const SHA40 = /^[0-9a-f]{40}$/
const USES_PATTERN = /^\s*uses:\s+([^\s#@]+)@([^\s#]+)(\s+#.*)?$/

describe('bundle-budget.yml workflow (PZD-52)', () => {
  test('workflow file exists', () => {
    expect(existsSync(workflowPath)).toBe(true)
  })

  test('all action refs are pinned to 40-char commit SHAs', () => {
    const content = readFileSync(workflowPath, 'utf8')
    const lines = content.split('\n')
    const offenders: string[] = []

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const match = line.match(USES_PATTERN)
      if (!match) continue
      const [, target, ref] = match
      if (target.startsWith('./') || target.startsWith('docker://')) continue
      if (!SHA40.test(ref)) {
        offenders.push(`line ${i + 1}: ${line.trim()} (ref="${ref}" is not a 40-char SHA)`)
      }
    }

    expect(offenders).toEqual([])
  })

  test('workflow runs bun run bundle:budget', () => {
    const content = readFileSync(workflowPath, 'utf8')
    expect(content).toContain('bun run bundle:budget')
  })

  test('workflow triggers on pull_request', () => {
    const content = readFileSync(workflowPath, 'utf8')
    expect(content).toContain('pull_request')
  })

  test('workflow triggers on push to main', () => {
    const content = readFileSync(workflowPath, 'utf8')
    expect(content).toMatch(/push[\s\S]*?branches[\s\S]*?main|push[\s\S]*?main/)
  })

  test('workflow has path filters for bundle-relevant paths', () => {
    const content = readFileSync(workflowPath, 'utf8')
    expect(content).toContain('bundle-budget.json')
    expect(content).toContain('apps/electron/**')
  })
})
