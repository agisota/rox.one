import { z } from 'zod';
import { ProductModeSchema, ValidationGateSchema, type ProductMode, type ValidationGate } from './product-mode-registry';

export const TddTaskPhaseSchema = z.enum(['red', 'green', 'verify', 'worklog'] as const);
export type TddTaskPhase = z.infer<typeof TddTaskPhaseSchema>;

export const TddGeneratedTaskSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1),
  phase: TddTaskPhaseSchema,
  status: z.literal('planned'),
  description: z.string().trim().min(1),
  acceptanceCriteria: z.array(z.string().trim().min(1)).min(1),
  checkCommands: z.array(z.string().trim().min(1)).default([]),
  dependsOn: z.array(z.string().trim().min(1)).default([]),
  mustRunBefore: z.array(z.string().trim().min(1)).default([]),
});
export type TddGeneratedTask = z.infer<typeof TddGeneratedTaskSchema>;

export const TddTaskPackSchema = z.object({
  packId: z.string().trim().min(1),
  ticketId: z.string().trim().min(1),
  title: z.string().trim().min(1),
  modeId: ProductModeSchema,
  createdAt: z.string().datetime(),
  rawInput: z.string().trim().min(1),
  validationGates: z.array(ValidationGateSchema).min(1),
  touchedSurfaces: z.array(z.string().trim().min(1)).default([]),
  fakeProviderRequirements: z.array(z.string().trim().min(1)).default([]),
  tasks: z.array(TddGeneratedTaskSchema).min(4),
});
export type TddTaskPack = z.infer<typeof TddTaskPackSchema>;

export const GenerateTddTaskPackInputSchema = z.object({
  ticketId: z.string().trim().min(1),
  title: z.string().trim().min(1),
  rawInput: z.string().trim().min(1),
  modeId: ProductModeSchema,
  validationGates: z.array(ValidationGateSchema).min(1),
  touchedSurfaces: z.array(z.string().trim().min(1)).default([]),
  createdAt: z.string().datetime().optional(),
});
export interface GenerateTddTaskPackInput extends z.input<typeof GenerateTddTaskPackInputSchema> {}

const GATE_COMMANDS: Partial<Record<ValidationGate, string>> = {
  unit_tests: 'bun test <unit-test-file>',
  integration_tests: 'bun test <integration-test-file>',
  ui_tests: 'bun test <ui-or-component-test-file>',
  e2e_tests: 'bun test <e2e-or-smoke-test-file>',
  security_check: 'bun test <security-test-file>',
  rbac_check: 'bun test <rbac-role-matrix-test-file>',
  quota_check: 'bun test <quota-test-file>',
  sync_check: 'bun test <sync-conflict-test-file>',
  fact_check: 'bun test <fact-check-fixture-test-file>',
  logic_check: 'bun test <logic-contract-test-file>',
};

const FAKE_PROVIDER_REQUIREMENTS = [
  {
    patterns: ['external:browser', 'browser', 'research', 'web'],
    requirement: 'Use fake browser/research providers; no real browser, search, or network calls in tests.',
  },
  {
    patterns: ['auth', 'session'],
    requirement: 'Use fake auth/session providers; no production auth or credential mutation in tests.',
  },
  {
    patterns: ['team', 'rbac', 'invite'],
    requirement: 'Use fake team/RBAC stores; no real invites or external identity calls in tests.',
  },
  {
    patterns: ['storage', 's3', 'quota'],
    requirement: 'Use fake S3/storage adapters; no real object-store calls in tests.',
  },
  {
    patterns: ['sync', 'cloud'],
    requirement: 'Use fake sync remotes; no real cloud workspace writes in tests.',
  },
] as const;

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function slugTimestamp(isoDate: string): string {
  return isoDate.replace(/[:.]/gu, '-');
}

function commandsForGates(validationGates: ValidationGate[]): string[] {
  const commands = validationGates.flatMap((gate) => {
    const command = GATE_COMMANDS[gate];
    return command ? [command] : [];
  });

  return unique(commands.length > 0 ? commands : ['bun test <unit-test-file>']);
}

function fakeProviderRequirementsForSurfaces(touchedSurfaces: string[]): string[] {
  const normalized = touchedSurfaces.map((surface) => surface.toLowerCase());
  const requirements = FAKE_PROVIDER_REQUIREMENTS.flatMap(({ patterns, requirement }) =>
    patterns.some((pattern) => normalized.some((surface) => surface.includes(pattern))) ? [requirement] : [],
  );

  return unique(requirements);
}

function makeTask(input: Omit<TddGeneratedTask, 'status'>): TddGeneratedTask {
  return TddGeneratedTaskSchema.parse({
    ...input,
    status: 'planned',
  });
}

