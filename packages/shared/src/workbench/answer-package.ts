import { z } from 'zod/v4';

const IdSchema = z.string().trim().min(1);
const OptionalIdSchema = IdSchema.optional();
const NonEmptyStringSchema = z.string().trim().min(1);
const IsoDateStringSchema = NonEmptyStringSchema;
const ConfidencePercentSchema = z.number().min(0).max(100);

export const ObjectKindSchema = z.enum([
  'workspace',
  'space',
  'session',
  'chat',
  'prompt',
  'answer',
  'note',
  'block',
  'file',
  'task',
  'agent_run',
  'skill',
  'artifact',
  'transcript',
  'feed_item',
  'reminder',
  'calendar_event',
  'entity',
  'edge',
  'policy',
  'notification',
]);
export type ObjectKind = z.infer<typeof ObjectKindSchema>;

export const SourceRefKindSchema = z.enum([
  'artifact',
  'commit',
  'deepwiki_page',
  'document',
  'file',
  'graphify',
  'test',
  'ticket',
  'url',
  'worklog',
  'unknown',
]);
export type SourceRefKind = z.infer<typeof SourceRefKindSchema>;

export const RiskLevelSchema = z.enum(['low', 'medium', 'high', 'critical']);
export type AnswerPackageRiskLevel = z.infer<typeof RiskLevelSchema>;

export const PrioritySchema = z.enum(['low', 'medium', 'high', 'urgent']);
export type AnswerPackagePriority = z.infer<typeof PrioritySchema>;

