import { z } from 'zod';
import {
  ValidationGateSchema,
  type ValidationGate,
} from './product-mode-registry';
import {
  CompiledWorkbenchSpecSchema,
  type CompiledWorkbenchSpec,
} from './spec-compiler';

export const ValidationGateCategorySchema = z.enum([
  'structure',
  'test',
  'review',
  'security',
  'storage',
  'sync',
] as const);
export type ValidationGateCategory = z.infer<typeof ValidationGateCategorySchema>;

export const ValidationGateSeveritySchema = z.enum(['low', 'medium', 'high', 'critical'] as const);
export type ValidationGateSeverity = z.infer<typeof ValidationGateSeveritySchema>;

export const ValidationGateStatusSchema = z.enum(['pass', 'warn', 'fail'] as const);
export type ValidationGateStatus = z.infer<typeof ValidationGateStatusSchema>;

export const ValidationGateVerdictSchema = z.enum(['pass', 'warn', 'fail'] as const);
export type ValidationGateVerdict = z.infer<typeof ValidationGateVerdictSchema>;

export const ValidationGateDefinitionSchema = z.object({
  gateId: ValidationGateSchema,
  label: z.string().trim().min(1),
  description: z.string().trim().min(1),
  category: ValidationGateCategorySchema,
  requiresEvidence: z.boolean(),
  blocking: z.boolean(),
  severity: ValidationGateSeveritySchema,
});
export type ValidationGateDefinition = z.infer<typeof ValidationGateDefinitionSchema>;

export const ValidationGateEvidenceSchema = z.object({
  gateId: ValidationGateSchema,
  command: z.string().trim().min(1).optional(),
  summary: z.string().trim().min(1),
  artifactRefs: z.array(z.string().trim().min(1)).default([]),
  passed: z.boolean().default(true),
});
export type ValidationGateEvidence = z.input<typeof ValidationGateEvidenceSchema>;
type ParsedValidationGateEvidence = z.output<typeof ValidationGateEvidenceSchema>;

export const ValidationGateCheckSchema = z.object({
  gateId: ValidationGateSchema,
  label: z.string().trim().min(1),
  category: ValidationGateCategorySchema,
  status: ValidationGateStatusSchema,
  severity: ValidationGateSeveritySchema,
  blocking: z.boolean(),
  missingEvidence: z.boolean(),
  evidence: z.string().trim().min(1),
});
export type ValidationGateCheck = z.infer<typeof ValidationGateCheckSchema>;

export const ValidationGateRunInputSchema = z.object({
  runId: z.string().trim().min(1),
  requiredGates: z.array(ValidationGateSchema).min(1),
  evidence: z.array(ValidationGateEvidenceSchema).default([]),
});
export type ValidationGateRunInput = z.input<typeof ValidationGateRunInputSchema>;
type ParsedValidationGateRunInput = z.output<typeof ValidationGateRunInputSchema>;

export const ValidationGateRunResultSchema = z.object({
  runId: z.string().trim().min(1),
  verdict: ValidationGateVerdictSchema,
  requiredGates: z.array(ValidationGateSchema).min(1),
  checks: z.array(ValidationGateCheckSchema).min(1),
});
export type ValidationGateRunResult = z.infer<typeof ValidationGateRunResultSchema>;

