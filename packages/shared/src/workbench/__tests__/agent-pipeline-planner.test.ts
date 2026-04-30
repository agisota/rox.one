import { describe, expect, it } from 'bun:test';

import { ProductAgentRoleSchema } from '../product-mode-registry';
import {
  AgentPipelinePlanSchema,
  getAgentRoleCatalog,
  planAgentPipeline,
} from '../agent-pipeline-planner';

describe('agent role registry', () => {
  it('defines every supported product agent role exactly once', () => {
    const catalog = getAgentRoleCatalog();

    expect(catalog.map((role) => role.roleId)).toEqual(ProductAgentRoleSchema.options);
    expect(new Set(catalog.map((role) => role.roleId)).size).toBe(ProductAgentRoleSchema.options.length);
    expect(catalog.every((role) => role.label.length > 0 && role.responsibilities.length > 0)).toBe(true);
  });
});

describe('planAgentPipeline', () => {
  it('plans a TDD build pipeline with tests before implementation and verification after review', () => {
    const plan = planAgentPipeline({
      planId: 'pipeline-build-tdd',
      rawInput: 'Build a tenant-safe workflow with tests and review gates.',
      modeId: 'build',
      permissionMode: 'ask',
      selectedOptionIds: ['tdd:test-first', 'security:tenant-isolation'],
    });

    expect(AgentPipelinePlanSchema.parse(plan).planId).toBe('pipeline-build-tdd');
    expect(plan.skills).toEqual(
      expect.arrayContaining(['multi-agent-planning-pack', 'tdd-qa-verification-pack', 'security-compliance-pack']),
    );
    expect(plan.validationGates).toEqual(
      expect.arrayContaining(['schema', 'unit_tests', 'integration_tests', 'ui_tests', 'e2e_tests', 'rbac_check']),
    );

    const stages = plan.stages.map((stage) => stage.roleId);
    expect(stages).toEqual(['planner-agent', 'test-agent', 'builder-agent', 'critic-agent', 'verifier-agent']);
    expect(plan.stages.find((stage) => stage.roleId === 'builder-agent')?.dependsOn).toEqual([
      'stage-002-test-agent',
    ]);
    expect(plan.stages.find((stage) => stage.roleId === 'verifier-agent')?.dependsOn).toEqual([
      'stage-004-critic-agent',
    ]);
    expect(plan.handoffContracts).toContainEqual(
      expect.objectContaining({
        fromStageId: 'stage-002-test-agent',
        toStageId: 'stage-003-builder-agent',
        artifactTypes: ['tasks', 'code'],
      }),
    );
  });

  it('keeps research and synthesis lanes deterministic for research mode', () => {
    const plan = planAgentPipeline({
      planId: 'pipeline-research',
      rawInput: 'Research current market evidence with primary sources.',
      modeId: 'research',
      permissionMode: 'safe',
      selectedOptionIds: ['research:research-grade', 'sources:primary-sources', 'recency:current'],
    });

    expect(plan.stages.map((stage) => stage.roleId)).toEqual([
      'research-agent',
      'verifier-agent',
      'synthesizer-agent',
    ]);
    expect(plan.validationGates).toEqual(expect.arrayContaining(['schema', 'fact_check', 'logic_check']));
    expect(plan.stages.find((stage) => stage.roleId === 'verifier-agent')?.dependsOn).toEqual([
      'stage-001-research-agent',
    ]);
    expect(plan.handoffContracts.every((contract) => contract.required)).toBe(true);
  });

  it('deduplicates selected agents while preserving role-order dependencies', () => {
    const plan = planAgentPipeline({
      planId: 'pipeline-review',
      rawInput: 'Review a launch report for factual and security issues.',
      modeId: 'review',
      permissionMode: 'safe',
      selectedOptionIds: ['output:review-report', 'validation:strict-gates'],
      selectedAgents: ['critic-agent', 'research-agent', 'verifier-agent'],
    });

    expect(plan.stages.map((stage) => stage.roleId)).toEqual([
      'research-agent',
      'critic-agent',
      'verifier-agent',
      'synthesizer-agent',
    ]);
    expect(plan.stages.filter((stage) => stage.roleId === 'critic-agent')).toHaveLength(1);
    expect(plan.stages.find((stage) => stage.roleId === 'verifier-agent')?.dependsOn).toEqual([
      'stage-002-critic-agent',
    ]);
  });
});
