/**
 * Russian keyword signals for design task classification.
 * Each entry is [keyword, weight] where weight ≥ 1.
 * Longer / more specific phrases get higher implicit weight via length bonus in scorer.
 */
export const RU_POSITIVE_SIGNALS: readonly [string, number][] = [
  ['дизайн-система', 3],
  ['мобильный экран', 2],
  ['react-компонент', 2],
  ['лендинг', 2],
  ['макет', 1],
  // stem 'слайд' matches слайды/слайда/слайдов/слайде
  ['слайд', 1],
  ['прототип', 2],
  ['дашборд', 2],
  // stem 'презентаци' matches презентация/презентации/презентацию
  ['презентаци', 1],
  ['пайчарт', 2],
  // stem 'иллюстраци' matches иллюстрация/иллюстрации
  ['иллюстраци', 1],
  ['фигма', 2],
  ['figma', 2],
  ['design', 1],
  ['ui', 1],
  ['ux', 1],
]

export const RU_NEGATIVE_SIGNALS: readonly [string, number][] = [
  // stem 'мигра' matches миграция/миграции/миграцию
  ['мигра', 1],
  ['деплой', 1],
  ['облако', 1],
  ['бэкенд', 2],
  ['backend', 2],
  ['database', 2],
  ['инфра', 2],
  ['баг', 1],
  ['тест', 1],
  ['бд', 1],
  ['sql', 2],
]
