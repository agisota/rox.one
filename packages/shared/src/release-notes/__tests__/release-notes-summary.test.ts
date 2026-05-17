import { describe, expect, test } from 'bun:test'

import {
  buildReleaseNotesListFromFiles,
  getCombinedReleaseNotesFromFiles,
} from '../index'

describe('release notes display summaries', () => {
  test('prefers compact Russian summaries without counting them as releases', () => {
    const notes = buildReleaseNotesListFromFiles({
      '0.9.1.md': '# v0.9.1\n\n- Long English source entry.',
      '0.9.1.ru.md': '# Что нового в v0.9.1\n\n- Telegram: доступ ограничивается владельцами и списками разрешений.\n- AI: добавлен выбор между очередью и управлением текущим ответом.',
      '0.9.0.md': '# v0.9.0\n\n- English fallback entry.',
      'next.md': '# Pending\n\n- Unreleased draft.',
    })

    expect(notes.map(note => note.version)).toEqual(['0.9.1', '0.9.0'])
    expect(notes[0]?.content).toContain('Что нового')
    expect(notes[0]?.content).toContain('Telegram: доступ ограничивается')
    expect(notes[0]?.content).not.toContain('Long English source')
    expect(notes[1]?.content).toContain('English fallback entry')
  })

  test('combines display notes in newest-first semver order', () => {
    const markdown = getCombinedReleaseNotesFromFiles({
      '0.10.0.md': '- English source for future release.',
      '0.10.0.ru.md': '- Будущая версия: краткая русская сводка.',
      '0.9.9.md': '- Previous English source.',
      '0.9.9.ru.md': '- Предыдущая версия: краткая русская сводка.',
      'next.md': '- Draft entry.',
    })

    expect(markdown).toStartWith('# v0.10.0\n\n- Будущая версия')
    expect(markdown).toContain('\n\n---\n\n# v0.9.9\n\n- Предыдущая версия')
    expect(markdown).not.toContain('Draft entry')
    expect(markdown).not.toContain('English source for future release')
  })
})
