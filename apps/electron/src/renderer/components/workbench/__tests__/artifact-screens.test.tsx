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
    expect(empty).toContain('No prompt yet');
    expect(empty).toContain('Replace Input');
    expect(empty).toContain('disabled=""');

    const error = renderToStaticMarkup(
      <PromptLabScreen state={createPromptLabState({ rawInput: '   ', status: 'error', error: 'empty prompt' })} />,
    );
    expect(error).toContain('empty prompt');
    expect(error).not.toContain('provider call');
  });

  test('Prompt Lab renders original, improved prompt, and handoff actions', () => {
    const state = createPromptLabState({
      rawInput: 'Build teams and account UX',
      status: 'success',
      output: makeRewriteOutput(),
    });
    const markup = renderToStaticMarkup(<PromptLabScreen state={state} />);

    expect(markup).toContain('Original prompt');
    expect(markup).toContain('Improved prompt');
    expect(markup).toContain('Build teams and account UX');
    expect(markup).toContain('Use an in-app account cabinet');
    expect(markup).toContain('Send to TDD Plan');
    expect(markup).toContain('Send to Spec');
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
    expect(markup).toContain('Insert Plan');
    expect(markup).toContain('Start TDD');
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
    expect(markup).toContain('Apply Notes');
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
