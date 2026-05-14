import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'bun:test'

const repoRoot = join(import.meta.dir, '..', '..')
const auditPath = join(repoRoot, 'docs', 'release', 'r11-completion-audit-2026-05-14.md')

describe('R.11 completion audit', () => {
  test('maps every global stopping condition to concrete evidence', () => {
    const audit = readFileSync(auditPath, 'utf8')

    expect(audit).toContain('## Objective Deliverables')
    expect(audit).toContain('## Prompt-to-Artifact Checklist')
    expect(audit).toContain('## Current Blockers')
    expect(audit).toContain('## Stop Condition')

    for (const required of [
      'T260-T298 status and worklogs',
      'validate:rebrand on main',
      'global validation matrix',
      'RBAC on rewritten ancestry',
      'rebrand-v1 tag on main',
      'backup tag, branch, and mirror',
      'mapping report closeout SHA',
      'history scan clean',
    ]) {
      expect(audit).toContain(required)
    }

    expect(audit).toContain('NOT ACHIEVED')
    expect(audit).toContain('Do not call update_goal')
    expect(audit).toContain('bun run rebrand:r11-preflight')
    expect(audit).toContain('bun run rebrand:r11-legal-preserve')
    expect(audit).toContain('bun run rebrand:r11-history-scan')
  })
})
