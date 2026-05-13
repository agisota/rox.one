import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import {
  __resetMultiTenantForTests,
  __setMultiTenantForTests,
  isMultiTenantActivated,
} from '../storage-scope-runtime.ts';

describe('isMultiTenantActivated', () => {
  const previousValue = process.env.ROX_MULTI_TENANT;

  beforeEach(() => {
    __resetMultiTenantForTests();
    if (previousValue === undefined) {
      delete process.env.ROX_MULTI_TENANT;
    } else {
      process.env.ROX_MULTI_TENANT = previousValue;
    }
  });

  afterEach(() => {
    __resetMultiTenantForTests();
    if (previousValue === undefined) {
      delete process.env.ROX_MULTI_TENANT;
    } else {
      process.env.ROX_MULTI_TENANT = previousValue;
    }
  });

  test('returns false when ROX_MULTI_TENANT is unset', () => {
    delete process.env.ROX_MULTI_TENANT;
    expect(isMultiTenantActivated()).toBe(false);
  });

  test('returns true when ROX_MULTI_TENANT=1', () => {
    process.env.ROX_MULTI_TENANT = '1';
    expect(isMultiTenantActivated()).toBe(true);
  });

  test('returns false for non-"1" values', () => {
    for (const value of ['true', 'TRUE', 'yes', '0', '', 'on']) {
      process.env.ROX_MULTI_TENANT = value;
      __resetMultiTenantForTests();
      expect(isMultiTenantActivated()).toBe(false);
    }
  });

  test('result is memoized after the first env read', () => {
    process.env.ROX_MULTI_TENANT = '1';
    expect(isMultiTenantActivated()).toBe(true);

    delete process.env.ROX_MULTI_TENANT;
    expect(isMultiTenantActivated()).toBe(true);
  });

  test('__setMultiTenantForTests overrides the memoized value', () => {
    delete process.env.ROX_MULTI_TENANT;
    expect(isMultiTenantActivated()).toBe(false);

    __setMultiTenantForTests(true);
    expect(isMultiTenantActivated()).toBe(true);

    __setMultiTenantForTests(false);
    expect(isMultiTenantActivated()).toBe(false);
  });

  test('__resetMultiTenantForTests clears the memo and override', () => {
    __setMultiTenantForTests(true);
    expect(isMultiTenantActivated()).toBe(true);

    __resetMultiTenantForTests();
    delete process.env.ROX_MULTI_TENANT;
    expect(isMultiTenantActivated()).toBe(false);
  });
});
