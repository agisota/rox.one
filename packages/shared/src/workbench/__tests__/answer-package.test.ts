import { describe, expect, it } from 'bun:test';

import {
  AgentAnswerPackageSchema,
  createAgentAnswerPackage,
  summarizeAgentAnswerPackage,
  type AgentAnswerPackage,
} from '../answer-package';

const CREATED_AT = '2026-05-20T12:00:00.000Z';

describe('AgentAnswerPackage contract', () => {
  it('parses a complete structured answer package', () => {
    const parsed = AgentAnswerPackageSchema.parse(createPackage());

    expect(parsed.message.userVisible).toBe(true);
    expect(parsed.memory.noteDraft?.title).toBe('Event kernel note');
    expect(parsed.memory.reusableBlocks).toHaveLength(2);
    expect(parsed.execution.taskDrafts[0]?.acceptanceCriteria).toContain('Schema parses structured refs');
    expect(parsed.retrieval.usedContext[0]?.kind).toBe('session');
    expect(parsed.audit.sessionId).toBe('session-1');
  });

  it('rejects invalid confidence values and empty required ids', () => {
    expect(() =>
      AgentAnswerPackageSchema.parse({
        ...createPackage(),
        memory: { ...createPackage().memory, confidence: 101 },
      }),
    ).toThrow();

    expect(() =>
      AgentAnswerPackageSchema.parse({
        ...createPackage(),
        audit: { ...createPackage().audit, promptId: '' },
      }),
    ).toThrow();
  });

  it('creates a parsed package without mutating caller input', () => {
    const input = createPackage();
    const before = JSON.stringify(input);

    const created = createAgentAnswerPackage(input);

    expect(created).not.toBe(input);
    expect(JSON.stringify(input)).toBe(before);
    expect(created.memory.claims[0]?.text).toBe('Every answer can carry reusable memory.');
  });

  it('summarizes counts and metadata without leaking full answer content', () => {
    const pkg = createAgentAnswerPackage(createPackage());
    const summary = summarizeAgentAnswerPackage(pkg);
    const serializedSummary = JSON.stringify(summary);

    expect(summary).toMatchObject({
      sessionId: 'session-1',
      promptId: 'prompt-1',
      answerId: 'answer-1',
      model: 'gpt-5.5',
      userVisible: true,
      noteDraftPresent: true,
      reusableBlockCount: 2,
      entityCount: 1,
      claimCount: 1,
      decisionCount: 1,
      taskDraftCount: 1,
      reminderCount: 1,
      followUpCount: 1,
      suggestedAgentRunCount: 1,
      usedContextCount: 1,
      excludedContextCount: 1,
      retrievalTraceCount: 1,
      toolUseCount: 1,
      sourceRefCount: 1,
      confidence: 87,
    });
    expect(summary.messageMarkdownLength).toBe(pkg.message.markdown.length);
    expect(serializedSummary).not.toContain('Full markdown answer');
    expect(serializedSummary).not.toContain('Every answer can carry reusable memory.');
  });
});

function createPackage(): AgentAnswerPackage {
  return {
    message: {
      markdown: 'Full markdown answer with implementation detail.',
      userVisible: true,
    },
    memory: {
      noteDraft: {
        title: 'Event kernel note',
        kind: 'agent_answer',
        markdown: 'Curated note draft.',
        tags: ['event-kernel'],
        entityRefs: [{ id: 'entity:event-kernel', kind: 'entity', label: 'Event Kernel' }],
        sourceRefs: [{ id: 'source:deepwiki:04', kind: 'deepwiki_page', title: 'Core Architecture' }],
      },
      reusableBlocks: [
        { id: 'block-1', kind: 'summary', markdown: 'Trust precedes memory.', sourceRefs: [] },
        { id: 'block-2', kind: 'decision', markdown: 'AnswerPackage starts as shared schema.', sourceRefs: [] },
      ],
      summary: 'Structured package summary.',
      entities: [{ id: 'entity:event-kernel', name: 'Event Kernel', kind: 'architecture', confidence: 92, sourceRefs: [] }],
      claims: [{
        id: 'claim-1',
        text: 'Every answer can carry reusable memory.',
        confidence: 86,
        evidenceRefs: [{ id: 'source:plan', kind: 'document', title: 'V4 plan' }],
      }],
      decisions: [{
        id: 'decision-1',
        title: 'Start with a schema-only slice',
        rationale: 'Avoid dirty protocol/session artifact files.',
        confidence: 90,
        rejectedOptions: [],
        sourceRefs: [],
      }],
      confidence: 87,
    },
    execution: {
      taskDrafts: [{
        id: 'task-1',
        title: 'Add AnswerPackage schema',
        description: 'Create pure shared schema and helpers.',
        goal: 'Represent structured answers without persistence migration.',
        contextRefs: [{ id: 'context:session-1', kind: 'session', label: 'Current session' }],
        linkedNotes: ['note:event-kernel'],
        linkedFiles: ['packages/shared/src/workbench/answer-package.ts'],
        linkedSessions: [],
        acceptanceCriteria: ['Schema parses structured refs', 'Summary does not leak full markdown'],
        verificationSteps: ['bun test packages/shared/src/workbench/__tests__/answer-package.test.ts'],
        expectedArtifact: 'shared schema',
        riskLevel: 'low',
        priority: 'high',
        dependencies: [],
        labels: ['v4', 'schema'],
      }],
      reminders: [{ id: 'reminder-1', title: 'Review schema with provider gateway', dueAt: CREATED_AT, contextRefs: [] }],
      followUps: [{ id: 'follow-up-1', prompt: 'Map provider artifacts into AnswerPackage.', contextRefs: [] }],
      suggestedAgentRuns: [{ id: 'run-1', taskId: 'task-1', agentRole: 'test-agent', skillSlugs: ['tdd'], validationSteps: [] }],
    },
    retrieval: {
      usedContext: [{ id: 'context:session-1', kind: 'session', label: 'Current session' }],
      excludedContext: [{
        contextRef: { id: 'context:voice-always-on', kind: 'policy', label: 'Always-on voice' },
        reason: 'Out of MVP before trust kernel.',
      }],
      retrievalTrace: [{
        id: 'trace-1',
        query: 'answer package current repo anchors',
        selectedContextRefs: [{ id: 'context:session-1', kind: 'session', label: 'Current session' }],
        rejectedContextRefs: [{ id: 'context:voice-always-on', kind: 'policy', label: 'Always-on voice' }],
        scorer: 'manual',
        createdAt: CREATED_AT,
      }],
    },
    audit: {
      sessionId: 'session-1',
      promptId: 'prompt-1',
      answerId: 'answer-1',
      model: 'gpt-5.5',
      toolsUsed: [{ id: 'tool-1', name: 'graphify', status: 'success', outputSummary: 'Found SessionManager links.', sourceRefs: [] }],
      sourceRefs: [{ id: 'source:deepwiki:04', kind: 'deepwiki_page', title: 'Core Architecture' }],
      createdAt: CREATED_AT,
    },
  };
}
