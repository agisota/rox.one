import { z } from 'zod';
import {
  ArtifactTypeSchema,
  ValidationGateSchema,
  type ValidationGate,
} from './product-mode-registry';
import {
  CompiledWorkbenchSpecSchema,
  type CompiledWorkbenchSpec,
} from './spec-compiler';
import {
  ValidationGateEvidenceSchema,
  type ParsedValidationGateEvidence,
  type ValidationGateEvidence,
  runValidationGates,
} from './validation-gates';

export const ReviewBoardVerdictSchema = z.enum(['pass', 'warn', 'fail'] as const);
export type ReviewBoardVerdict = z.infer<typeof ReviewBoardVerdictSchema>;

export const ReviewBoardCheckStatusSchema = z.enum(['pass', 'warn', 'fail'] as const);
export type ReviewBoardCheckStatus = z.infer<typeof ReviewBoardCheckStatusSchema>;

export const ReviewFindingSeveritySchema = z.enum(['low', 'medium', 'high', 'critical'] as const);
export type ReviewFindingSeverity = z.infer<typeof ReviewFindingSeveritySchema>;

export const ReviewBoardReviewerSchema = z.object({
  id: z.string().trim().min(1),
  label: z.string().trim().min(1),
  gateIds: z.array(ValidationGateSchema).min(1),
});
export type ReviewBoardReviewer = z.infer<typeof ReviewBoardReviewerSchema>;

export const ReviewBoardArtifactSchema = z.object({
  artifactId: z.string().trim().min(1),
  artifactType: ArtifactTypeSchema,
  title: z.string().trim().min(1),
  content: z.string().trim().min(1),
  sources: z.array(z.string().trim().min(1)).default([]),
  protected: z.boolean().default(false),
});
export type ReviewBoardArtifact = z.input<typeof ReviewBoardArtifactSchema>;
type ParsedReviewBoardArtifact = z.output<typeof ReviewBoardArtifactSchema>;

export const ReviewBoardEvidenceSchema = ValidationGateEvidenceSchema;
export type ReviewBoardEvidence = ValidationGateEvidence;

export const ReviewFindingSchema = z.object({
  id: z.string().trim().min(1),
  reviewerId: z.string().trim().min(1),
  severity: ReviewFindingSeveritySchema,
  gateIds: z.array(ValidationGateSchema).min(1),
  artifactId: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1),
  evidence: z.string().trim().min(1),
  fixPlan: z.string().trim().min(1),
  recommendation: z.string().trim().min(1),
});
export type ReviewFinding = z.infer<typeof ReviewFindingSchema>;

export const ReviewBoardCheckSchema = z.object({
  gateId: ValidationGateSchema,
  status: ReviewBoardCheckStatusSchema,
  evidence: z.string().trim().min(1),
});
export type ReviewBoardCheck = z.infer<typeof ReviewBoardCheckSchema>;

export const ReviewBoardInputSchema = z.object({
  boardId: z.string().trim().min(1),
  title: z.string().trim().min(1),
  requiredGates: z.array(ValidationGateSchema).min(1),
  reviewers: z.array(ReviewBoardReviewerSchema).min(1),
  artifacts: z.array(ReviewBoardArtifactSchema).min(1),
  evidence: z.array(ReviewBoardEvidenceSchema).default([]),
});
export type ReviewBoardInput = z.input<typeof ReviewBoardInputSchema>;
type ParsedReviewBoardInput = z.output<typeof ReviewBoardInputSchema>;

export const ReviewBoardResultSchema = z.object({
  boardId: z.string().trim().min(1),
  title: z.string().trim().min(1),
  verdict: ReviewBoardVerdictSchema,
  checks: z.array(ReviewBoardCheckSchema).min(1),
  findings: z.array(ReviewFindingSchema),
  reviewerCount: z.number().int().min(1),
  artifactCount: z.number().int().min(1),
});
export type ReviewBoardResult = z.infer<typeof ReviewBoardResultSchema>;

const DEFAULT_REVIEWERS: ReviewBoardReviewer[] = [
  {
    id: 'logic-critic',
    label: 'Logic critic',
    gateIds: ['logic_check'],
  },
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
    gateIds: ['schema', 'unit_tests', 'integration_tests', 'ui_tests', 'e2e_tests'],
  },
];

