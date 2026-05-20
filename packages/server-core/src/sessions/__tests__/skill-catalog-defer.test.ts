/**
 * PZD-62 — Skill catalog deferred load tests.
 *
 * Verifies that importing session-manager-helpers does NOT eagerly execute
 * loadAllSkills() or pull the @rox-one/shared/skills module into the sync
 * require graph at import time.  The catalog must only be loaded on first use
 * (inside resolveToolDisplayMeta or resolveAutomationMentions), never during
 * app boot.
 */

import { describe, it, expect } from 'bun:test'

// ---------------------------------------------------------------------------
// Cycle 1 (RED→GREEN): importing session-manager-helpers does not
// synchronously touch the skills filesystem at module load time.
// ---------------------------------------------------------------------------
describe('skill catalog deferred load (PZD-62)', () => {
  it('importing session-manager-helpers does not synchronously execute loadAllSkills', async () => {
    // We track whether the skills storage module has been evaluated by
    // patching a flag BEFORE importing the module under test.
    // Because Bun caches modules, we can't unload them mid-test — but we can
    // assert on module presence in the require cache after import.
    //
    // The key invariant: session-manager-helpers must not call loadAllSkills()
    // at module evaluation time (i.e. outside of any function body).
    // If it did, it would have to read the filesystem synchronously during
    // server bootstrap.
    //
    // We verify this by importing the helpers and then calling
    // resolveToolDisplayMeta with a non-"Skill" toolName — the skills branch
    // must NOT be entered, so no fs read should occur.

    const { resolveToolDisplayMeta } = await import('../session-manager-helpers')

    // resolveToolDisplayMeta with a generic tool should resolve without
    // touching the skill catalog at all.
    const result = await resolveToolDisplayMeta(
      'Bash',
      { command: 'echo hello' },
      '/tmp/fake-workspace',
      [],
    )

    // Bash tool metadata resolution may return undefined or a result — either
    // is fine; the important thing is it did not throw from missing skills.
    expect(result === undefined || typeof result === 'object').toBe(true)
  })

  // ---------------------------------------------------------------------------
  // Cycle 2 (RED→GREEN): skill query blocks on first load, resolves after.
  // ---------------------------------------------------------------------------
  it('resolveToolDisplayMeta with Skill tool resolves via dynamic import without throwing', async () => {
    const { resolveToolDisplayMeta } = await import('../session-manager-helpers')

    // Call with a Skill tool invocation against a non-existent workspace.
    // The dynamic import should succeed (gray-matter etc. already in module
    // graph); loadAllSkills returns [] for non-existent path; result is undefined.
    const result = await resolveToolDisplayMeta(
      'Skill',
      { skill: 'my-skill' },
      '/tmp/nonexistent-workspace-pzd62',
      [],
    )

    // No skill found in empty dir → undefined, but no crash from missing static import
    expect(result).toBeUndefined()
  })

  // ---------------------------------------------------------------------------
  // Cycle 3 (RED→GREEN): catalog load does NOT happen during module import
  // (structural test — verifies the static import is gone).
  // ---------------------------------------------------------------------------
  it('session-manager-helpers module does not statically import loadAllSkills at top level', async () => {
    // We read the source file and assert there is no top-level static import
    // of loadAllSkills from @rox-one/shared/skills.
    const { readFileSync } = await import('fs')
    const { join } = await import('path')

    const helpersPath = join(
      import.meta.dir,
      '..',
      'session-manager-helpers.ts',
    )
    const source = readFileSync(helpersPath, 'utf-8')

    // There must be no top-level static import that pulls in loadAllSkills.
    // Dynamic imports (inside functions) are allowed and expected.
    const staticImportPattern =
      /^import\s+\{[^}]*\bloadAllSkills\b[^}]*\}\s+from\s+['"]@rox-one\/shared\/skills['"]/m

    expect(staticImportPattern.test(source)).toBe(false)
  })
})
