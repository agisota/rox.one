import { describe, expect, it } from 'bun:test';

import { compileWorkbenchSpec } from '../spec-compiler';
import {
  ReviewBoardResultSchema,
  createReviewBoardInputFromCompiledSpec,
  runReviewBoard,
} from '../review-board';

describe('createReviewBoardInputFromCompiledSpec', () => {
  it('derives deterministic reviewers, gates, and review artifacts from a compiled spec', () => {
    const compiled = compileWorkbenchSpec({
      rawInput: 'Review the launch plan for security, evidence, and delivery readiness.',
      modeId: 'board',
      permissionMode: 'ask',
      selectedOptionIds: ['output:review-report', 'validation:strict-gates', 'security:tenant-isolation'],
      createdAt: '2026-04-30T13:00:00.000Z',
    });

    const boardInput = createReviewBoardInputFromCompiledSpec(compiled, {
      boardId: 'board-001',
      artifacts: [
        {
          artifactId: 'launch-plan',
          artifactType: 'spec',
          title: 'Launch plan',
          content: 'The plan includes tests, source-backed claims, and deny-by-default auth checks.',
          sources: ['docs/worklog/T012-spec-compiler-export.md'],
        },
      ],
    });

    expect(boardInput.reviewers.map((reviewer) => reviewer.id)).toEqual([
      'logic-critic',
      'fact-checker',
      'security-reviewer',
      'completion-verifier',
    ]);
    expect(boardInput.requiredGates).toEqual([
      'logic_check',
      'fact_check',
      'security_check',
      'rbac_check',
      'schema',
    ]);
    expect(boardInput.artifacts.map((artifact) => artifact.artifactId)).toEqual(['launch-plan']);
  });
});

describe('runReviewBoard', () => {
  it('fails when a protected artifact includes secret-like content', () => {
    const result = runReviewBoard({
      boardId: 'board-security',
      title: 'Security review',
      requiredGates: ['schema', 'security_check', 'logic_check'],
      reviewers: [
        {
          id: 'security-reviewer',
          label: 'Security reviewer',
          gateIds: ['security_check'],
        },
      ],
      artifacts: [
        {
          artifactId: 'config',
          artifactType: 'file',
          title: 'Config sample',
          content: 'Set SECRET_TOKEN=plain-text-token inside the checked-in config.',
          protected: true,
        },
      ],
    });

    expect(ReviewBoardResultSchema.parse(result).verdict).toBe('fail');
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        reviewerId: 'security-reviewer',
        severity: 'critical',
        gateIds: ['security_check'],
      }),
    );
    expect(result.checks).toContainEqual(
      expect.objectContaining({
        gateId: 'security_check',
        status: 'fail',
      }),
    );
  });

  it('warns when fact-check gates lack source evidence', () => {
    const result = runReviewBoard({
      boardId: 'board-facts',
      title: 'Fact review',
      requiredGates: ['schema', 'fact_check', 'logic_check'],
      reviewers: [
        {
          id: 'fact-checker',
          label: 'Fact checker',
          gateIds: ['fact_check'],
        },
      ],
      artifacts: [
        {
          artifactId: 'market-claim',
          artifactType: 'report',
          title: 'Market claim',
          content: 'The market is growing quickly and this is the leading product.',
        },
      ],
    });

    expect(result.verdict).toBe('warn');
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        reviewerId: 'fact-checker',
        severity: 'medium',
        gateIds: ['fact_check'],
      }),
    );
    expect(result.checks).toContainEqual(
      expect.objectContaining({
        gateId: 'fact_check',
        status: 'warn',
      }),
    );
  });

  it('fails required RBAC gates without deny-by-default evidence', () => {
    const result = runReviewBoard({
      boardId: 'board-rbac',
      title: 'RBAC review',
      requiredGates: ['schema', 'rbac_check'],
      reviewers: [
        {
          id: 'tenant-isolation-reviewer',
          label: 'Tenant isolation reviewer',
          gateIds: ['rbac_check'],
        },
      ],
      artifacts: [
        {
          artifactId: 'team-access',
          artifactType: 'spec',
          title: 'Team access',
          content: 'Team access must not leak records across tenants.',
        },
      ],
    });

    expect(result.verdict).toBe('fail');
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        reviewerId: 'tenant-isolation-reviewer',
        severity: 'high',
        gateIds: ['rbac_check'],
      }),
    );
    expect(result.checks).toContainEqual(
      expect.objectContaining({
        gateId: 'rbac_check',
        status: 'fail',
      }),
    );
  });

  it('passes a sourced artifact with clean security and validation evidence', () => {
    const result = runReviewBoard({
      boardId: 'board-pass',
      title: 'Release verification',
      requiredGates: ['schema', 'fact_check', 'security_check', 'rbac_check', 'unit_tests'],
      reviewers: [
        {
          id: 'fact-checker',
          label: 'Fact checker',
          gateIds: ['fact_check'],
        },
        {
          id: 'security-reviewer',
          label: 'Security reviewer',
          gateIds: ['security_check', 'rbac_check'],
        },
        {
          id: 'completion-verifier',
          label: 'Completion verifier',
          gateIds: ['unit_tests'],
        },
      ],
      artifacts: [
        {
          artifactId: 'release-note',
          artifactType: 'report',
          title: 'Release note',
          content: 'All claims cite docs/worklog/T012-spec-compiler-export.md and unit tests passed.',
          sources: ['docs/worklog/T012-spec-compiler-export.md'],
        },
      ],
      evidence: [
        {
          gateId: 'rbac_check',
          command: 'bun test packages/shared/src/workbench/__tests__/review-board.test.ts',
          summary: 'RBAC deny-by-default case passed',
        },
        {
          gateId: 'unit_tests',
          command: 'bun test packages/shared/src/workbench/__tests__/review-board.test.ts',
          summary: '4 pass, 0 fail',
        },
      ],
    });

    expect(result.verdict).toBe('pass');
    expect(result.findings).toEqual([]);
    expect(result.checks.every((check) => check.status === 'pass')).toBe(true);
  });
});
