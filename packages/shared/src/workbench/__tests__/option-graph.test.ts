import { describe, expect, it } from 'bun:test';
import {
  DEFAULT_OPTION_GRAPH,
  OPTION_GRAPH_CATEGORIES,
  OptionGraphOptionSchema,
  getOptionGraphFixture,
  resolveOptionGraphExecutionConfig,
  resolveOptionGraphOptions,
  validateOptionGraph,
} from '../option-graph';

describe('Option Graph', () => {
  it('validates the required option categories and graph metadata', () => {
    expect(OPTION_GRAPH_CATEGORIES).toEqual([
      'output_type',
      'depth',
      'audience',
      'format',
      'style',
      'design',
      'research_depth',
      'geography',
      'recency',
      'source_requirements',
      'api_requirements',
      'security',
      'compliance',
      'testing',
      'tdd',
      'deliverables',
      'diagrams',
      'metrics',
      'risks',
      'validation',
    ]);

    expect(validateOptionGraph(DEFAULT_OPTION_GRAPH).optionCount).toBeGreaterThan(15);

    expect(() =>
      OptionGraphOptionSchema.parse({
        id: 'bad',
        category: 'not-a-category',
        label: 'Bad',
        description: 'Bad option',
        complexityWeight: 1,
      }),
    ).toThrow();
  });

  it('filters available options by intent, mode, selected dependencies, and exclusions', () => {
    const initial = resolveOptionGraphOptions({
      rawIntent: 'prepare market research for enterprise buyers',
      modeId: 'research',
      selectedOptionIds: [],
    });

    expect(initial.availableOptionIds).toContain('research:research-grade');
    expect(initial.availableOptionIds).not.toContain('sources:primary-sources');

    const withResearch = resolveOptionGraphOptions({
      rawIntent: 'prepare market research for enterprise buyers',
      modeId: 'research',
      selectedOptionIds: ['research:research-grade', 'format:markdown'],
    });

    expect(withResearch.availableOptionIds).toContain('sources:primary-sources');
    expect(withResearch.availableOptionIds).not.toContain('format:json');
  });

  it('derives skills, agents, gates, sections, and artifacts from selected options', () => {
    const derived = resolveOptionGraphExecutionConfig({
      rawIntent: 'build a cloud team feature with tests',
      modeId: 'build',
      permissionMode: 'ask',
      selectedOptionIds: ['tdd:test-first', 'testing:unit-integration', 'security:tenant-isolation'],
    });

    expect(derived.skills).toEqual(expect.arrayContaining(['multi-agent-planning-pack', 'tdd-qa-verification-pack', 'security-compliance-pack']));
    expect(derived.agents).toEqual(expect.arrayContaining(['builder-agent', 'test-agent', 'verifier-agent']));
    expect(derived.validationGates).toEqual(expect.arrayContaining(['unit_tests', 'integration_tests', 'e2e_tests', 'security_check', 'rbac_check']));
    expect(derived.sections).toEqual(expect.arrayContaining(['test_plan', 'implementation_tasks', 'security_model']));
    expect(derived.outputArtifactTypes).toEqual(expect.arrayContaining(['code', 'tasks']));
    expect(derived.complexityWeight).toBeGreaterThanOrEqual(7);
  });

  it('rejects unresolved dependencies and mutually exclusive options', () => {
    expect(() =>
      resolveOptionGraphExecutionConfig({
        rawIntent: 'market research',
        modeId: 'research',
        permissionMode: 'safe',
        selectedOptionIds: ['sources:primary-sources'],
      }),
    ).toThrow('Option sources:primary-sources requires research:research-grade');

    expect(() =>
      resolveOptionGraphExecutionConfig({
        rawIntent: 'export this spec',
        modeId: 'spec',
        permissionMode: 'safe',
        selectedOptionIds: ['format:markdown', 'format:json'],
      }),
    ).toThrow('Option format:markdown excludes format:json');
  });

  it('ships deterministic fixtures for common task shapes', () => {
    const marketResearch = getOptionGraphFixture('market-research');
    const derived = resolveOptionGraphExecutionConfig({
      rawIntent: marketResearch.rawIntent,
      modeId: marketResearch.modeId,
      permissionMode: marketResearch.permissionMode,
      selectedOptionIds: marketResearch.selectedOptionIds,
    });

    expect(marketResearch.selectedOptionIds).toEqual([
      'research:research-grade',
      'sources:primary-sources',
      'recency:current',
      'audience:executive',
      'format:markdown',
      'metrics:success',
      'risk:matrix',
    ]);

    expect(derived.sections).toEqual([
      'methodology',
      'source_requirements',
      'recency_policy',
      'executive_summary',
      'success_metrics',
      'risk_matrix',
    ]);
    expect(derived.validationGates).toEqual(expect.arrayContaining(['fact_check', 'logic_check']));
    expect(derived.agents).toContain('research-agent');
  });
});
