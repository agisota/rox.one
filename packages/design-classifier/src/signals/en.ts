/**
 * English keyword signals for design task classification.
 * Each entry is [keyword, weight].
 * Multi-word phrases are matched before single words to avoid double-counting.
 */
export const EN_POSITIVE_SIGNALS: readonly [string, number][] = [
  ['design system', 3],
  ['landing page', 3],
  ['mobile screen', 2],
  ['react component', 2],
  ['pitch deck', 2],
  ['mockup', 2],
  ['prototype', 2],
  ['dashboard', 2],
  ['figma', 2],
  ['hi-fi', 2],
  ['lo-fi', 2],
  ['slides', 1],
  ['presentation', 1],
  ['landing', 1],
  ['design', 1],
  ['ui', 1],
  ['ux', 1],
]

export const EN_NEGATIVE_SIGNALS: readonly [string, number][] = [
  ['migration', 1],
  ['database', 2],
  ['backend', 2],
  ['deploy', 1],
  ['infra', 2],
  ['bug', 1],
  ['fix', 1],
  ['test', 1],
  ['sql', 2],
]
