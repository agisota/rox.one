/**
 * Tests for the centralized FeatureFlag registry.
 *
 * WT-07 owns this contract. Sibling WTs only read; they may register their
 * own flag via `registerFlag` (in-memory), but the compile-time table in
 * `registry.ts` is the source of truth for Wave 0/1 scaffolded flags.
 *
 * Covers AC-1..AC-3 from spec §5.
 */

import { afterEach, describe, expect, it } from 'bun:test';
import {
  DuplicateFlagError,
  FEATURE_FLAGS,
  getDefaultValue,
  registerFlag,
  resetDynamicRegistry,
  type FeatureFlagKey,
} from '../../../packages/shared/src/feature-flags/registry.ts';

afterEach(() => {
  resetDynamicRegistry();
});

describe('FeatureFlag registry — compile-time table', () => {
  it('AC-1: returns default value for known keys', () => {
    expect(getDefaultValue('rox.feature.access-jwt')).toBe(false);
    expect(getDefaultValue('rox.feature.scim')).toBe(false);
    expect(getDefaultValue('rox.feature.rbac.v1')).toBe(false);
  });

  it('exposes contract flags for sibling Wave-0 WTs', () => {
    const expected: FeatureFlagKey[] = [
      'rox.feature.contracts.user-v1',
      'rox.feature.contracts.tenant-v1',
      'rox.feature.contracts.workspace-v1',
      'rox.feature.contracts.audit-v1',
    ];
    for (const key of expected) {
      expect(FEATURE_FLAGS[key]).toBeDefined();
      expect(FEATURE_FLAGS[key].default).toBe(false);
    }
  });

  it('records the owning WT for every flag', () => {
    for (const key of Object.keys(FEATURE_FLAGS) as FeatureFlagKey[]) {
      expect(FEATURE_FLAGS[key].owner_wt).toMatch(/^WT-\d{2}$/);
    }
  });
});

describe('FeatureFlag registry — dynamic registration', () => {
  it('AC-2: registerFlag adds a new flag with the supplied default', () => {
    registerFlag('rox.feature.foo', true, 'WT-99');
    expect(getDefaultValue('rox.feature.foo')).toBe(true);
  });

  it('AC-3: duplicate registerFlag with conflicting default throws DuplicateFlagError', () => {
    registerFlag('rox.feature.bar', true, 'WT-99');
    expect(() => registerFlag('rox.feature.bar', false, 'WT-99')).toThrow(DuplicateFlagError);
  });

  it('idempotent re-register with same default does not throw', () => {
    registerFlag('rox.feature.baz', true, 'WT-99');
    expect(() => registerFlag('rox.feature.baz', true, 'WT-99')).not.toThrow();
  });

  it('does not allow shadowing a compile-time flag with a different default', () => {
    expect(() => registerFlag('rox.feature.access-jwt', true, 'WT-99')).toThrow(
      DuplicateFlagError,
    );
  });

  it('getDefaultValue throws for unknown unregistered keys', () => {
    expect(() => getDefaultValue('rox.feature.never-registered')).toThrow();
  });
});
