/**
 * Automation → Telegram topic routing tests
 *
 * Covers the flow from AutomationMatcher.telegramTopic through to PendingPrompt:
 *   - Matcher with telegramTopic → PendingPrompt carries the topic
 *   - Matcher without telegramTopic → PendingPrompt.telegramTopic is undefined
 *   - Whitespace-only telegramTopic → treated as absent (stripped to undefined)
 *   - Env-var expansion in telegramTopic (e.g. "Label: $ROX_LABEL")
 *   - Schema validation accepts telegramTopic within 1–128 chars
 *   - Schema validation rejects empty-string telegramTopic (min(1))
 *   - Schema validation rejects overlong telegramTopic (max(128))
 *   - Multiple matchers: each carries its own telegramTopic independently
 */

import { describe, it, expect, beforeEach, afterEach, jest } from 'bun:test';
import { WorkspaceEventBus } from './event-bus.ts';
import { PromptHandler } from './handlers/prompt-handler.ts';
import type { AutomationsConfigProvider, PromptHandlerOptions } from './handlers/types.ts';
import type { AutomationMatcher, AutomationEvent, PendingPrompt } from './types.ts';
import { AutomationMatcherSchema, AutomationsConfigSchema } from './schemas.ts';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function createMockConfigProvider(
  matchersByEvent: Partial<Record<AutomationEvent, AutomationMatcher[]>> = {},
): AutomationsConfigProvider {
  return {
    getConfig: () => ({ automations: matchersByEvent }),
    getMatchersForEvent: (event: AutomationEvent) => matchersByEvent[event] ?? [],
  };
}

