import { describe, expect, test } from 'bun:test';
import { createProductModeIntent } from '../product-mode-toolbar';
import {
  COMPOSER_QUICK_ACTION_SECTION_LABELS,
  createComposerQuickActionPrompt,
} from '../composer-quick-action-flow';

describe('composer quick action prompt wrappers', () => {
  test('wraps a non-empty composer prompt with the selected quick action command', () => {
    const result = createComposerQuickActionPrompt({
      intent: createProductModeIntent('run-tdd-plan', 'research'),
      rawInput: 'Add account billing retries',
      selectedMode: 'research',
      workingDirectory: '/repo/rox-one',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.prompt).toContain('# TDD план');
    expect(result.prompt).toContain('Add account billing retries');
    expect(result.prompt).toContain('/repo/rox-one');
    for (const label of COMPOSER_QUICK_ACTION_SECTION_LABELS) {
      expect(result.prompt).toContain(`## ${label}`);
    }
  });

  test('uses follow-up context as a valid target when composer text is empty', () => {
    const result = createComposerQuickActionPrompt({
      intent: createProductModeIntent('review', 'research'),
      rawInput: '   ',
      selectedMode: 'research',
      contextItems: [
        {
          kind: 'follow-up',
          label: 'Follow-up #1',
          text: 'Selected assistant answer\nNote: verify this conclusion',
        },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.targetKind).toBe('follow-up');
    expect(result.prompt).toContain('# Ревью');
    expect(result.prompt).toContain('Selected assistant answer');
    expect(result.prompt).toContain('verify this conclusion');
  });

  test('uses attachment metadata as explicit context without requiring typed text', () => {
    const result = createComposerQuickActionPrompt({
      intent: createProductModeIntent('build-spec', 'research'),
      rawInput: '',
      selectedMode: 'research',
      contextItems: [
        {
          kind: 'attachment',
          label: 'requirements.pdf',
          path: '/tmp/requirements.pdf',
        },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.targetKind).toBe('attachment');
    expect(result.prompt).toContain('# Собрать ТЗ');
    expect(result.prompt).toContain('requirements.pdf');
    expect(result.prompt).toContain('/tmp/requirements.pdf');
  });

  test('does not treat working directory or labels alone as a valid target', () => {
    const result = createComposerQuickActionPrompt({
      intent: createProductModeIntent('verify', 'research'),
      rawInput: '   ',
      selectedMode: 'research',
      workingDirectory: '/repo/rox-one',
      sessionLabels: ['review'],
      currentSessionStatus: 'Running',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('empty-target');
  });

  test('keeps all six quick actions on stable wrapper headings', () => {
    const expectedHeadings = [
      ['improve-prompt', '# Улучшить запрос'],
      ['run-tdd-plan', '# TDD план'],
      ['verify', '# Проверить'],
      ['tear-down', '# Разъебать'],
      ['build-spec', '# Собрать ТЗ'],
      ['review', '# Ревью'],
    ] as const;

    for (const [actionId, heading] of expectedHeadings) {
      const result = createComposerQuickActionPrompt({
        intent: createProductModeIntent(actionId, 'research'),
        rawInput: 'Make this better',
        selectedMode: 'research',
      });

      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(result.prompt.startsWith(heading)).toBe(true);
    }
  });
});
