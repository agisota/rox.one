import { describe, expect, test } from 'bun:test';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SpecBuilderScreen } from '../SpecBuilderScreen';
import {
  createSpecBuilderPreview,
  createSpecBuilderState,
  toggleSpecBuilderOption,
} from '../spec-builder-state';

describe('Spec Builder screen', () => {
  test('renders option categories and the initial spec preview shell', () => {
    const state = createSpecBuilderState({
      source: 'manual',
      rawInput: 'Create a product spec for cloud sync',
      modeId: 'spec',
    });
    const markup = renderToStaticMarkup(<SpecBuilderScreen initialState={state} />);

    expect(markup).toContain('Spec Builder');
    expect(markup).toContain('Research depth');
    expect(markup).toContain('Selected requirements');
    expect(markup).toContain('Spec preview');
    expect(markup).toContain('Start Agent Plan');
  });

  test('selecting an option updates selected requirements and derived config', () => {
    let state = createSpecBuilderState({
      source: 'manual',
      rawInput: 'Prepare market research with primary sources',
      modeId: 'research',
    });

    expect(state.selectedOptionIds).toEqual([]);
    expect(state.availableOptionIds).not.toContain('sources:primary-sources');

    state = toggleSpecBuilderOption(state, 'research:research-grade');
    expect(state.selectedOptionIds).toContain('research:research-grade');
    expect(state.availableOptionIds).toContain('sources:primary-sources');
    expect(state.derivedConfig?.agents).toContain('research-agent');
    expect(state.derivedConfig?.validationGates).toContain('fact_check');

    state = toggleSpecBuilderOption(state, 'sources:primary-sources');
    expect(state.selectedOptions.map((option) => option.id)).toEqual(['research:research-grade', 'sources:primary-sources']);
    expect(state.derivedConfig?.sections).toEqual(['methodology', 'source_requirements']);
  });

  test('disables export until the spec has input and selected requirements', () => {
    expect(
      createSpecBuilderState({
        source: 'manual',
        rawInput: '',
        modeId: 'spec',
        selectedOptionIds: ['audience:executive'],
      }).canExport,
    ).toBe(false);

    expect(
      createSpecBuilderState({
        source: 'manual',
        rawInput: 'Create a product spec',
        modeId: 'spec',
      }).canExport,
    ).toBe(false);

    expect(
      createSpecBuilderState({
        source: 'manual',
        rawInput: 'Create a product spec',
        modeId: 'spec',
        selectedOptionIds: ['audience:executive'],
      }).canExport,
    ).toBe(true);
  });

  test('preselects options from Thinking Partner handoff payloads', () => {
    const state = createSpecBuilderState({
      source: 'thinking-partner',
      rawInput: 'Generate a research-grade product spec',
      modeId: 'spec',
      selectedOptionIds: ['research:research-grade', 'sources:primary-sources', 'audience:executive'],
    });

    expect(state.source).toBe('thinking-partner');
    expect(state.selectedOptionIds).toEqual(['research:research-grade', 'sources:primary-sources', 'audience:executive']);
    expect(state.selectedOptions.map((option) => option.label)).toEqual(['Research-grade', 'Primary sources', 'Executive audience']);
    expect(state.derivedConfig?.sections).toEqual(['methodology', 'source_requirements', 'executive_summary']);
  });

  test('generates a deterministic preview from selected options', () => {
    const state = createSpecBuilderState({
      source: 'prompt-rewrite',
      rawInput: 'Build a TDD plan for a cloud team workspace',
      modeId: 'build',
      selectedOptionIds: ['tdd:test-first', 'security:tenant-isolation'],
    });
    const preview = createSpecBuilderPreview(state);

    expect(preview).toContain('# Spec Builder Preview');
    expect(preview).toContain('Build a TDD plan for a cloud team workspace');
    expect(preview).toContain('- Test-first TDD');
    expect(preview).toContain('- Tenant isolation');
    expect(preview).toContain('- test_plan');
    expect(preview).toContain('- security_model');
    expect(preview).toContain('- security-compliance-pack');
  });
});
