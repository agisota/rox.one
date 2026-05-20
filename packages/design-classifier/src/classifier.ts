import { EN_NEGATIVE_SIGNALS, EN_POSITIVE_SIGNALS } from './signals/en.ts'
import { RU_NEGATIVE_SIGNALS, RU_POSITIVE_SIGNALS } from './signals/ru.ts'

export interface ClassifierResult {
  /** Confidence that the prompt is a design task. ∈ [0, 1] */
  confidence: number
  /** Keywords that matched during classification */
  matchedSignals: string[]
  /** Predicted class */
  topClass: 'design' | 'other'
  /** |design_conf - other_conf| — always ≥ 0 */
  secondBestGap: number
}

// ---------------------------------------------------------------------------
// Pre-compile all regex patterns once at module load time for O(1) per-call
// ---------------------------------------------------------------------------

interface CompiledSignal {
  pattern: RegExp
  keyword: string
  weight: number
  isNegative: boolean
}

function compileSignals(
  signals: readonly [string, number][],
  isNegative: boolean
): CompiledSignal[] {
  return signals.map(([keyword, weight]) => ({
    pattern: new RegExp(
      keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      'gi'
    ),
    keyword,
    weight,
    isNegative,
  }))
}

function sortByLengthDesc(signals: CompiledSignal[]): CompiledSignal[] {
  return [...signals].sort((a, b) => b.keyword.length - a.keyword.length)
}

const ALL_SIGNALS: CompiledSignal[] = sortByLengthDesc([
  ...compileSignals(RU_POSITIVE_SIGNALS, false),
  ...compileSignals(EN_POSITIVE_SIGNALS, false),
  ...compileSignals(RU_NEGATIVE_SIGNALS, true),
  ...compileSignals(EN_NEGATIVE_SIGNALS, true),
])

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x))
}

export function classifyDesignTask(prompt: string): ClassifierResult {
  const lower = prompt.toLowerCase()
  const matchedSignals: string[] = []
  let positiveScore = 0
  let negativeScore = 0

  const consumed = new Set<number>()

  for (const signal of ALL_SIGNALS) {
    signal.pattern.lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = signal.pattern.exec(lower)) !== null) {
      const start = match.index
      const end = start + match[0].length

      let overlaps = false
      for (let i = start; i < end; i++) {
        if (consumed.has(i)) {
          overlaps = true
          break
        }
      }

      if (!overlaps) {
        for (let i = start; i < end; i++) {
          consumed.add(i)
        }

        if (!signal.isNegative) {
          positiveScore += signal.weight
          if (!matchedSignals.includes(signal.keyword)) {
            matchedSignals.push(signal.keyword)
          }
        } else {
          negativeScore += signal.weight * 0.5
        }
      }
    }
  }

  const rawScore = positiveScore - negativeScore
  const confidence = sigmoid(rawScore / 2.0)
  const topClass: 'design' | 'other' = confidence > 0.5 ? 'design' : 'other'
  const otherConf = 1 - confidence
  const secondBestGap = Math.abs(confidence - otherConf)

  return { confidence, matchedSignals, topClass, secondBestGap }
}