export const ContextRefSchema = z.object({
  id: IdSchema,
  kind: ObjectKindSchema,
  label: NonEmptyStringSchema.optional(),
  workspaceId: IdSchema.optional(),
  sessionId: IdSchema.optional(),
  objectId: IdSchema.optional(),
  source: NonEmptyStringSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type ContextRef = z.infer<typeof ContextRefSchema>;

export const SourceRefSchema = z.object({
  id: IdSchema,
  kind: SourceRefKindSchema,
  title: NonEmptyStringSchema.optional(),
  path: NonEmptyStringSchema.optional(),
  url: NonEmptyStringSchema.optional(),
  line: z.number().int().positive().optional(),
  hash: NonEmptyStringSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type SourceRef = z.infer<typeof SourceRefSchema>;

export const EntityMentionSchema = z.object({
  id: OptionalIdSchema,
  name: NonEmptyStringSchema,
  kind: NonEmptyStringSchema.optional(),
  confidence: ConfidencePercentSchema.optional(),
  sourceRefs: z.array(SourceRefSchema).default([]),
});
export type EntityMention = z.infer<typeof EntityMentionSchema>;

export const BlockDraftSchema = z.object({
  id: OptionalIdSchema,
  kind: NonEmptyStringSchema.optional(),
  markdown: NonEmptyStringSchema,
  sourceRefs: z.array(SourceRefSchema).default([]),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type BlockDraft = z.infer<typeof BlockDraftSchema>;

export const NoteDraftKindSchema = z.enum([
  'manual',
  'agent_answer',
  'meeting',
  'transcript_summary',
  'feed_digest',
  'research',
  'decision',
  'skill',
  'project',
]);
export type NoteDraftKind = z.infer<typeof NoteDraftKindSchema>;

export const NoteDraftSchema = z.object({
  id: OptionalIdSchema,
  title: NonEmptyStringSchema,
  kind: NoteDraftKindSchema,
  markdown: NonEmptyStringSchema,
  tags: z.array(NonEmptyStringSchema).default([]),
  entityRefs: z.array(ContextRefSchema).default([]),
  sourceRefs: z.array(SourceRefSchema).default([]),
  confidence: ConfidencePercentSchema.optional(),
  visibility: NonEmptyStringSchema.optional(),
  retentionPolicyId: IdSchema.optional(),
});
export type NoteDraft = z.infer<typeof NoteDraftSchema>;

export const ClaimDraftSchema = z.object({
  id: OptionalIdSchema,
  text: NonEmptyStringSchema,
  confidence: ConfidencePercentSchema,
  evidenceRefs: z.array(SourceRefSchema).default([]),
});
export type ClaimDraft = z.infer<typeof ClaimDraftSchema>;

export const DecisionDraftSchema = z.object({
  id: OptionalIdSchema,
  title: NonEmptyStringSchema,
  rationale: NonEmptyStringSchema.optional(),
  chosenOption: NonEmptyStringSchema.optional(),
  rejectedOptions: z.array(NonEmptyStringSchema).default([]),
  confidence: ConfidencePercentSchema.optional(),
  sourceRefs: z.array(SourceRefSchema).default([]),
});
export type DecisionDraft = z.infer<typeof DecisionDraftSchema>;

export const TaskDraftSchema = z.object({
  id: OptionalIdSchema,
  title: NonEmptyStringSchema,
  description: NonEmptyStringSchema.optional(),
  goal: NonEmptyStringSchema,
  contextRefs: z.array(ContextRefSchema).default([]),
  linkedNotes: z.array(IdSchema).default([]),
  linkedFiles: z.array(NonEmptyStringSchema).default([]),
  linkedSessions: z.array(IdSchema).default([]),
  agent: NonEmptyStringSchema.optional(),
  skill: NonEmptyStringSchema.optional(),
  acceptanceCriteria: z.array(NonEmptyStringSchema).min(1),
  verificationSteps: z.array(NonEmptyStringSchema).min(1),
  expectedArtifact: NonEmptyStringSchema.optional(),
  riskLevel: RiskLevelSchema,
  priority: PrioritySchema,
  dependencies: z.array(IdSchema).default([]),
  dueDate: IsoDateStringSchema.optional(),
  labels: z.array(NonEmptyStringSchema).default([]),
});
export type TaskDraft = z.infer<typeof TaskDraftSchema>;

export const ReminderDraftSchema = z.object({
  id: OptionalIdSchema,
  title: NonEmptyStringSchema,
  dueAt: IsoDateStringSchema.optional(),
  contextRefs: z.array(ContextRefSchema).default([]),
});
export type ReminderDraft = z.infer<typeof ReminderDraftSchema>;

export const FollowUpDraftSchema = z.object({
  id: OptionalIdSchema,
  prompt: NonEmptyStringSchema,
  contextRefs: z.array(ContextRefSchema).default([]),
});
export type FollowUpDraft = z.infer<typeof FollowUpDraftSchema>;

export const AgentRunDraftSchema = z.object({
  id: OptionalIdSchema,
  taskId: IdSchema.optional(),
  agentRole: NonEmptyStringSchema,
  skillSlugs: z.array(NonEmptyStringSchema).default([]),
  prompt: NonEmptyStringSchema.optional(),
  permissionMode: z.enum(['safe', 'ask', 'allow-all']).optional(),
  validationSteps: z.array(NonEmptyStringSchema).default([]),
});
export type AgentRunDraft = z.infer<typeof AgentRunDraftSchema>;

export const ContextExclusionSchema = z.object({
  contextRef: ContextRefSchema,
  reason: NonEmptyStringSchema,
});
export type ContextExclusion = z.infer<typeof ContextExclusionSchema>;

export const RetrievalTraceSchema = z.object({
  id: IdSchema,
  query: NonEmptyStringSchema,
  selectedContextRefs: z.array(ContextRefSchema).default([]),
  rejectedContextRefs: z.array(ContextRefSchema).default([]),
  scorer: NonEmptyStringSchema.optional(),
  createdAt: IsoDateStringSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type RetrievalTrace = z.infer<typeof RetrievalTraceSchema>;

export const ToolUseSchema = z.object({
  id: OptionalIdSchema,
  name: NonEmptyStringSchema,
  status: z.enum(['success', 'failure', 'skipped', 'running']).optional(),
  inputSummary: NonEmptyStringSchema.optional(),
  outputSummary: NonEmptyStringSchema.optional(),
  sourceRefs: z.array(SourceRefSchema).default([]),
});
export type ToolUse = z.infer<typeof ToolUseSchema>;

export const AgentAnswerPackageSchema = z.object({
  message: z.object({
    markdown: NonEmptyStringSchema,
    userVisible: z.boolean().default(true),
  }),
  memory: z.object({
    noteDraft: NoteDraftSchema.optional(),
    reusableBlocks: z.array(BlockDraftSchema).default([]),
    summary: NonEmptyStringSchema,
    entities: z.array(EntityMentionSchema).default([]),
    claims: z.array(ClaimDraftSchema).default([]),
    decisions: z.array(DecisionDraftSchema).default([]),
    confidence: ConfidencePercentSchema,
  }),
  execution: z.object({
    taskDrafts: z.array(TaskDraftSchema).default([]),
    reminders: z.array(ReminderDraftSchema).default([]),
    followUps: z.array(FollowUpDraftSchema).default([]),
    suggestedAgentRuns: z.array(AgentRunDraftSchema).default([]),
  }),
  retrieval: z.object({
    usedContext: z.array(ContextRefSchema).default([]),
    excludedContext: z.array(ContextExclusionSchema).default([]),
    retrievalTrace: z.array(RetrievalTraceSchema).default([]),
  }),
  audit: z.object({
    sessionId: IdSchema,
    promptId: IdSchema,
    answerId: IdSchema.optional(),
    model: NonEmptyStringSchema,
    toolsUsed: z.array(ToolUseSchema).default([]),
    sourceRefs: z.array(SourceRefSchema).default([]),
    createdAt: IsoDateStringSchema,
  }),
});
export type AgentAnswerPackage = z.infer<typeof AgentAnswerPackageSchema>;

export interface AgentAnswerPackageSummary {
  sessionId: string;
  promptId: string;
  answerId?: string;
  model: string;
  createdAt: string;
  userVisible: boolean;
  messageMarkdownLength: number;
  memorySummaryLength: number;
  noteDraftPresent: boolean;
  reusableBlockCount: number;
  entityCount: number;
  claimCount: number;
  decisionCount: number;
  taskDraftCount: number;
  reminderCount: number;
  followUpCount: number;
  suggestedAgentRunCount: number;
  usedContextCount: number;
  excludedContextCount: number;
  retrievalTraceCount: number;
  toolUseCount: number;
  sourceRefCount: number;
  confidence: number;
}

export function createAgentAnswerPackage(input: unknown): AgentAnswerPackage {
  return AgentAnswerPackageSchema.parse(input);
}

export function summarizeAgentAnswerPackage(input: AgentAnswerPackage): AgentAnswerPackageSummary {
  const parsed = AgentAnswerPackageSchema.parse(input);
  return {
    sessionId: parsed.audit.sessionId,
    promptId: parsed.audit.promptId,
    ...(parsed.audit.answerId ? { answerId: parsed.audit.answerId } : {}),
    model: parsed.audit.model,
    createdAt: parsed.audit.createdAt,
    userVisible: parsed.message.userVisible,
    messageMarkdownLength: parsed.message.markdown.length,
    memorySummaryLength: parsed.memory.summary.length,
    noteDraftPresent: Boolean(parsed.memory.noteDraft),
    reusableBlockCount: parsed.memory.reusableBlocks.length,
    entityCount: parsed.memory.entities.length,
    claimCount: parsed.memory.claims.length,
    decisionCount: parsed.memory.decisions.length,
    taskDraftCount: parsed.execution.taskDrafts.length,
    reminderCount: parsed.execution.reminders.length,
    followUpCount: parsed.execution.followUps.length,
    suggestedAgentRunCount: parsed.execution.suggestedAgentRuns.length,
    usedContextCount: parsed.retrieval.usedContext.length,
    excludedContextCount: parsed.retrieval.excludedContext.length,
    retrievalTraceCount: parsed.retrieval.retrievalTrace.length,
    toolUseCount: parsed.audit.toolsUsed.length,
    sourceRefCount: parsed.audit.sourceRefs.length,
    confidence: parsed.memory.confidence,
  };
}