const SECRET_PATTERN = /\b(?:[a-z0-9_]*_)?(?:secret|api[_-]?key|token|password)(?:_[a-z0-9]+)*\b\s*[:=]/iu;
const UNCERTAIN_CLAIM_PATTERN = /\b(leading|best|fastest|largest|growing quickly|guaranteed)\b/iu;
function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function severityRank(severity: ReviewFindingSeverity): number {
  return {
    low: 1,
    medium: 2,
    high: 3,
    critical: 4,
  }[severity];
}

function statusRank(status: ReviewBoardCheckStatus): number {
  return {
    pass: 1,
    warn: 2,
    fail: 3,
  }[status];
}

function statusFromFindings(findings: ReviewFinding[]): ReviewBoardCheckStatus {
  if (findings.some((finding) => severityRank(finding.severity) >= severityRank('high'))) {
    return 'fail';
  }
  if (findings.length > 0) {
    return 'warn';
  }
  return 'pass';
}

function statusFromChecks(checks: ReviewBoardCheck[]): ReviewBoardVerdict {
  if (checks.some((check) => check.status === 'fail')) {
    return 'fail';
  }
  if (checks.some((check) => check.status === 'warn')) {
    return 'warn';
  }
  return 'pass';
}

function findingId(index: number): string {
  return `finding-${String(index + 1).padStart(3, '0')}`;
}

type ReviewFindingDraft = Omit<ReviewFinding, 'id' | 'recommendation'> & {
  recommendation?: string;
};

function makeFinding(input: ReviewFindingDraft, index: number): ReviewFinding {
  return ReviewFindingSchema.parse({
    id: findingId(index),
    ...input,
    recommendation: input.recommendation ?? input.fixPlan,
  });
}

function reviewerIdForGate(input: ParsedReviewBoardInput, gateId: ValidationGate, fallback: string): string {
  return input.reviewers.find((reviewer) => reviewer.gateIds.includes(gateId))?.id ?? fallback;
}

function findSecurityIssues(input: ParsedReviewBoardInput): ReviewFinding[] {
  const findings: ReviewFinding[] = [];

  for (const artifact of input.artifacts) {
    if (!SECRET_PATTERN.test(artifact.content)) {
      continue;
    }

    findings.push(
      makeFinding(
        {
          reviewerId: reviewerIdForGate(input, 'security_check', 'security-reviewer'),
          severity: artifact.protected ? 'critical' : 'high',
          gateIds: ['security_check'],
          artifactId: artifact.artifactId,
          title: 'Secret-like content appears in review artifact',
          evidence: `${artifact.title} contains a secret-like key assignment.`,
          fixPlan: 'Remove secret material from artifacts and replace it with a redacted fixture.',
        },
        findings.length,
      ),
    );
  }

  return findings;
}

function findFactIssues(input: ParsedReviewBoardInput, offset: number): ReviewFinding[] {
  if (!input.requiredGates.includes('fact_check')) {
    return [];
  }

  const findings: ReviewFinding[] = [];

  for (const artifact of input.artifacts) {
    if (artifact.sources.length > 0 || !UNCERTAIN_CLAIM_PATTERN.test(artifact.content)) {
      continue;
    }

    findings.push(
      makeFinding(
        {
          reviewerId: reviewerIdForGate(input, 'fact_check', 'fact-checker'),
          severity: 'medium',
          gateIds: ['fact_check'],
          artifactId: artifact.artifactId,
          title: 'Fact-check gate lacks source evidence',
          evidence: `${artifact.title} has factual or comparative claims without attached sources.`,
          fixPlan: 'Attach source artifacts or mark the claim as an assumption before approval.',
        },
        offset + findings.length,
      ),
    );
  }

  return findings;
}

function evidenceRecordSummary(record: ParsedValidationGateEvidence): string {
  return [
    record.summary,
    record.command ? `Command: ${record.command}.` : '',
    record.artifactRefs.length > 0 ? `Artifacts: ${record.artifactRefs.join(', ')}.` : '',
  ]
    .filter(Boolean)
    .join(' ');
}