const VALIDATION_GATE_DEFINITIONS: Record<ValidationGate, Omit<ValidationGateDefinition, 'gateId'>> = {
  schema: {
    label: 'Schema',
    description: 'Structured artifact validates against the expected workbench schema.',
    category: 'structure',
    requiresEvidence: false,
    blocking: true,
    severity: 'high',
  },
  unit_tests: {
    label: 'Unit tests',
    description: 'Pure logic has targeted unit test evidence.',
    category: 'test',
    requiresEvidence: true,
    blocking: true,
    severity: 'high',
  },
  integration_tests: {
    label: 'Integration tests',
    description: 'Adapters, stores, and service boundaries have fake-provider integration evidence.',
    category: 'test',
    requiresEvidence: true,
    blocking: true,
    severity: 'high',
  },
  ui_tests: {
    label: 'UI tests',
    description: 'Visible UI state and interactions have component or smoke evidence.',
    category: 'test',
    requiresEvidence: true,
    blocking: true,
    severity: 'high',
  },
  e2e_tests: {
    label: 'E2E tests',
    description: 'User-visible flows have end-to-end or smoke evidence.',
    category: 'test',
    requiresEvidence: true,
    blocking: true,
    severity: 'high',
  },
  fact_check: {
    label: 'Fact check',
    description: 'External or comparative claims are source-backed or explicitly marked as assumptions.',
    category: 'review',
    requiresEvidence: false,
    blocking: false,
    severity: 'medium',
  },
  logic_check: {
    label: 'Logic check',
    description: 'The artifact is internally consistent and does not contain contradictory requirements.',
    category: 'review',
    requiresEvidence: false,
    blocking: true,
    severity: 'medium',
  },
  brand_check: {
    label: 'Brand check',
    description: 'Brand, tone, and naming match the configured product surface.',
    category: 'review',
    requiresEvidence: false,
    blocking: false,
    severity: 'medium',
  },
  security_check: {
    label: 'Security check',
    description: 'Security-sensitive behavior is reviewed for secret handling and unsafe access.',
    category: 'security',
    requiresEvidence: false,
    blocking: true,
    severity: 'high',
  },
  rbac_check: {
    label: 'RBAC check',
    description: 'Role and tenant boundaries have deny-by-default evidence.',
    category: 'security',
    requiresEvidence: true,
    blocking: true,
    severity: 'high',
  },
  quota_check: {
    label: 'Quota check',
    description: 'Quota enforcement is proven before protected writes complete.',
    category: 'storage',
    requiresEvidence: true,
    blocking: true,
    severity: 'high',
  },
  sync_check: {
    label: 'Sync check',
    description: 'Sync operations prove conflict detection and no silent overwrite.',
    category: 'sync',
    requiresEvidence: true,
    blocking: true,
    severity: 'high',
  },
};

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function verdictFromChecks(checks: ValidationGateCheck[]): ValidationGateVerdict {
  if (checks.some((check) => check.status === 'fail')) {
    return 'fail';
  }
  if (checks.some((check) => check.status === 'warn')) {
    return 'warn';
  }
  return 'pass';
}

function definitionForGate(gateId: ValidationGate): ValidationGateDefinition {
  return ValidationGateDefinitionSchema.parse({
    gateId,
    ...VALIDATION_GATE_DEFINITIONS[gateId],
  });
}

function evidenceForGate(
  input: ParsedValidationGateRunInput,
  gateId: ValidationGate,
): ParsedValidationGateEvidence[] {
  return input.evidence.filter((item) => item.gateId === gateId);
}

function checkForGate(input: ParsedValidationGateRunInput, gateId: ValidationGate): ValidationGateCheck {
  const definition = definitionForGate(gateId);
  const evidence = evidenceForGate(input, gateId);
  const hasEvidence = evidence.length > 0;
  const failedEvidence = evidence.find((item) => !item.passed);
  const missingEvidence = definition.requiresEvidence && !hasEvidence;
  const status: ValidationGateStatus = missingEvidence || failedEvidence ? 'fail' : 'pass';
  const suppliedEvidenceSummary = failedEvidence?.summary ?? evidence.map((item) => item.summary).join('; ');
  const evidenceSummary = missingEvidence
    ? `Missing evidence for required gate ${gateId}.`
    : suppliedEvidenceSummary || 'Gate does not require runtime evidence.';

  return ValidationGateCheckSchema.parse({
    gateId,
    label: definition.label,
    category: definition.category,
    status,
    severity: definition.severity,
    blocking: definition.blocking,
    missingEvidence,
    evidence: evidenceSummary,
  });
}

export function getValidationGateCatalog(): ValidationGateDefinition[] {
  return ValidationGateSchema.options.map(definitionForGate);
}

export function getValidationGateDefinition(gateId: ValidationGate): ValidationGateDefinition {
  return definitionForGate(gateId);
}

export function runValidationGates(input: ValidationGateRunInput): ValidationGateRunResult {
  const parsed = ValidationGateRunInputSchema.parse(input);
  const requiredGates = unique(parsed.requiredGates);
  const checks = requiredGates.map((gateId) => checkForGate(parsed, gateId));

  return ValidationGateRunResultSchema.parse({
    runId: parsed.runId,
    verdict: verdictFromChecks(checks),
    requiredGates,
    checks,
  });
}

export function createValidationGateRunFromCompiledSpec(
  compiled: CompiledWorkbenchSpec,
  input: Pick<ValidationGateRunInput, 'runId'> & Partial<Pick<ValidationGateRunInput, 'evidence'>>,
): ValidationGateRunResult {
  const parsed = CompiledWorkbenchSpecSchema.parse(compiled);
  const requiredGates = unique([
    'schema' as ValidationGate,
    ...parsed.metadata.validationGates.filter((gate) => gate !== 'schema'),
  ]);

  return runValidationGates({
    runId: input.runId,
    requiredGates,
    evidence: input.evidence ?? [],
  });
}
