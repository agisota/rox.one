import { describe, expect, test } from 'bun:test';
import type { PromptRewriteOutput } from '@craft-agent/shared/workbench';
import { renderToStaticMarkup } from 'react-dom/server';
import { PromptLabScreen } from '../PromptLabScreen';
import { ReviewGateScreen } from '../ReviewGateScreen';
import { TddPlanScreen } from '../TddPlanScreen';
import {
  createPromptLabState,
  createReviewGateState,
  createTddPlanState,
} from '../artifact-screen-state';

describe('Workbench artifact screens', () => {
  test('Prompt Lab renders empty and error states without provider execution', () => {
    const empty = renderToStaticMarkup(<PromptLabScreen state={createPromptLabState({ rawInput: '' })} />);
    expect(empty).toContain('Prompt Lab');
    expect(empty).toContain('Запрос еще не введен');
    expect(empty).toContain('Заменить ввод');
    expect(empty).toContain('disabled=""');

    const error = renderToStaticMarkup(
      <PromptLabScreen state={createPromptLabState({ rawInput: '   ', status: 'error', error: 'empty prompt' })} />,
    );
    expect(error).toContain('empty prompt');
    expect(error).not.toContain('provider call.');
  });

  test('Prompt Lab renders original, improved prompt, and handoff actions', () => {
    const state = createPromptLabState({
      rawInput: 'Build teams and account UX',
      status: 'success',
      output: makeRewriteOutput(),
    });
    const markup = renderToStaticMarkup(<PromptLabScreen state={state} />);

    expect(markup).toContain('Исходный запрос');
    expect(markup).toContain('Улучшенный запрос');
    expect(markup).toContain('Build teams and account UX');
    expect(markup).toContain('Use an in-app account cabinet');
    expect(markup).toContain('В TDD Plan');
    expect(markup).toContain('В ТЗ');
  });

  test('TDD Plan renders red-green-verify-worklog columns and fake providers', () => {
    const state = createTddPlanState({
      rawInput: 'Implement team storage spaces',
      ticketId: 'T032',
      validationGates: ['unit_tests', 'ui_tests', 'security_check', 'quota_check'],
      touchedSurfaces: ['team', 'storage:s3', 'auth'],
    });
    const markup = renderToStaticMarkup(<TddPlanScreen state={state} />);

    expect(markup).toContain('TDD Plan');
    expect(markup).toContain('RED');
    expect(markup).toContain('GREEN');
    expect(markup).toContain('VERIFY');
    expect(markup).toContain('WORKLOG');
    expect(markup).toContain('fake team/RBAC');
    expect(markup).toContain('fake S3/storage');
    expect(markup).toContain('Вставить план');
    expect(markup).toContain('Подготовить запуск');
  });

  test('Review Gate renders check and tear-down tabs with findings', () => {
    const state = createReviewGateState({
      rawInput: 'This is the best account and team storage system. API_KEY=secret',
      variant: 'tear-down',
      requiredGates: ['fact_check', 'logic_check', 'security_check'],
    });
    const markup = renderToStaticMarkup(<ReviewGateScreen state={state} />);

    expect(markup).toContain('Review Gate');
    expect(markup).toContain('Проверка');
    expect(markup).toContain('Разъебать');
    expect(markup).toContain('Secret-like content appears in review artifact');
    expect(markup).toContain('Fact-check gate lacks source evidence');
    expect(markup).toContain('Вставить замечания');
  });

  test('Review Gate renders validation evidence findings with severity, evidence, and fix plan labels', () => {
    const state = createReviewGateState({
      rawInput: 'Render validation evidence in the review board',
      variant: 'check',
      requiredGates: ['ui_tests'],
      evidence: [
        {
          evidenceId: 'ev-review-gate-ui',
          gateId: 'ui_tests',
          command: 'bun test apps/electron/src/renderer/components/workbench/__tests__/artifact-screens.test.tsx',
          summary: 'Review Gate did not render the validation evidence fix plan.',
          artifactRefs: ['apps/electron/src/renderer/components/workbench/ReviewGateScreen.tsx'],
          passed: false,
          severity: 'critical',
          findingTitle: 'Review Gate hides validation evidence',
          fixPlan: 'Render severity, evidence, and fix plan labels in the Review Gate findings list.',
        },
      ],
    });
    const markup = renderToStaticMarkup(<ReviewGateScreen state={state} />);

    expect(state.result.findings).toContainEqual(
      expect.objectContaining({
        title: 'Review Gate hides validation evidence',
        severity: 'critical',
        fixPlan: 'Render severity, evidence, and fix plan labels in the Review Gate findings list.',
      }),
    );
    expect(markup).toContain('Review Gate hides validation evidence');
    expect(markup).toContain('Severity');
    expect(markup).toContain('critical');
    expect(markup).toContain('Evidence');
    expect(markup).toContain('Review Gate did not render the validation evidence fix plan.');
    expect(markup).toContain('Fix plan');
    expect(markup).toContain('Render severity, evidence, and fix plan labels in the Review Gate findings list.');
  });
});

function makeRewriteOutput(): PromptRewriteOutput {
  return {
    originalPrompt: 'Build teams and account UX',
    rewrittenPrompt: 'Use an in-app account cabinet with team spaces, billing, and storage status.',
    role: 'Staff product engineer',
    objective: 'Use an in-app account cabinet',
    context: 'Composer prompt',
    assumptions: ['The account UX should stay inside ROX ONE.'],
    constraints: ['No browser pane for login.'],
    deliverables: ['Prompt Lab diff', 'TDD Plan handoff'],
    acceptanceCriteria: ['Replace input uses the improved prompt.'],
    verificationPlan: ['Render/click tests cover empty and success states.'],
    missingQuestions: ['Which team role starts as default?'],
  };
}
