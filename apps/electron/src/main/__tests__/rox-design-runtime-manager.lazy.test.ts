/**
 * rox-design-runtime-manager.lazy.test.ts (T537 PR #5a)
 *
 * Asserts that:
 * 1. The vite.manual-chunks rule routes design-system module paths into
 *    per-system chunk names (chunks/design-systems/<id>).
 * 2. The RoxDesignPage lazy wrapper file exists and exports the expected symbols.
 *
 * These are static/structural tests that run without a real Electron build.
 */

import { describe, test, expect } from 'bun:test'
import { existsSync } from 'node:fs'
import path from 'node:path'

const repoRoot = path.resolve(__dirname, '..', '..', '..', '..', '..')

describe('vite.manual-chunks design-systems splitting (T537 PR#5a)', () => {
  test('routes design-system module paths to chunks/design-systems/<id>', async () => {
    const { getElectronRendererManualChunk } = await import(
      /* @vite-ignore */ path.join(repoRoot, 'apps/electron/vite.manual-chunks.ts')
    )

    const cases: Array<[string, string]> = [
      [
        '/home/dev/craft/rox-worktrees/wt-design-perf/apps/electron/src/renderer/pages/rox-design/design-systems/material-3/index.ts',
        'chunks/design-systems/material-3',
      ],
      [
        'C:\\project\\apps\\electron\\src\\renderer\\pages\\rox-design\\design-systems\\ant-design\\tokens.ts',
        'chunks/design-systems/ant-design',
      ],
      [
        '/app/src/renderer/pages/rox-design/design-systems/fluent-ui-2/theme.ts',
        'chunks/design-systems/fluent-ui-2',
      ],
    ]

    for (const [moduleId, expected] of cases) {
      const result = getElectronRendererManualChunk(moduleId)
      expect(result).toBe(expected)
    }
  })

  test('does not affect non-design-system module paths', async () => {
    const { getElectronRendererManualChunk } = await import(
      /* @vite-ignore */ path.join(repoRoot, 'apps/electron/vite.manual-chunks.ts')
    )

    // Regular renderer module — should return undefined (no manual chunk override)
    const result = getElectronRendererManualChunk(
      '/app/src/renderer/components/app-shell/AppShell.tsx'
    )
    expect(result).toBeUndefined()

    // React package — should return 'index-react'
    const reactResult = getElectronRendererManualChunk(
      '/app/node_modules/react/index.js'
    )
    expect(reactResult).toBe('index-react')
  })
})

describe('RoxDesignPage.lazy.tsx structural check (T537 PR#5a)', () => {
  const lazyFilePath = path.join(
    repoRoot,
    'apps/electron/src/renderer/pages/rox-design/RoxDesignPage.lazy.tsx'
  )

  test('lazy wrapper file exists', () => {
    expect(existsSync(lazyFilePath)).toBe(true)
  })

  test('lazy wrapper exports LazyRoxDesignPage and RoxDesignSuspenseFallback', async () => {
    const mod = await import(/* @vite-ignore */ lazyFilePath)
    expect(typeof mod.LazyRoxDesignPage).not.toBe('undefined')
    expect(typeof mod.RoxDesignSuspenseFallback).toBe('function')
  })
})