function createOptions(overrides: Partial<PromptHandlerOptions> = {}): PromptHandlerOptions {
  return {
    workspaceId: 'test-workspace',
    workspaceRootPath: '/tmp/test-workspace',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// PromptHandler: telegramTopic propagation
// ---------------------------------------------------------------------------

describe('PromptHandler — telegramTopic propagation to PendingPrompt', () => {
  let bus: WorkspaceEventBus;

  beforeEach(() => {
    bus = new WorkspaceEventBus('test-workspace');
  });

  afterEach(() => {
    bus.dispose();
  });

  it('passes telegramTopic from matcher to PendingPrompt when set', async () => {
    const onPromptsReady = jest.fn();
    const configProvider = createMockConfigProvider({
      LabelAdd: [
        {
          matcher: 'bug',
          telegramTopic: 'Bug Reports',
          actions: [{ type: 'prompt', prompt: 'A bug label was added' }],
        },
      ],
    });

    const handler = new PromptHandler(createOptions({ onPromptsReady }), configProvider);
    handler.subscribe(bus);

    await bus.emit('LabelAdd', {
      workspaceId: 'test-workspace',
      timestamp: Date.now(),
      label: 'bug',
    });

    expect(onPromptsReady).toHaveBeenCalledTimes(1);
    const prompts: PendingPrompt[] = onPromptsReady.mock.calls[0]![0];
    expect(prompts).toHaveLength(1);
    expect(prompts[0]!.telegramTopic).toBe('Bug Reports');

    handler.dispose();
  });

  it('leaves telegramTopic undefined on PendingPrompt when matcher has no telegramTopic', async () => {
    const onPromptsReady = jest.fn();
    const configProvider = createMockConfigProvider({
      LabelAdd: [
        {
          matcher: 'feature',
          actions: [{ type: 'prompt', prompt: 'Feature label added' }],
        },
      ],
    });

    const handler = new PromptHandler(createOptions({ onPromptsReady }), configProvider);
    handler.subscribe(bus);

    await bus.emit('LabelAdd', {
      workspaceId: 'test-workspace',
      timestamp: Date.now(),
      label: 'feature',
    });

    expect(onPromptsReady).toHaveBeenCalledTimes(1);
    const prompts: PendingPrompt[] = onPromptsReady.mock.calls[0]![0];
    expect(prompts[0]!.telegramTopic).toBeUndefined();

    handler.dispose();
  });

  it('treats whitespace-only telegramTopic as absent (strips to undefined)', async () => {
    const onPromptsReady = jest.fn();
    const configProvider = createMockConfigProvider({
      LabelAdd: [
        {
          matcher: 'test',
          telegramTopic: '   ',
          actions: [{ type: 'prompt', prompt: 'Label added' }],
        },
      ],
    });

    const handler = new PromptHandler(createOptions({ onPromptsReady }), configProvider);
    handler.subscribe(bus);

    await bus.emit('LabelAdd', {
      workspaceId: 'test-workspace',
      timestamp: Date.now(),
      label: 'test',
    });

    expect(onPromptsReady).toHaveBeenCalledTimes(1);
    const prompts: PendingPrompt[] = onPromptsReady.mock.calls[0]![0];
    expect(prompts[0]!.telegramTopic).toBeUndefined();

    handler.dispose();
  });

  it('expands env vars in telegramTopic (e.g. "Label: $ROX_LABEL")', async () => {
    const onPromptsReady = jest.fn();
    const configProvider = createMockConfigProvider({
      LabelAdd: [
        {
          // No matcher → matches all (matcherMatches returns true when no matcher set)
          telegramTopic: 'Label: $ROX_LABEL',
          actions: [{ type: 'prompt', prompt: 'Processing $ROX_LABEL' }],
        },
      ],
    });

    const handler = new PromptHandler(createOptions({ onPromptsReady }), configProvider);
    handler.subscribe(bus);

    await bus.emit('LabelAdd', {
      workspaceId: 'test-workspace',
      timestamp: Date.now(),
      label: 'urgent',
    });

    expect(onPromptsReady).toHaveBeenCalledTimes(1);
    const prompts: PendingPrompt[] = onPromptsReady.mock.calls[0]![0];
    expect(prompts[0]!.telegramTopic).toBe('Label: urgent');

    handler.dispose();
  });

  it('propagates independent telegramTopics from two matchers to their respective PendingPrompts', async () => {
    const onPromptsReady = jest.fn();
    const configProvider = createMockConfigProvider({
      LabelAdd: [
        {
          // No matcher → matches everything
          telegramTopic: 'Bug Reports',
          actions: [{ type: 'prompt', prompt: 'First automation' }],
        },
        {
          telegramTopic: 'Daily Digest',
          actions: [{ type: 'prompt', prompt: 'Second automation' }],
        },
      ],
    });

    const handler = new PromptHandler(createOptions({ onPromptsReady }), configProvider);
    handler.subscribe(bus);

    await bus.emit('LabelAdd', {
      workspaceId: 'test-workspace',
      timestamp: Date.now(),
      label: 'any',
    });

    expect(onPromptsReady).toHaveBeenCalledTimes(1);
    const prompts: PendingPrompt[] = onPromptsReady.mock.calls[0]![0];
    expect(prompts).toHaveLength(2);

    const topics = prompts.map((p) => p.telegramTopic);
    expect(topics).toContain('Bug Reports');
    expect(topics).toContain('Daily Digest');

    handler.dispose();
  });

  it('preserves telegramTopic alongside other PendingPrompt fields', async () => {
    const onPromptsReady = jest.fn();
    const configProvider = createMockConfigProvider({
      LabelAdd: [
        {
          name: 'Triage automation',
          telegramTopic: 'Triage',
          labels: ['auto'],
          permissionMode: 'ask',
          actions: [
            {
              type: 'prompt',
              prompt: 'Triage the $ROX_LABEL label',
              llmConnection: 'anthropic',
              model: 'claude-sonnet-4-6',
            },
          ],
        },
      ],
    });

    const handler = new PromptHandler(createOptions({ onPromptsReady }), configProvider);
    handler.subscribe(bus);

    await bus.emit('LabelAdd', {
      workspaceId: 'test-workspace',
      timestamp: Date.now(),
      label: 'triage',
    });

    expect(onPromptsReady).toHaveBeenCalledTimes(1);
    const prompts: PendingPrompt[] = onPromptsReady.mock.calls[0]![0];
    expect(prompts[0]).toMatchObject({
      automationName: 'Triage automation',
      telegramTopic: 'Triage',
      labels: ['auto'],
      permissionMode: 'ask',
      llmConnection: 'anthropic',
      model: 'claude-sonnet-4-6',
    });
    expect(prompts[0]!.prompt).toContain('triage');

    handler.dispose();
  });
});

// ---------------------------------------------------------------------------
// Schema: telegramTopic validation in AutomationMatcherSchema
// ---------------------------------------------------------------------------

describe('AutomationMatcherSchema — telegramTopic validation', () => {
  const baseValidMatcher = {
    actions: [{ type: 'prompt', prompt: 'Do something' }],
  };

  it('accepts a matcher with a valid telegramTopic (1–128 chars)', () => {
    const result = AutomationMatcherSchema.safeParse({
      ...baseValidMatcher,
      telegramTopic: 'Bug Reports',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.telegramTopic).toBe('Bug Reports');
    }
  });

  it('accepts a matcher without telegramTopic (field is optional)', () => {
    const result = AutomationMatcherSchema.safeParse(baseValidMatcher);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.telegramTopic).toBeUndefined();
    }
  });

  it('rejects an empty string telegramTopic (min 1 char)', () => {
    const result = AutomationMatcherSchema.safeParse({
      ...baseValidMatcher,
      telegramTopic: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a telegramTopic exceeding 128 characters', () => {
    const result = AutomationMatcherSchema.safeParse({
      ...baseValidMatcher,
      telegramTopic: 'x'.repeat(129),
    });
    expect(result.success).toBe(false);
  });

  it('accepts a telegramTopic of exactly 128 characters (boundary)', () => {
    const result = AutomationMatcherSchema.safeParse({
      ...baseValidMatcher,
      telegramTopic: 'x'.repeat(128),
    });
    expect(result.success).toBe(true);
  });

  it('accepts a telegramTopic of exactly 1 character (boundary)', () => {
    const result = AutomationMatcherSchema.safeParse({
      ...baseValidMatcher,
      telegramTopic: 'A',
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Schema: full AutomationsConfig round-trip with telegramTopic
// ---------------------------------------------------------------------------

describe('AutomationsConfigSchema — telegramTopic round-trip', () => {
  it('preserves telegramTopic through full config validation', () => {
    const input = {
      automations: {
        LabelAdd: [
          {
            matcher: 'bug',
            telegramTopic: 'Bug Reports',
            actions: [{ type: 'prompt', prompt: 'Bug added' }],
          },
        ],
      },
    };
    const result = AutomationsConfigSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      const matcher = result.data.automations['LabelAdd']?.[0];
      expect(matcher?.telegramTopic).toBe('Bug Reports');
    }
  });

  it('preserves undefined telegramTopic when omitted in full config', () => {
    const input = {
      automations: {
        LabelAdd: [
          {
            matcher: 'feature',
            actions: [{ type: 'prompt', prompt: 'Feature added' }],
          },
        ],
      },
    };
    const result = AutomationsConfigSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      const matcher = result.data.automations['LabelAdd']?.[0];
      expect(matcher?.telegramTopic).toBeUndefined();
    }
  });
});
