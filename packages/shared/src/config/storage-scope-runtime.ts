/**
 * Runtime-mode detection for multi-tenant storage isolation.
 *
 * Multi-tenant storage is opt-in and activates only when ROX_MULTI_TENANT is
 * exactly "1". The process memoizes the first read so operators must restart
 * to change storage tenancy mode.
 */

let memoized: boolean | null = null;
let testOverride: boolean | null = null;

export function isMultiTenantActivated(): boolean {
  if (testOverride !== null) {
    return testOverride;
  }

  if (memoized === null) {
    memoized = process.env.ROX_MULTI_TENANT === '1';
  }

  return memoized;
}

export function __setMultiTenantForTests(value: boolean): void {
  testOverride = value;
}

export function __resetMultiTenantForTests(): void {
  memoized = null;
  testOverride = null;
}