export function generateTddTaskPack(input: GenerateTddTaskPackInput): TddTaskPack {
  const parsed = GenerateTddTaskPackInputSchema.parse(input);
  const createdAt = parsed.createdAt ?? new Date().toISOString();
  const commands = commandsForGates(parsed.validationGates);
  const redId = `${parsed.ticketId}-RED`;
  const greenId = `${parsed.ticketId}-GREEN`;
  const verifyId = `${parsed.ticketId}-VERIFY`;
  const worklogId = `${parsed.ticketId}-WORKLOG`;

  return TddTaskPackSchema.parse({
    packId: `tdd-pack-${parsed.ticketId}-${slugTimestamp(createdAt)}`,
    ticketId: parsed.ticketId,
    title: parsed.title,
    modeId: parsed.modeId as ProductMode,
    createdAt,
    rawInput: parsed.rawInput,
    validationGates: unique(parsed.validationGates),
    touchedSurfaces: unique(parsed.touchedSurfaces),
    fakeProviderRequirements: fakeProviderRequirementsForSurfaces(parsed.touchedSurfaces),
    tasks: [
      makeTask({
        id: redId,
        title: 'Write failing tests first',
        phase: 'red',
        description: 'Add the narrowest tests or validation checks that prove the missing behavior before production code changes.',
        acceptanceCriteria: [
          'Targeted tests fail for the expected missing implementation reason.',
          'Tests use fake providers or adapters for external systems.',
        ],
        checkCommands: commands,
        dependsOn: [],
        mustRunBefore: [greenId],
      }),
      makeTask({
        id: greenId,
        title: 'Implement the minimum passing change',
        phase: 'green',
        description: 'Implement only the production code needed to make the red tests pass.',
        acceptanceCriteria: [
          'Previously failing targeted tests now pass.',
          'No unrelated behavior or runtime state is changed.',
        ],
        checkCommands: commands,
        dependsOn: [redId],
        mustRunBefore: [verifyId],
      }),
      makeTask({
        id: verifyId,
        title: 'Run validation gates',
        phase: 'verify',
        description: 'Run targeted and relevant broad validation, then record evidence.',
        acceptanceCriteria: [
          'All required validation gates pass or blockers are documented precisely.',
          'Typecheck/build are run when source/runtime behavior changes.',
        ],
        checkCommands: commands,
        dependsOn: [greenId],
        mustRunBefore: [worklogId],
      }),
      makeTask({
        id: worklogId,
        title: 'Update worklog and acceptance matrix',
        phase: 'worklog',
        description: 'Record discovery, red output, implementation, validation evidence, risks, and acceptance status.',
        acceptanceCriteria: [
          `docs/worklog/${parsed.ticketId}.md or the matching task worklog is complete.`,
          'Commit uses the Lore commit protocol after validation passes.',
        ],
        checkCommands: [],
        dependsOn: [verifyId],
        mustRunBefore: [],
      }),
    ],
  });
}

function renderTask(task: TddGeneratedTask): string {
  const lines = [
    `## ${task.id} - ${task.title}`,
    `Status: ${task.status}`,
    `Phase: ${task.phase}`,
    '',
    task.description,
    '',
    'Acceptance criteria:',
    ...task.acceptanceCriteria.map((criterion) => `- [ ] ${criterion}`),
  ];

  if (task.checkCommands.length > 0) {
    lines.push('', 'Checks:', ...task.checkCommands.map((command) => `- [ ] Run \`${command}\` and confirm ${task.phase === 'red' ? 'expected failure' : 'pass'}.`));
  }

  if (task.dependsOn.length > 0) {
    lines.push('', `Depends on: ${task.dependsOn.join(', ')}`);
  }

  if (task.mustRunBefore.length > 0) {
    lines.push(`Must run before: ${task.mustRunBefore.join(', ')}`);
  }

  return lines.join('\n');
}

export function renderTddTaskPackMarkdown(pack: TddTaskPack): string {
  const parsed = TddTaskPackSchema.parse(pack);
  const lines = [
    `# TDD Task Pack - ${parsed.ticketId} ${parsed.title}`,
    '',
    `Mode: ${parsed.modeId}`,
    `Created: ${parsed.createdAt}`,
    `Validation gates: ${parsed.validationGates.join(', ')}`,
    '',
  ];

  if (parsed.fakeProviderRequirements.length > 0) {
    lines.push('## Fake Provider Requirements', ...parsed.fakeProviderRequirements.map((requirement) => `- ${requirement}`), '');
  }

  lines.push(...parsed.tasks.map(renderTask));
  return `${lines.join('\n\n').trimEnd()}\n`;
}
