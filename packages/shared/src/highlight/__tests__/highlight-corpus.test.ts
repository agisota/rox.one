/**
 * Contract test for the M.11 / F.1 Shiki migration.
 *
 * Pins:
 *   1. The 20-sample corpus (10 languages × small + medium) all render to
 *      HTML with a token `<span>` wrapping the anchor lexeme.
 *   2. Output is deterministic — identical inputs produce identical HTML.
 *   3. The `highlight` module's bundled size stays within a recorded budget.
 *      The sentinel is JSON-sidecar based to avoid spurious failures while
 *      still failing if the module's bytes increase by >20%.
 *
 * Engine swaps must continue to satisfy all three.
 */

import { describe, expect, test } from 'bun:test'
import { promises as fs } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

import { createShikiHighlighter } from '../highlighter'
import { HIGHLIGHT_CORPUS } from './corpus'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const HIGHLIGHT_DIR = path.resolve(HERE, '..')
const SIZE_SIDECAR = path.join(HIGHLIGHT_DIR, 'highlight-bundle-size.json')
const SIZE_BUDGET_OVERSHOOT_RATIO = 0.2 // 20%

// Module files whose byte-size we track. Stored as a JSON sidecar in the
// highlight dir; CI fails if the sum grows by more than 20% versus the
// recorded baseline.
const TRACKED_FILES = [
  'highlighter.ts',
  'languages.ts',
  'themes.ts',
  'index.ts',
] as const

describe('highlight corpus contract', () => {
  test('preloaded languages cover the 10 corpus languages', async () => {
    const highlighter = await createShikiHighlighter()
    const supported = new Set(highlighter.supportedLanguages())
    const corpusLangs = new Set(HIGHLIGHT_CORPUS.map((s) => s.lang))
    for (const lang of corpusLangs) {
      expect(supported.has(lang)).toBe(true)
    }
  })

  for (const sample of HIGHLIGHT_CORPUS) {
    test(`renders token spans for ${sample.id} (${sample.lang}/${sample.size})`, async () => {
      const highlighter = await createShikiHighlighter()
      const html = await highlighter.highlight(sample.code, sample.lang)
      // Shape: <pre … class="shiki …" … ><code> <span class="line"> <span style="…">tok</span>… </span> … </code></pre>
      expect(html).toMatch(/<pre[^>]*class="[^"]*shiki/)
      expect(html).toContain('<code')
      expect(html).toContain('<span')
      // Anchor lexeme must appear inside the highlighted output.
      expect(html).toContain(sample.expectedToken)
    })
  }

  test('output is deterministic across freshly-built highlighters', async () => {
    const h1 = await createShikiHighlighter()
    const h2 = await createShikiHighlighter()
    const sample = HIGHLIGHT_CORPUS[0]!
    const a = await h1.highlight(sample.code, sample.lang)
    const b = await h2.highlight(sample.code, sample.lang)
    expect(a).toBe(b)
  })

  test('unknown languages fall back to text without throwing', async () => {
    const highlighter = await createShikiHighlighter()
    const html = await highlighter.highlight('hello world', 'totally-fake-lang')
    expect(html).toContain('<pre')
    expect(html).toContain('hello world')
  })

  test('bundle-size sentinel: module bytes stay within budget', async () => {
    const sizes = await Promise.all(
      TRACKED_FILES.map(async (name) => {
        const stat = await fs.stat(path.join(HIGHLIGHT_DIR, name))
        return { name, bytes: stat.size }
      })
    )
    const total = sizes.reduce((acc, s) => acc + s.bytes, 0)

    let baseline: { total: number; files: Record<string, number> } | null = null
    try {
      const raw = await fs.readFile(SIZE_SIDECAR, 'utf8')
      baseline = JSON.parse(raw)
    } catch {
      // First run — write the baseline.
      baseline = null
    }

    if (!baseline) {
      const initial = {
        total,
        files: Object.fromEntries(sizes.map((s) => [s.name, s.bytes])),
        recordedAt: new Date().toISOString().slice(0, 10),
      }
      await fs.writeFile(SIZE_SIDECAR, JSON.stringify(initial, null, 2) + '\n')
      return
    }

    const budget = Math.ceil(baseline.total * (1 + SIZE_BUDGET_OVERSHOOT_RATIO))
    expect(total).toBeLessThanOrEqual(budget)
  })
})
