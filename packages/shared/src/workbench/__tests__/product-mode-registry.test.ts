import { describe, expect, it } from 'bun:test';
import { i18n, setupI18n } from '../../i18n/setupI18n';
import {
  PRODUCT_MODE_IDS,
  ProductModeSchema,
  getProductMode,
  getProductModeRegistry,
  resolveProductModeExecutionConfig,
} from '../product-mode-registry.ts';

setupI18n();

describe('Product mode registry', () => {
  it('defines every Agent Workbench product mode once', () => {
    const registry = getProductModeRegistry();

    expect(registry.map((mode) => mode.id)).toEqual([...PRODUCT_MODE_IDS]);
    expect(new Set(registry.map((mode) => mode.id)).size).toBe(registry.length);

    for (const mode of registry) {
      expect(ProductModeSchema.parse(mode.id)).toBe(mode.id);
      expect(mode.labelKey).toBe(`workbench.modes.${mode.id}.label`);
      expect(mode.descriptionKey).toBe(`workbench.modes.${mode.id}.description`);
      expect(mode.defaultSkills.length).toBeGreaterThan(0);
      expect(mode.defaultAgents.length).toBeGreaterThan(0);
      expect(mode.allowedPermissionModes.length).toBeGreaterThan(0);
      expect(mode.defaultValidationGates.length).toBeGreaterThan(0);
      expect(mode.outputArtifactTypes.length).toBeGreaterThan(0);
    }
  });

  it('has English and Russian labels/descriptions for every mode', () => {
    for (const language of ['en', 'ru']) {
      i18n.changeLanguage(language);

      for (const mode of getProductModeRegistry()) {
        expect(i18n.t(mode.labelKey)).not.toBe(mode.labelKey);
        expect(i18n.t(mode.descriptionKey)).not.toBe(mode.descriptionKey);
      }
    }
  });

  it('resolves rewrite mode to prompt rewriting skills, agents, gates, and prompt artifacts', () => {
    const resolved = resolveProductModeExecutionConfig({
      modeId: 'rewrite',
      permissionMode: 'safe',
    });

    expect(resolved.mode.id).toBe('rewrite');
    expect(resolved.skills).toContain('prompt-rewriter-pack');
    expect(resolved.agents).toContain('intake-agent');
    expect(resolved.validationGates).toContain('schema');
    expect(resolved.outputArtifactTypes).toContain('prompt');
    expect(resolved.permissionMode).toBe('safe');
  });

  it('resolves review and tdd modes with the expected blocking validation defaults', () => {
    const review = getProductMode('review');
    const tdd = getProductMode('tdd');

    expect(review.defaultSkills).toContain('review-board-pack');
    expect(review.defaultValidationGates).toEqual(expect.arrayContaining(['schema', 'logic_check', 'fact_check']));

    expect(tdd.defaultSkills).toContain('tdd-qa-verification-pack');
    expect(tdd.defaultValidationGates).toEqual(expect.arrayContaining(['unit_tests', 'integration_tests', 'e2e_tests']));
  });

  it('enforces permission compatibility during mode resolution', () => {
    expect(() =>
      resolveProductModeExecutionConfig({
        modeId: 'review',
        permissionMode: 'allow-all',
      }),
    ).toThrow('Product mode review is not compatible with permission mode allow-all');

    expect(
      resolveProductModeExecutionConfig({
        modeId: 'build',
        permissionMode: 'allow-all',
      }).permissionMode,
    ).toBe('allow-all');
  });

  it('deduplicates user-selected skills, agents, and validation gates', () => {
    const resolved = resolveProductModeExecutionConfig({
      modeId: 'research',
      permissionMode: 'safe',
      selectedSkills: ['research-fact-check-pack', 'security-compliance-pack'],
      selectedAgents: ['research-agent', 'critic-agent'],
      selectedValidationGates: ['fact_check', 'security_check'],
    });

    expect(resolved.skills.filter((skill) => skill === 'research-fact-check-pack')).toHaveLength(1);
    expect(resolved.agents.filter((agent) => agent === 'research-agent')).toHaveLength(1);
    expect(resolved.validationGates.filter((gate) => gate === 'fact_check')).toHaveLength(1);
    expect(resolved.skills).toContain('security-compliance-pack');
    expect(resolved.agents).toContain('critic-agent');
    expect(resolved.validationGates).toContain('security_check');
  });
});
