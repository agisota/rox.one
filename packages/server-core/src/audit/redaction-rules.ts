/**
 * WT-08 — Server-side redaction rule registry.
 *
 * Layers on top of `@rox-one/shared/audit` sanitizer to allow per-tenant
 * override hooks. The default rule-set re-exports the shared defaults so
 * server-core callers can compose a single sanitization pass without crossing
 * the shared/server boundary in their own code.
 */
import {
  DEFAULT_SANITIZER_PATTERNS,
  sanitizePayload,
  type SanitizerOptions,
} from '@rox-one/shared/audit'

export interface TenantRedactionOverride {
  tenantId: string
  extraKeyPatterns?: ReadonlyArray<RegExp>
  extraValuePatterns?: ReadonlyArray<RegExp>
}

interface RedactionRegistry {
  overrides: Map<string, TenantRedactionOverride>
}

const REDACTION_REGISTRY = Symbol.for('rox.audit.redactionRegistry')

function getRegistry(): RedactionRegistry {
  const root = globalThis as typeof globalThis & {
    [REDACTION_REGISTRY]?: RedactionRegistry
  }
  if (!root[REDACTION_REGISTRY]) {
    root[REDACTION_REGISTRY] = { overrides: new Map() }
  }
  return root[REDACTION_REGISTRY]
}

export function registerTenantRedactionOverride(override: TenantRedactionOverride): void {
  getRegistry().overrides.set(override.tenantId, override)
}

export function getTenantRedactionOverride(tenantId: string): TenantRedactionOverride | undefined {
  return getRegistry().overrides.get(tenantId)
}

export function clearTenantRedactionOverrides(): void {
  getRegistry().overrides.clear()
}

export function listTenantRedactionOverrides(): TenantRedactionOverride[] {
  return Array.from(getRegistry().overrides.values())
}

/**
 * Sanitize a payload using default rules + any tenant-specific overrides.
 * If `tenantId` is null/undefined, defaults are applied.
 */
export function sanitizePayloadForTenant<T>(payload: T, tenantId: string | null | undefined): T {
  if (!tenantId) return sanitizePayload(payload)
  const override = getTenantRedactionOverride(tenantId)
  if (!override) return sanitizePayload(payload)
  const options: SanitizerOptions = {
    extraKeyPatterns: override.extraKeyPatterns,
    extraValuePatterns: override.extraValuePatterns,
  }
  return sanitizePayload(payload, options)
}

export const DEFAULT_REDACTION_RULES = {
  keyPatterns: DEFAULT_SANITIZER_PATTERNS.keyPatterns,
  valuePatterns: DEFAULT_SANITIZER_PATTERNS.valuePatterns,
} as const
