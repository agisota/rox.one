import { describe, expect, it } from 'bun:test';

import { ValidationGateSchema } from '../product-mode-registry';
import { compileWorkbenchSpec } from '../spec-compiler';
import {
  ValidationGateRunResultSchema,
  createValidationGateRunFromCompiledSpec,
  getValidationGateCatalog,
  runValidationGates,
} from '../validation-gates';

describe('validation gate catalog', () => {
  it('defines every supported validation gate exactly once', () => {
    const catalog = getValidationGateCatalog();

    expect(catalog.map((gate) => gate.gateId)).toEqual(ValidationGateSchema.options);
    expect(new Set(catalog.map((gate) => gate.gateId)).size).toBe(ValidationGateSchema.options.length);
    expect(catalog.every((gate) => gate.label.length > 0 && gate.description.length > 0)).toBe(true);
  });

  it('marks test, RBAC, quota, and sync gates as evidence-required blocking gates', () => {
    const blockingEvidenceGates = getValidationGateCatalog()
      .filter((gate) => gate.requiresEvidence)
      .map((gate) => gate.gateId);

    expect(blockingEvidenceGates).toEqual([
      'unit_tests',
      'integration_tests',
      'ui_tests',
      'e2e_tests',
      'rbac_check',
      'quota_check',
      'sync_check',
    ]);
    expect(
      getValidationGateCatalog()
        .filter((gate) => blockingEvidenceGates.includes(gate.gateId))
        .every((gate) => gate.blocking),
    ).toBe(true);
  });
});

describe('runValidationGates', () => {
  it('passes non-evidence gates and supplied blocking evidence deterministically', () => {
    const result = runValidationGates({
      runId: 'validation-pass',
      requiredGates: ['schema', 'logic_check', 'unit_tests', 'rbac_check'],
      evidence: [
        {
          gateId: 'unit_tests',
          command: 'bun test packages/shared/src/workbench/__tests__/validation-gates.test.ts',
          summary: 'Unit validation passed',
        },
        {
          gateId: 'rbac_check',
          command: 'bun test packages/shared/src/workbench/__tests__/tenant-rbac.test.ts',
          summary: 'Deny-by-default matrix passed',
        },
      ],
    });

    expect(ValidationGateRunResultSchema.parse(result).verdict).toBe('pass');
    expect(result.checks.map((check) => [check.gateId, check.status, check.missingEvidence])).toEqual([
      ['schema', 'pass', false],
      ['logic_check', 'pass', false],
      ['unit_tests', 'pass', false],
      ['rbac_check', 'pass', false],
    ]);
  });

  it('fails missing RBAC, quota, and sync evidence before protected work can pass', () => {
    const result = runValidationGates({
      runId: 'validation-missing-security-evidence',
      requiredGates: ['schema', 'rbac_check', 'quota_check', 'sync_check'],
      evidence: [],
    });

    expect(result.verdict).toBe('fail');
    expect(result.checks).toContainEqual(
      expect.objectContaining({
        gateId: 'rbac_check',
        status: 'fail',
        severity: 'high',
        missingEvidence: true,
      }),
    );
    expect(result.checks).toContainEqual(
      expect.objectContaining({
        gateId: 'quota_check',
        status: 'fail',
        severity: 'high',
        missingEvidence: true,
      }),
    );
    expect(result.checks).toContainEqual(
      expect.objectContaining({
        gateId: 'sync_check',
        status: 'fail',
        severity: 'high',
        missingEvidence: true,
      }),
    );
  });

  it('fails when supplied evidence explicitly reports a failed command', () => {
    const result = runValidationGates({
      runId: 'validation-command-failed',
      requiredGates: ['schema', 'unit_tests'],
      evidence: [
        {
          gateId: 'unit_tests',
          command: 'bun test packages/shared/src/workbench/__tests__/validation-gates.test.ts',
          summary: 'Expected failing test still fails after implementation',
          passed: false,
        },
      ],
    });

    expect(result.verdict).toBe('fail');
    expect(result.checks).toContainEqual(
      expect.objectContaining({
        gateId: 'unit_tests',
        status: 'fail',
        evidence: 'Expected failing test still fails after implementation',
      }),
    );
  });

  it('creates a validation run from compiled specs without external providers', () => {
    const compiled = compileWorkbenchSpec({
      rawInput: 'Build a tenant-safe task workflow with tests and review evidence.',
      modeId: 'build',
      permissionMode: 'ask',
      selectedOptionIds: ['security:tenant-isolation'],
      createdAt: '2026-04-30T14:00:00.000Z',
    });

    const result = createValidationGateRunFromCompiledSpec(compiled, {
      runId: 'compiled-validation',
      evidence: [
        {
          gateId: 'unit_tests',
          command: 'bun test packages/shared/src/workbench/__tests__/validation-gates.test.ts',
          summary: 'Unit validation passed',
        },
        {
          gateId: 'integration_tests',
          command: 'bun test packages/shared/src/workbench/__tests__/spec-compiler.test.ts',
          summary: 'Compiler integration validation passed',
        },
        {
          gateId: 'rbac_check',
          command: 'bun test packages/shared/src/workbench/__tests__/tenant-rbac.test.ts',
          summary: 'Tenant isolation evidence passed',
        },
      ],
    });

    expect(result.requiredGates).toEqual([
      'schema',
      'unit_tests',
      'integration_tests',
      'logic_check',
      'security_check',
      'rbac_check',
    ]);
    expect(result.verdict).toBe('pass');
  });
});
