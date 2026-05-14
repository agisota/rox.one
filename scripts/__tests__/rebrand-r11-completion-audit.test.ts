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
const forkReviewInventoryPath = join(
  repoRoot,
  'docs',
  'release',
  'r11-fork-review-inventory-2026-05-14.md',
)
const activeGoalInventoryPath = join(
  repoRoot,
  'docs',
  'release',
  'r11-active-goal-inventory-2026-05-14.md',
)
const blockerInventoryIndexPath = join(
  repoRoot,
  'docs',
  'release',
  'r11-blocker-inventory-index-2026-05-14.md',
)
const preflightContextInventoryPath = join(
  repoRoot,
  'docs',
  'release',
  'r11-preflight-context-inventory-2026-05-14.md',
)
const currentMainValidationPath = join(
  repoRoot,
  'docs',
  'release',
  'r11-current-main-validation-2026-05-14.md',
)
const consolidationBacklogPath = join(
  repoRoot,
  'docs',
  'release',
  'r11-consolidation-backlog-2026-05-14.md',
)
const rebrandMappingPath = join(
  repoRoot,
  'docs',
  'release',
  'rebrand-mapping-2026-05-13.md',
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

  test('keeps prompt checklist history-scan command aligned with current blockers', () => {
    const audit = readFileSync(auditPath, 'utf8')
    const promptChecklist =
      audit.split('## Prompt-to-Artifact Checklist')[1]?.split('## R.11 Hard Prerequisite Evidence')[0] ?? ''
    const historyScanRow = promptChecklist
      .split('\n')
      .find((line) => line.includes('| history scan clean |')) ?? ''

    expect(historyScanRow).toContain('bun run rebrand:r11-history-scan')
    expect(historyScanRow).toContain('81 forbidden-token patch lines')
    expect(historyScanRow).not.toContain('REBRAND_R11_HISTORY_MAX_FINDINGS=8')
    expect(historyScanRow).not.toContain('bounded historical findings')
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

    expect(currentBlockers).toContain('report-only post-push checks')
    expect(currentBlockers).toContain('without pinning this audit to a moving latest commit')
    expect(currentBlockers).not.toContain('latest clean post-push checks')
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

  test('records post-T439 roadmap ledger validation evidence', () => {
    const audit = readFileSync(auditPath, 'utf8')
    const currentMainValidation =
      audit.split('## Current Main Validation Matrix')[1]?.split('## Current Blockers')[0] ?? ''

    expect(currentMainValidation).toContain('T439')
    expect(currentMainValidation).toContain('bun run validate:roadmap')
    expect(currentMainValidation).toContain('14 rebrand master-roadmap log rows')
    expect(currentMainValidation).toContain('.swarm/master-roadmap-log.md')
    expect(currentMainValidation).toContain('This does not satisfy the final post-rewrite validation requirement')
  })

  test('records post-T441 mapping roadmap evidence without unblocking R.11', () => {
    const audit = readFileSync(auditPath, 'utf8')
    const currentMainValidation =
      audit.split('## Current Main Validation Matrix')[1]?.split('## Current Blockers')[0] ?? ''
    const mapping = readFileSync(rebrandMappingPath, 'utf8')
    const currentRoadmapOutput =
      'validate:roadmap OK — 46 phases, 110 tickets across detail files, 14 rebrand master-roadmap log rows'

    expect(mapping).toContain(currentRoadmapOutput)
    expect(mapping).toContain('| R.11 | T298 | `BLOCKED - pending destructive rewrite closeout SHA` |')
    expect(currentMainValidation).toContain('T441')
    expect(currentMainValidation).toContain('docs/release/rebrand-mapping-2026-05-13.md')
    expect(currentMainValidation).toContain(currentRoadmapOutput)
    expect(currentMainValidation).toContain('BLOCKED - pending destructive rewrite closeout SHA')
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

  test('records the current consolidation backlog as the execution surface', () => {
    const backlog = readFileSync(consolidationBacklogPath, 'utf8')

    expect(backlog).toContain('Status: ACTIVE CONSOLIDATION BACKLOG')
    expect(backlog).toContain('origin/main: `2fa129f3`')
    expect(backlog).toContain('Open PRs: `#214`')
    expect(backlog).toContain('CI blocked by GitHub account billing lock')
    expect(backlog).toContain('149')
    expect(backlog).toContain('148 non-main/non-R.11-backup')
    expect(backlog).toContain('132 merged PR branch cleanup candidates')
    expect(backlog).toContain('14 operator-review branches')
    expect(backlog).toContain('destructive R.11 gates')
    expect(backlog).toContain('No branch deletion, tag mutation, backup ref creation, mirror creation, filter-repo, force-push, or PR merge was authorized by this artifact')
  })

  test('records exact current report-only blocker IDs', () => {
    const audit = readFileSync(auditPath, 'utf8')
    const currentBlockers =
      audit.split('## Current Blockers')[1]?.split('## Stop Condition')[0] ?? ''

    for (const blockerId of [
      'no-active-goal',
      'no-open-prs',
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
      'current-branch',
    ]) {
      expect(currentBlockers).toContain(blockerId)
    }
  })

  test('records volatile preflight context blockers without destructive authorization', () => {
    const audit = readFileSync(auditPath, 'utf8')
    const currentBlockers =
      audit.split('## Current Blockers')[1]?.split('## Stop Condition')[0] ?? ''
    const preflightContextInventory = readFileSync(preflightContextInventoryPath, 'utf8')

    expect(currentBlockers).toContain('no-open-prs')
    expect(currentBlockers).toContain('#214')
    expect(currentBlockers).toContain('docs/release/r11-preflight-context-inventory-2026-05-14.md')
    expect(currentBlockers).toContain('current-branch')
    expect(currentBlockers).toContain('Current checkout is report/r11-t463-consolidation-backlog')
    expect(currentBlockers).toContain('main-sync')
    expect(currentBlockers).toContain('origin/main...main is 0 0')
    expect(currentBlockers).toContain('worktree-clean')
    expect(currentBlockers).toContain('git status --porcelain is empty')
    expect(preflightContextInventory).toContain('Status: PREFLIGHT CONTEXT BLOCKERS')
    expect(preflightContextInventory).toContain('Open PRs: 1')
    expect(preflightContextInventory).toContain('#214')
    expect(preflightContextInventory).toContain('Current checkout: `report/r11-t463-consolidation-backlog`')
    expect(preflightContextInventory).toContain('Report-only worktree `HEAD`: `2fa129f3`')
    expect(preflightContextInventory).toContain('Local `main`: `2fa129f3`')
    expect(preflightContextInventory).toContain('Origin `main`: `2fa129f3`')
    expect(preflightContextInventory).toContain('origin/main...main: `0 0`')
    expect(preflightContextInventory).toContain('does not authorize destructive R.11 work')
    expect(audit).toContain('This does not satisfy the final post-rewrite validation requirement')
  })

  test('indexes every current blocker inventory artifact', () => {
    const audit = readFileSync(auditPath, 'utf8')
    const currentBlockers =
      audit.split('## Current Blockers')[1]?.split('## Operator-Owned Unblock Checklist')[0] ?? ''
    const blockerInventoryIndex = readFileSync(blockerInventoryIndexPath, 'utf8')

    expect(currentBlockers).toContain('docs/release/r11-blocker-inventory-index-2026-05-14.md')
    expect(blockerInventoryIndex).toContain('Status: REPORT-ONLY BLOCKER INDEX')

    for (const expected of [
      'no-active-goal',
      'no-open-prs',
      'fork-review',
      'rebrand-tag-local-sync',
      'rebrand-tag-on-main',
      'backup-tag',
      'backup-branch',
      'offline-mirror',
      'remote-branch-review',
      'legal-file-LICENSE',
      'legal-file-NOTICE',
      'legal-file-TRADEMARK.md',
      'history-scan',
      'current-branch',
      'main-sync',
      'worktree-clean',
      'docs/release/r11-preflight-context-inventory-2026-05-14.md',
      'docs/release/r11-active-goal-inventory-2026-05-14.md',
      'docs/release/r11-fork-review-inventory-2026-05-14.md',
      'docs/release/r11-tag-drift-inventory-2026-05-14.md',
      'docs/release/r11-backup-artifact-inventory-2026-05-14.md',
      'docs/release/r11-remote-branch-review-2026-05-14.md',
      'docs/release/r11-legal-preserve-inventory-2026-05-14.md',
      'docs/release/r11-history-scan-inventory-2026-05-14.md',
    ]) {
      expect(blockerInventoryIndex).toContain(expected)
    }

    expect(blockerInventoryIndex).toContain('does not authorize destructive R.11 work')
  })

  test('records the active goal blocker as a dedicated inventory', () => {
    const audit = readFileSync(auditPath, 'utf8')
    const currentBlockers =
      audit.split('## Current Blockers')[1]?.split('## Operator-Owned Unblock Checklist')[0] ?? ''
    const activeGoalInventory = readFileSync(activeGoalInventoryPath, 'utf8')

    expect(currentBlockers).toContain('no-active-goal')
    expect(currentBlockers).toContain('docs/release/r11-active-goal-inventory-2026-05-14.md')
    expect(activeGoalInventory).toContain('Status: ACTIVE GOAL BLOCKER')
    expect(activeGoalInventory).toContain('Gate row: `no-active-goal`')
    expect(activeGoalInventory).toContain('Current goal status: active')
    expect(activeGoalInventory).toContain('docs/superpowers/goals/2026-05-13-rox-one-rebrand-sweep-goal.md')
    expect(activeGoalInventory).toContain('does not authorize destructive R.11 work')
  })

  test('records the current fork-review blocker count', () => {
    const audit = readFileSync(auditPath, 'utf8')
    const hardPrereqs =
      audit.split('## R.11 Hard Prerequisite Evidence')[1]?.split('## Current Main Validation Matrix')[0] ?? ''
    const currentBlockers =
      audit.split('## Current Blockers')[1]?.split('## Operator-Owned Unblock Checklist')[0] ?? ''
    const forkReviewInventory = readFileSync(forkReviewInventoryPath, 'utf8')

    expect(hardPrereqs).toContain('6. Fork review')
    expect(hardPrereqs).toContain('GitHub reports 1 fork(s); expected 0')
    expect(hardPrereqs).toContain('Blocked')
    expect(currentBlockers).toContain('fork-review')
    expect(currentBlockers).toContain('GitHub reports 1 fork(s); expected 0')
    expect(currentBlockers).toContain('docs/release/r11-fork-review-inventory-2026-05-14.md')
    expect(forkReviewInventory).toContain('Status: OPERATOR REVIEW REQUIRED')
    expect(forkReviewInventory).toContain('Current fork count: 1')
    expect(forkReviewInventory).toContain('Expected fork count: 0')
    expect(forkReviewInventory).toContain('dofaromg/rox-one-terminal')
    expect(forkReviewInventory).toContain('operator-review-required')
  })

  test('records the current remote branch review blocker count', () => {
    const audit = readFileSync(auditPath, 'utf8')
    const currentBlockers =
      audit.split('## Current Blockers')[1]?.split('## Stop Condition')[0] ?? ''
    const remoteBranchReview = readFileSync(remoteBranchReviewPath, 'utf8')

    expect(currentBlockers).toContain('remote-branch-review')
    expect(currentBlockers).toContain('148 non-main/non-R.11-backup origin branches')
    expect(currentBlockers).toContain('docs/release/r11-remote-branch-review-2026-05-14.md')
    expect(remoteBranchReview).toContain('Total origin heads: 149')
    expect(remoteBranchReview).toContain('Non-main/non-R.11-backup origin branches: 148')
    expect(remoteBranchReview).toContain('operator-review-required')
    expect(remoteBranchReview).toContain('feat/M14-T250-rpc-admin-audit-list')
    expect(remoteBranchReview).toContain('fix/t132-main-bundle-regression')
    expect(remoteBranchReview).toContain('docs/M20-T299-phase-20-closeout')
    expect(remoteBranchReview).toContain('chore/bundle-budget-pdf-worker-carveout')
    expect(remoteBranchReview).toContain('fix/renderer-prod-sourcemap-leak')
    expect(remoteBranchReview).toContain('feat/M13-T086d-abuse-guard-remaining-handlers')
    expect(remoteBranchReview).toContain('feat/M10-T237c-drag-from-other-apps')
    expect(remoteBranchReview).toContain('feat/M10-T240c-cheatsheet-i18n')
    expect(remoteBranchReview).toContain('feat/M18-T253b-linux-deb-rpm')
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
    expect(currentBlockers).toContain('81 forbidden-token patch lines')
    expect(currentBlockers).toContain('docs/release/r11-history-scan-inventory-2026-05-14.md')
    expect(historyScanInventory).toContain('Matches observed in unbounded scan: 81')
    expect(historyScanInventory).toContain('Representative sanitized findings: 8')
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

  test('records backup artifact target guards in the dedicated inventory', () => {
    const backupArtifactInventory = readFileSync(backupArtifactInventoryPath, 'utf8')

    for (const targetGuard of [
      'backup-tag-target',
      'backup-branch-target',
      'offline-mirror-target',
    ]) {
      expect(backupArtifactInventory).toContain(targetGuard)
    }

    expect(backupArtifactInventory).toContain('latent target rows')
    expect(backupArtifactInventory).toContain('not emitted while the corresponding artifact is missing')
    expect(backupArtifactInventory).toContain('current `main`')
  })

  test('records latent backup target guards from the current pre-rewrite gate', () => {
    const audit = readFileSync(auditPath, 'utf8')
    const promptChecklist =
      audit.split('## Prompt-to-Artifact Checklist')[1]?.split('## R.11 Hard Prerequisite Evidence')[0] ?? ''
    const currentBlockers =
      audit.split('## Current Blockers')[1]?.split('## Operator-Owned Unblock Checklist')[0] ?? ''
    const operatorChecklist =
      audit.split('## Operator-Owned Unblock Checklist')[1]?.split('## Stop Condition')[0] ?? ''

    for (const targetGuard of [
      'backup-tag-target',
      'backup-branch-target',
      'offline-mirror-target',
    ]) {
      expect(promptChecklist).toContain(targetGuard)
      expect(currentBlockers).toContain(targetGuard)
      expect(operatorChecklist).toContain(targetGuard)
    }

    expect(currentBlockers).toContain('not emitted while the corresponding artifact is missing')
    expect(operatorChecklist).toContain('after backup artifacts exist')
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
      '148 non-main/non-R.11-backup origin branches',
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
