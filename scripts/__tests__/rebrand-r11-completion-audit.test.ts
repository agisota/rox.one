import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'bun:test'

const repoRoot = join(import.meta.dir, '..', '..')
const auditPath = join(repoRoot, 'docs', 'release', 'r11-completion-audit-2026-05-14.md')
const remoteBranchReviewPath = join(
  repoRoot,
  'docs',
  'release',
  'r11-remote-branch-review-2026-05-14.md',
)
const historyScanInventoryPath = join(
  repoRoot,
  'docs',
  'release',
  'r11-history-scan-inventory-2026-05-14.md',
)
const legalPreserveInventoryPath = join(
  repoRoot,
  'docs',
  'release',
  'r11-legal-preserve-inventory-2026-05-14.md',
)
const tagDriftInventoryPath = join(
  repoRoot,
  'docs',
  'release',
  'r11-tag-drift-inventory-2026-05-14.md',
)
const backupArtifactInventoryPath = join(
  repoRoot,
  'docs',
  'release',
  'r11-backup-artifact-inventory-2026-05-14.md',
)
const currentMainValidationPath = join(
  repoRoot,
  'docs',
  'release',
  'r11-current-main-validation-2026-05-14.md',
)

describe('R.11 completion audit', () => {
  test('maps every global stopping condition to concrete evidence', () => {
    const audit = readFileSync(auditPath, 'utf8')

    expect(audit).toContain('## Objective Deliverables')
    expect(audit).toContain('## Prompt-to-Artifact Checklist')
    expect(audit).toContain('## R.11 Hard Prerequisite Evidence')
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
      'README post-rewrite coordination banner',
      'pre/post commit count delta',
      '1. R.0-R.10 closeouts',
      '2. T223 Phase 1 closeout',
      '3. T229 RBAC closeout',
      '4. Open PR list',
      '5. No active `/goal` run',
      '6. Fork review',
      '7. `rebrand-v1` exists',
      '8. origin `rebrand-v1` is on origin/main',
      '9. local `rebrand-v1` matches origin',
      '10. Working tree clean',
      '11. main sync',
    ]) {
      expect(audit).toContain(required)
    }

    expect(audit).toContain('NOT ACHIEVED')
    expect(audit).toContain('Do not call update_goal')
    expect(audit).toContain('bun run rebrand:r11-preflight')
    expect(audit).toContain('bun run rebrand:r11-legal-preserve')
    expect(audit).toContain('bun run rebrand:r11-history-scan')
  })

  test('records the README post-rewrite coordination banner as a blocked artifact', () => {
    const audit = readFileSync(auditPath, 'utf8')
    const promptChecklist =
      audit.split('## Prompt-to-Artifact Checklist')[1]?.split('## R.11 Hard Prerequisite Evidence')[0] ?? ''

    expect(promptChecklist).toContain('README post-rewrite coordination banner')
    expect(promptChecklist).toContain('README.md')
    expect(promptChecklist).toContain('After R.11 history rewrite')
    expect(promptChecklist).toContain('72-hour visible banner')
    expect(promptChecklist).toContain('Only required after force-push')
    expect(promptChecklist).toContain('Blocked')
  })

  test('records the post-rewrite commit-count artifact as blocked evidence', () => {
    const audit = readFileSync(auditPath, 'utf8')
    const promptChecklist =
      audit.split('## Prompt-to-Artifact Checklist')[1]?.split('## R.11 Hard Prerequisite Evidence')[0] ?? ''

    expect(promptChecklist).toContain('pre/post commit count delta')
    expect(promptChecklist).toContain('git log --oneline | wc -l')
    expect(promptChecklist).toContain('git rev-list --count main')
    expect(promptChecklist).toContain('filter-repo delta')
    expect(promptChecklist).toContain('Only available after rewritten ancestry exists')
    expect(promptChecklist).toContain('Blocked')
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
    const currentMainValidationReport = readFileSync(currentMainValidationPath, 'utf8')

    expect(currentMainValidation).toContain('Pre-rewrite full-matrix snapshot evidence')
    expect(currentMainValidation).toContain('docs/release/r11-current-main-validation-2026-05-14.md')
    expect(currentMainValidation).toContain('Subsequent report-only audit tickets carry their own targeted validation evidence')
    for (const command of [
      'bun run typecheck',
      'bun run lint',
      'bun test',
      'bun run build',
    ]) {
      expect(currentMainValidationReport).toContain(command)
    }
    expect(currentMainValidationReport).toContain('Status: PRE-REWRITE VALIDATION ONLY')
    expect(currentMainValidation).toContain(
      'This does not satisfy the final post-rewrite validation requirement',
    )
  })

  test('records current-main validation counts as a captured snapshot', () => {
    const currentMainValidationReport = readFileSync(currentMainValidationPath, 'utf8')

    expect(currentMainValidationReport).toContain('Captured full-matrix snapshot')
    expect(currentMainValidationReport).toContain('not a live ticket-count source')
    expect(currentMainValidationReport).toContain('Later report-only audit tickets must record their own fresh validation evidence')
    expect(currentMainValidationReport).not.toContain('\nlater report-only audit tickets')
    expect(currentMainValidationReport).toContain('Exit 0 with 7 existing warnings')
    expect(currentMainValidationReport).toContain('6753 pass, 13 skip, 0 fail')
    expect(currentMainValidationReport).toContain('26839 expect() calls')
    expect(currentMainValidationReport).toContain('6766 tests in 562 files')
    expect(currentMainValidationReport).toContain('agent-contract reported 394 tickets at capture time')
    expect(currentMainValidationReport).toContain('useful captured snapshot evidence')
    expect(currentMainValidationReport).not.toContain('freshness evidence')
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
      'fork-review',
      'legal-file-LICENSE',
      'legal-file-NOTICE',
      'legal-file-TRADEMARK.md',
      'dockerfile-source-attribution',
      'history-scan',
    ]) {
      expect(currentBlockers).toContain(blockerId)
    }
  })

  test('records the current fork-review blocker count', () => {
    const audit = readFileSync(auditPath, 'utf8')
    const hardPrereqs =
      audit.split('## R.11 Hard Prerequisite Evidence')[1]?.split('## Current Main Validation Matrix')[0] ?? ''
    const currentBlockers =
      audit.split('## Current Blockers')[1]?.split('## Operator-Owned Unblock Checklist')[0] ?? ''

    expect(hardPrereqs).toContain('6. Fork review')
    expect(hardPrereqs).toContain('GitHub reports 1 fork(s); expected 0')
    expect(hardPrereqs).toContain('Blocked')
    expect(currentBlockers).toContain('fork-review')
    expect(currentBlockers).toContain('GitHub reports 1 fork(s); expected 0')
  })

  test('records the current remote branch review blocker count', () => {
    const audit = readFileSync(auditPath, 'utf8')
    const currentBlockers =
      audit.split('## Current Blockers')[1]?.split('## Stop Condition')[0] ?? ''
    const remoteBranchReview = readFileSync(remoteBranchReviewPath, 'utf8')

    expect(currentBlockers).toContain('remote-branch-review')
    expect(currentBlockers).toContain('139 non-main/non-R.11-backup origin branches')
    expect(currentBlockers).toContain('docs/release/r11-remote-branch-review-2026-05-14.md')
    expect(remoteBranchReview).toContain('Total origin heads: 140')
    expect(remoteBranchReview).toContain('Non-main/non-R.11-backup origin branches: 139')
    expect(remoteBranchReview).toContain('operator-review-required')
    expect(remoteBranchReview).toContain('chore/T297-rebrand-prepush-ci-gate')
    expect(remoteBranchReview).toContain('backup/agent-workbench-t000-t012-2026-04-30')
  })

  test('records the current rebrand-v1 tag targets', () => {
    const audit = readFileSync(auditPath, 'utf8')
    const currentBlockers =
      audit.split('## Current Blockers')[1]?.split('## Stop Condition')[0] ?? ''
    const tagDriftInventory = readFileSync(tagDriftInventoryPath, 'utf8')

    expect(currentBlockers).toContain('906896e145156d92cf98457c4dc1893c53323bac')
    expect(currentBlockers).toContain('b817d1c311b30487e95dfd83fc6fdfe9ddc8bd99')
    expect(currentBlockers).toContain('docs/release/r11-tag-drift-inventory-2026-05-14.md')
    expect(tagDriftInventory).toContain('Status: BLOCKED ON TAG DRIFT')
    expect(tagDriftInventory).toContain('8e30f545169e52daa2763659d6c562a699a2575b')
    expect(tagDriftInventory).toContain('906896e145156d92cf98457c4dc1893c53323bac')
    expect(tagDriftInventory).toContain('e32deed37b33fe3296edde6228adb1f76255027d')
    expect(tagDriftInventory).toContain('b817d1c311b30487e95dfd83fc6fdfe9ddc8bd99')
    expect(tagDriftInventory).toContain('merge-base --is-ancestor')
    expect(tagDriftInventory).toContain('exit 1')
    expect(tagDriftInventory).toContain('origin/chore/rebrand-R10-final-sweep-and-gate')
  })

  test('records the current history-scan finding count', () => {
    const audit = readFileSync(auditPath, 'utf8')
    const currentBlockers =
      audit.split('## Current Blockers')[1]?.split('## Stop Condition')[0] ?? ''
    const historyScanInventory = readFileSync(historyScanInventoryPath, 'utf8')

    expect(currentBlockers).toContain('history-scan')
    expect(currentBlockers).toContain('9 forbidden-token patch lines')
    expect(currentBlockers).toContain('docs/release/r11-history-scan-inventory-2026-05-14.md')
    expect(historyScanInventory).toContain('Matches observed at cutoff: 9')
    expect(historyScanInventory).toContain('Listed sanitized findings: 8')
    expect(historyScanInventory).toContain('Raw token and line text: omitted')
    expect(historyScanInventory).toContain('64afb56746e9ad6b1a7b21d684f903c7f407fb4d')
    expect(historyScanInventory).toContain('docs/release/m3-merge-runbook.md')
    expect(historyScanInventory).toContain('docs/release/m3-upstream-merge-audit.md')
  })

  test('records exact backup artifact identifiers', () => {
    const audit = readFileSync(auditPath, 'utf8')
    const currentBlockers =
      audit.split('## Current Blockers')[1]?.split('## Stop Condition')[0] ?? ''
    const backupArtifactInventory = readFileSync(backupArtifactInventoryPath, 'utf8')

    expect(currentBlockers).toContain('pre-rebrand-history-rewrite-backup')
    expect(currentBlockers).toContain('backup/pre-rebrand-history-rewrite-2026-05-13')
    expect(currentBlockers).toContain('/tmp/rox-one-terminal-backup-2026-05-13.git')
    expect(currentBlockers).toContain('docs/release/r11-backup-artifact-inventory-2026-05-14.md')
    expect(backupArtifactInventory).toContain('Status: BLOCKED ON MISSING BACKUP ARTIFACTS')
    expect(backupArtifactInventory).toContain('remote tag query returned no refs')
    expect(backupArtifactInventory).toContain('remote branch query returned no refs')
    expect(backupArtifactInventory).toContain('offline-mirror: missing')
  })

  test('records exact legal-preserve gate state', () => {
    const audit = readFileSync(auditPath, 'utf8')
    const currentBlockers =
      audit.split('## Current Blockers')[1]?.split('## Stop Condition')[0] ?? ''
    const legalPreserveInventory = readFileSync(legalPreserveInventoryPath, 'utf8')

    expect(currentBlockers).toContain('docs/release/r11-legal-preserve-inventory-2026-05-14.md')
    expect(legalPreserveInventory).toContain('Status: BLOCKED ON BACKUP TAG')
    expect(legalPreserveInventory).toContain('pre-rebrand-history-rewrite-backup')
    expect(legalPreserveInventory).toContain('legal-file-LICENSE')
    expect(legalPreserveInventory).toContain('legal-file-NOTICE')
    expect(legalPreserveInventory).toContain('legal-file-TRADEMARK.md')
    expect(legalPreserveInventory).toContain('dockerfile-source-attribution')
    expect(legalPreserveInventory).toContain('Dockerfile.server source attribution is intact')
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
