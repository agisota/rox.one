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

  test('does not freeze current-blocker evidence to a stale commit SHA', () => {
    const audit = readFileSync(auditPath, 'utf8')
    const currentBlockers = audit.split('## Current Blockers')[1]?.split('## Stop Condition')[0] ?? ''

    expect(currentBlockers).toContain('latest clean post-push checks')
    expect(currentBlockers).not.toMatch(/after commit `[0-9a-f]{8}`/)
    expect(currentBlockers).not.toMatch(/both resolve to `[0-9a-f]{8}`/)
  })

  test('records current-main validation without claiming post-rewrite completion', () => {
    const audit = readFileSync(auditPath, 'utf8')
    const currentMainValidation =
      audit.split('## Current Main Validation Matrix')[1]?.split('## Current Blockers')[0] ?? ''

    expect(currentMainValidation).toContain('Pre-rewrite current main validation evidence')
    for (const command of [
      'bun run typecheck',
      'bun run lint',
      'bun test',
      'bun run build',
    ]) {
      expect(currentMainValidation).toContain(command)
    }
    expect(currentMainValidation).toContain(
      'This does not satisfy the final post-rewrite validation requirement',
    )
  })

  test('records fresh current-main validation counts', () => {
    const audit = readFileSync(auditPath, 'utf8')
    const currentMainValidation =
      audit.split('## Current Main Validation Matrix')[1]?.split('## Current Blockers')[0] ?? ''

    expect(currentMainValidation).toContain('7 warnings')
    expect(currentMainValidation).toContain('6751 pass, 13 skip, 0 fail')
  })

  test('records exact current report-only blocker IDs', () => {
    const audit = readFileSync(auditPath, 'utf8')
    const currentBlockers =
      audit.split('## Current Blockers')[1]?.split('## Stop Condition')[0] ?? ''

    for (const blockerId of [
      'no-active-goal',
      'rebrand-tag-local-sync',
      'rebrand-tag-on-main',
      'backup-tag',
      'backup-branch',
      'offline-mirror',
      'remote-branch-review',
      'legal-file-LICENSE',
      'legal-file-NOTICE',
      'legal-file-TRADEMARK.md',
      'dockerfile-source-attribution',
      'history-scan',
    ]) {
      expect(currentBlockers).toContain(blockerId)
    }
  })

  test('records the current remote branch review blocker count', () => {
    const audit = readFileSync(auditPath, 'utf8')
    const currentBlockers =
      audit.split('## Current Blockers')[1]?.split('## Stop Condition')[0] ?? ''

    expect(currentBlockers).toContain('remote-branch-review')
    expect(currentBlockers).toContain('139 non-main/non-R.11-backup origin branches')
  })

  test('records the current rebrand-v1 tag targets', () => {
    const audit = readFileSync(auditPath, 'utf8')
    const currentBlockers =
      audit.split('## Current Blockers')[1]?.split('## Stop Condition')[0] ?? ''

    expect(currentBlockers).toContain('906896e145156d92cf98457c4dc1893c53323bac')
    expect(currentBlockers).toContain('b817d1c311b30487e95dfd83fc6fdfe9ddc8bd99')
  })

  test('records the current history-scan finding count', () => {
    const audit = readFileSync(auditPath, 'utf8')
    const currentBlockers =
      audit.split('## Current Blockers')[1]?.split('## Stop Condition')[0] ?? ''

    expect(currentBlockers).toContain('history-scan')
    expect(currentBlockers).toContain('9 forbidden-token patch lines')
  })

  test('records exact backup artifact identifiers', () => {
    const audit = readFileSync(auditPath, 'utf8')
    const currentBlockers =
      audit.split('## Current Blockers')[1]?.split('## Stop Condition')[0] ?? ''

    expect(currentBlockers).toContain('pre-rebrand-history-rewrite-backup')
    expect(currentBlockers).toContain('backup/pre-rebrand-history-rewrite-2026-05-13')
    expect(currentBlockers).toContain('/tmp/rox-one-terminal-backup-2026-05-13.git')
  })

  test('separates operator-owned unblocks from destructive authorization', () => {
    const audit = readFileSync(auditPath, 'utf8')
    const operatorChecklist =
      audit.split('## Operator-Owned Unblock Checklist')[1]?.split('## Stop Condition')[0] ?? ''

    expect(operatorChecklist).toContain('not authorization for this active run')
    for (const required of [
      'active `/goal` run',
      '`rebrand-v1` tag targets',
      'origin/main ancestry',
      '139 non-main/non-R.11-backup origin branches',
      'backup tag, backup branch, and offline mirror',
      'legal-preserve',
      'history scan',
    ]) {
      expect(operatorChecklist).toContain(required)
    }
    expect(operatorChecklist).toContain('Do not mutate tags')
    expect(operatorChecklist).toContain('Do not create backup refs')
  })
})
