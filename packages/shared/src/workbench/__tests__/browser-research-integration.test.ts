import { describe, expect, it } from 'bun:test';
import {
  BROWSER_RESEARCH_TOOL_IDS,
  createBrowserResearchToolPlan,
  resolveBrowserResearchIntegration,
} from '../browser-research-integration';

describe('Browser Research Integration', () => {
  it('enables research tools for research mode when fact-check gating is present', () => {
    const resolved = resolveBrowserResearchIntegration({
      modeId: 'research',
      permissionMode: 'ask',
      validationGates: ['schema', 'fact_check', 'logic_check'],
    });

    expect(BROWSER_RESEARCH_TOOL_IDS).toEqual(['web_search', 'web_fetch', 'browser_tool']);
    expect(resolved.enabledTools).toEqual(['web_search', 'web_fetch', 'browser_tool']);
    expect(resolved.disabledTools).toEqual([]);
    expect(resolved.requiredValidationGates).toEqual(['fact_check']);
    expect(resolved.requiresUserPermission).toBe(true);
  });

  it('keeps browser automation disabled in safe mode while allowing non-browser research tools', () => {
    const resolved = resolveBrowserResearchIntegration({
      modeId: 'research',
      permissionMode: 'safe',
      validationGates: ['fact_check'],
    });

    expect(resolved.enabledTools).toEqual(['web_search', 'web_fetch']);
    expect(resolved.disabledTools).toEqual([
      {
        toolId: 'browser_tool',
        reason: 'browser_tool requires ask permission mode for interactive browser research',
      },
    ]);
    expect(resolved.requiresUserPermission).toBe(false);
  });

  it('denies all browser research tools when fact-check gating is absent', () => {
    const resolved = resolveBrowserResearchIntegration({
      modeId: 'research',
      permissionMode: 'ask',
      validationGates: ['schema', 'logic_check'],
    });

    expect(resolved.enabledTools).toEqual([]);
    expect(resolved.disabledTools).toEqual([
      { toolId: 'web_search', reason: 'missing required validation gate: fact_check' },
      { toolId: 'web_fetch', reason: 'missing required validation gate: fact_check' },
      { toolId: 'browser_tool', reason: 'missing required validation gate: fact_check' },
    ]);
  });

  it('denies unsupported product modes by default even if fact-check is selected', () => {
    const resolved = resolveBrowserResearchIntegration({
      modeId: 'build',
      permissionMode: 'ask',
      validationGates: ['fact_check'],
    });

    expect(resolved.enabledTools).toEqual([]);
    expect(resolved.disabledTools).toEqual([
      { toolId: 'web_search', reason: 'product mode build does not support browser research tools' },
      { toolId: 'web_fetch', reason: 'product mode build does not support browser research tools' },
      { toolId: 'browser_tool', reason: 'product mode build does not support browser research tools' },
    ]);
  });

  it('can resolve a restricted requested tool subset deterministically', () => {
    const resolved = resolveBrowserResearchIntegration({
      modeId: 'review',
      permissionMode: 'ask',
      validationGates: ['fact_check', 'security_check'],
      requestedTools: ['browser_tool', 'web_search', 'web_search'],
    });

    expect(resolved.enabledTools).toEqual(['web_search', 'browser_tool']);
    expect(resolved.disabledTools).toEqual([]);
    expect(resolved.policySummary).toBe('browser research enabled for review with fact_check gate');
  });

  it('constructs runtime tools only through enabled fake factories', () => {
    const calls: string[] = [];
    const resolved = resolveBrowserResearchIntegration({
      modeId: 'research',
      permissionMode: 'safe',
      validationGates: ['fact_check'],
    });

    const plan = createBrowserResearchToolPlan(resolved, {
      web_search: () => {
        calls.push('web_search');
        return { name: 'fake-web-search' };
      },
      web_fetch: () => {
        calls.push('web_fetch');
        return { name: 'fake-web-fetch' };
      },
      browser_tool: () => {
        calls.push('browser_tool');
        return { name: 'fake-browser-tool' };
      },
    });

    expect(calls).toEqual(['web_search', 'web_fetch']);
    expect(plan.tools).toEqual([
      { toolId: 'web_search', tool: { name: 'fake-web-search' } },
      { toolId: 'web_fetch', tool: { name: 'fake-web-fetch' } },
    ]);
    expect(plan.disabledTools).toEqual([
      {
        toolId: 'browser_tool',
        reason: 'browser_tool requires ask permission mode for interactive browser research',
      },
    ]);
  });

  it('keeps enabled runtime tools blocked when a factory is missing', () => {
    const resolved = resolveBrowserResearchIntegration({
      modeId: 'research',
      permissionMode: 'ask',
      validationGates: ['fact_check'],
      requestedTools: ['web_search', 'browser_tool'],
    });

    const plan = createBrowserResearchToolPlan(resolved, {
      web_search: () => ({ name: 'fake-web-search' }),
    });

    expect(plan.tools).toEqual([{ toolId: 'web_search', tool: { name: 'fake-web-search' } }]);
    expect(plan.disabledTools).toEqual([
      { toolId: 'browser_tool', reason: 'missing runtime factory for browser_tool' },
    ]);
  });
});
