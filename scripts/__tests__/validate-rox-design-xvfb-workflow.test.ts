/**
 * Workflow assertion for the Rox Design packaged xvfb smoke gate (PZD-59).
 *
 * Asserts that:
 *   - .github/workflows/rox-design-xvfb-smoke.yml exists
 *   - all `uses:` action refs are pinned to 40-char commit SHAs
 *   - the workflow runs `xvfb-run`
 *   - the workflow greps for RoxDesignRuntimeManager init markers
 *   - the workflow uploads the diag artifact
 *   - the workflow triggers on pull_request (path-filtered) and push to main
 */

import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'bun:test'

const repoRoot = join(import.meta.dir, '../..')
const workflowPath = join(repoRoot, '.github/workflows/rox-design-xvfb-smoke.yml')

const SHA40 = /^[0-9a-f]{40}$/
const USES_PATTERN = /^\s*uses:\s+([^\s#@]+)@([^\s#]+)(\s+#.*)?$/

describe('rox-design-xvfb-smoke.yml workflow (PZD-59)', () => {
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

  test('workflow runs xvfb-run', () => {
    const content = readFileSync(workflowPath, 'utf8')
    expect(content).toContain('xvfb-run')
  })

  test('workflow greps for RoxDesignRuntimeManager init markers', () => {
    const content = readFileSync(workflowPath, 'utf8')
    expect(content).toContain('RoxDesignRuntimeManager smoke probe: available')
    expect(content).toContain('ROX_DESIGN_SMOKE_MARKER: "1"')
  })

  test('workflow uploads diag artifact', () => {
    const content = readFileSync(workflowPath, 'utf8')
    expect(content).toContain('upload-artifact')
    expect(content).toContain('rox-design-smoke')
  })

  test('workflow triggers on pull_request', () => {
    const content = readFileSync(workflowPath, 'utf8')
    expect(content).toContain('pull_request')
  })

  test('workflow has path filters for rox-design source files', () => {
    const content = readFileSync(workflowPath, 'utf8')
    expect(content).toContain('rox-design-')
  })

  test('workflow triggers on push to main', () => {
    const content = readFileSync(workflowPath, 'utf8')
    expect(content).toMatch(/push[\s\S]*?branches[\s\S]*?main|push[\s\S]*?main/)
  })

  test('workflow runs on ubuntu-22.04', () => {
    const content = readFileSync(workflowPath, 'utf8')
    expect(content).toContain('ubuntu-22.04')
  })

  test('workflow installs xvfb via apt-get', () => {
    const content = readFileSync(workflowPath, 'utf8')
    expect(content).toContain('xvfb')
    expect(content).toContain('apt-get')
  })

  test('workflow prepares Rox Design runtime payload before AppImage build', () => {
    const content = readFileSync(workflowPath, 'utf8')
    expect(content).toContain('Prepare Rox Design runtime payload')
    expect(content).toContain('OPEN_DESIGN_VERSION="0.7.0"')
    expect(content).toContain('open-design-${OPEN_DESIGN_VERSION}-mac-arm64.zip')
    expect(content).toContain('shasum -a 256 -c')
    expect(content).toContain('unzip -q')
    expect(content).toContain('ROX_DESIGN_SOURCE_RESOURCES="${OPEN_DESIGN_RESOURCES}"')
    expect(content).toContain('bun run rox-design:prepare -- --force')
    expect(content).toContain('bun run rox-design:payload:verify')

    expect(content.indexOf('bun run rox-design:payload:verify')).toBeLessThan(
      content.indexOf('bun run electron:build:linux'),
    )
  })

  test('workflow builds AppImage via electron:build:linux', () => {
    const content = readFileSync(workflowPath, 'utf8')
    expect(content).toContain('electron:build:linux')
  })

  test('workflow greps /tmp/rox-design-smoke.log', () => {
    const content = readFileSync(workflowPath, 'utf8')
    expect(content).toContain('/tmp/rox-design-smoke.log')
  })
})