function findValidationEvidenceIssues(input: ParsedReviewBoardInput, offset: number): ReviewFinding[] {
  const findings: ReviewFinding[] = [];
  const validationResult = runValidationGates({
    runId: `${input.boardId}-validation`,
    requiredGates: input.requiredGates,
    evidence: input.evidence,
  });

  for (const check of validationResult.checks) {
    const failedEvidenceRecords = check.evidenceRecords.filter((record) => !record.passed);

    if (failedEvidenceRecords.length > 0) {
      for (const evidenceRecord of failedEvidenceRecords) {
        findings.push(
          makeFinding(
            {
              reviewerId: reviewerIdForGate(input, check.gateId, 'completion-verifier'),
              severity: evidenceRecord.severity ?? check.severity,
              gateIds: [check.gateId],
              title: evidenceRecord.findingTitle ?? 'Validation evidence reports a failing gate',
              evidence: evidenceRecordSummary(evidenceRecord),
              fixPlan:
                evidenceRecord.fixPlan ??
                'Fix the failing validation evidence and rerun the gate before approval.',
            },
            offset + findings.length,
          ),
        );
      }

      continue;
    }

    if (!check.missingEvidence) {
      continue;
    }

    findings.push(
      makeFinding(
        {
          reviewerId: reviewerIdForGate(input, check.gateId, 'completion-verifier'),
          severity: check.severity,
          gateIds: [check.gateId],
          title: 'Required validation evidence is missing',
          evidence: check.evidence,
          fixPlan: 'Attach command or review evidence for this gate before marking the board complete.',
        },
        offset + findings.length,
      ),
    );
  }

  return findings;
}

function buildChecks(input: ParsedReviewBoardInput, findings: ReviewFinding[]): ReviewBoardCheck[] {
  return input.requiredGates.map((gateId) => {
    const gateFindings = findings.filter((finding) => finding.gateIds.includes(gateId));
    const evidence = input.evidence.find((item) => item.gateId === gateId);
    const status = statusFromFindings(gateFindings);
    const evidenceSummary =
      gateFindings.length > 0
        ? gateFindings.map((finding) => finding.title).join('; ')
        : evidence?.summary ?? 'No blocking review findings.';

    return ReviewBoardCheckSchema.parse({
      gateId,
      status,
      evidence: evidenceSummary,
    });
  });
}

function reviewersForGates(gates: ValidationGate[]): ReviewBoardReviewer[] {
  return DEFAULT_REVIEWERS.filter((reviewer) => reviewer.gateIds.some((gateId) => gates.includes(gateId)));
}

export function createReviewBoardInputFromCompiledSpec(
  compiled: CompiledWorkbenchSpec,
  input: Pick<ReviewBoardInput, 'boardId' | 'artifacts'> & Partial<Pick<ReviewBoardInput, 'evidence'>>,
): ReviewBoardInput {
  const parsed = CompiledWorkbenchSpecSchema.parse(compiled);
  const requiredGates = unique([
    ...parsed.metadata.validationGates.filter((gate) => gate !== 'schema'),
    'schema' as ValidationGate,
  ]);

  return ReviewBoardInputSchema.parse({
    boardId: input.boardId,
    title: parsed.spec.title,
    requiredGates,
    reviewers: reviewersForGates(requiredGates),
    artifacts: input.artifacts,
    evidence: input.evidence ?? [],
  });
}

export function runReviewBoard(input: ReviewBoardInput): ReviewBoardResult {
  const parsed = ReviewBoardInputSchema.parse(input);
  const securityFindings = findSecurityIssues(parsed);
  const findings = [...securityFindings, ...findFactIssues(parsed, securityFindings.length)];
  findings.push(...findValidationEvidenceIssues(parsed, findings.length));
  const checks = buildChecks(parsed, findings).sort((left, right) => {
    const rankDiff = statusRank(right.status) - statusRank(left.status);
    return rankDiff === 0 ? left.gateId.localeCompare(right.gateId) : rankDiff;
  });

  return ReviewBoardResultSchema.parse({
    boardId: parsed.boardId,
    title: parsed.title,
    verdict: statusFromChecks(checks),
    checks,
    findings,
    reviewerCount: parsed.reviewers.length,
    artifactCount: parsed.artifacts.length,
  });
}
