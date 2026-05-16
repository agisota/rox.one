import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'bun:test'

const repoRoot = join(import.meta.dir, '..', '..')
const auditPath = join(repoRoot, 'docs', 'release', 'r11-completion-audit-2026-05-14.md')
const mappingPath = join(repoRoot, 'docs', 'release', 'rebrand-mapping-2026-05-13.md')
const roadmapLogPath = join(repoRoot, '.swarm', 'master-roadmap-log.md')
const ticketPath = join(repoRoot, 'docs', 'tickets', 'T298-rebrand-git-history-rewrite.md')
const worklogPath = join(repoRoot, 'docs', 'worklog', 'T298-rebrand-git-history-rewrite.md')
const readmePath = join(repoRoot, 'README.md')

const read = (path: string): string => readFileSync(path, 'utf8')

describe('R.11 completion audit', () => {
  test('records the active rebrand goal as achieved instead of report-only blocked', () => {
    const audit = read(auditPath)

    expect(audit).toContain('Status: ACHIEVED')
    expect(audit).toContain('## Prompt-to-Artifact Checklist')
    expect(audit).toContain('## Validation Evidence')
    expect(audit).toContain('## Ref Evidence')
    expect(audit).toContain('## Historical Blocker Artifacts')
    expect(audit).toContain('## Stop Condition')
    expect(audit).not.toContain('Status: NOT ACHIEVED')
    expect(audit).not.toContain('Do not call update_goal')
    expect(audit).not.toContain('The objective is NOT ACHIEVED')
  })

  test('maps every global stopping condition to green evidence', () => {
    const audit = read(auditPath)

    for (const requirement of [
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
    ]) {
      const row = audit.split('\n').find((line) => line.includes(`| ${requirement} |`)) ?? ''
      expect(row).toContain('Green')
    }
  })

  test('records current post-rewrite refs and backup anchors', () => {
    const audit = read(auditPath)

    expect(audit).toContain('origin/main')
    expect(audit).toContain('96856e54e9debf223c2a074c8a87641ec1fa8e8a')
    expect(audit).toContain('rebrand-v1')
    expect(audit).toContain('c0cc869d4224a25811c612090a904671333776e4')
    expect(audit).toContain('pre-rebrand-history-rewrite-backup')
    expect(audit).toContain('backup/pre-rebrand-history-rewrite-2026-05-13')
    expect(audit).toContain('1734d48746d193c377cb3a5ea899770e2805536e')
    expect(audit).toContain('/tmp/rox-one-terminal-backup-2026-05-13.git')
    expect(audit).toContain('rebrand-v1 target is on origin/main ancestry')
  })

  test('records fresh validation commands from the completed rewrite', () => {
    const audit = read(auditPath)

    for (const command of [
      'ROX_R11_NO_ACTIVE_GOAL=1 ROX_R11_EXPECTED_FORKS=2 bun run rebrand:r11-preflight',
      'bun run rebrand:r11-history-scan',
      'bun run rebrand:r11-legal-preserve',
      'bun run validate:rebrand',
      'bun run validate:docs',
      'node scripts/validate-roadmap-coherence.cjs',
      'git diff --check',
      'bun run typecheck',
      'bun run lint',
      'bun test',
      'bun run build',
    ]) {
      expect(audit).toContain(command)
    }

    expect(audit).toContain('6916 pass')
    expect(audit).toContain('13 skip')
    expect(audit).toContain('0 fail')
    expect(audit).toContain('568 files')
    expect(audit).toContain('7 warnings')
    expect(audit).toContain('validate:roadmap OK')
    expect(audit).toContain('15 rebrand master-roadmap log rows')
    expect(audit).toContain('R.11 rollback refs excluded')
  })

  test('keeps completion audit aligned with closeout artifacts', () => {
    const audit = read(auditPath)
    const mapping = read(mappingPath)
    const roadmapLog = read(roadmapLogPath)
    const ticket = read(ticketPath)
    const worklog = read(worklogPath)
    const readme = read(readmePath)

    expect(mapping).toContain('| R.11 | T298 | `c0cc869d` |')
    expect(mapping).toContain('Post-rewrite R.11 closeout evidence')
    expect(roadmapLog).toContain('rebrand-R.11-history-rewrite | c0cc869d | T298')
    expect(ticket).toContain('Status: DONE')
    expect(worklog).toContain('Status: DONE')
    expect(worklog).toContain('R.11 rollback refs excluded')
    expect(readme).toContain('After R.11 history rewrite')
    expect(readme).toContain('Visible coordination banner')
    expect(audit).toContain('Historical blocker inventory files from 2026-05-14 are superseded')
  })
})
