/**
 * Provider Identifier — M.7 T240.
 *
 * Branded `ProviderId` plus parsers that gate the registry / orchestrator
 * against unknown provider strings. The set is closed: the orchestration
 * layer can only route to providers listed in {@link PROVIDER_IDS}.
 *
 * Pure module. The brand symbol is local so callers cannot synthesise a
 * `ProviderId` without going through `parseProviderId` / `unsafeProviderId`.
 */

export const PROVIDER_IDS = [
  'anthropic',
  'openai',
  'google',
  'azure-openai',
  'bedrock',
  'ollama',
] as const;

export type ProviderIdLiteral = (typeof PROVIDER_IDS)[number];

declare const providerIdBrand: unique symbol;

export type ProviderId = ProviderIdLiteral & { readonly [providerIdBrand]: 'ProviderId' };

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export interface ProviderIdParseError {
  readonly kind: 'ProviderIdParseError';
  readonly input: string;
  readonly allowed: readonly ProviderIdLiteral[];
}

function isProviderIdLiteral(value: string): value is ProviderIdLiteral {
  return (PROVIDER_IDS as readonly string[]).includes(value);
}

export function parseProviderId(input: string): Result<ProviderId, ProviderIdParseError> {
  const normalised = input.trim().toLowerCase();
  if (isProviderIdLiteral(normalised)) {
    return { ok: true, value: normalised as ProviderId };
  }
  return {
    ok: false,
    error: { kind: 'ProviderIdParseError', input, allowed: PROVIDER_IDS },
  };
}

export function isProviderId(value: string): value is ProviderIdLiteral {
  return isProviderIdLiteral(value.trim().toLowerCase());
}

export function unsafeProviderId(literal: ProviderIdLiteral): ProviderId {
  if (!isProviderIdLiteral(literal)) {
    throw new Error(`unsafeProviderId: ${literal} is not a known ProviderId`);
  }
  return literal as ProviderId;
}

export function providerIdToString(value: ProviderId): ProviderIdLiteral {
  return value;
}
