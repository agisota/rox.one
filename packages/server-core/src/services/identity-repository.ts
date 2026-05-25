/**
 * IdentityRepository — type-safe, Result-based persistence façade for
 * `identities` (federated provider link to a User).
 *
 * Compound unique `(tenantId, provider, externalId)` is enforced both in
 * Postgres DDL (see migrations/2026-05-21-user-identity-up.sql) and here
 * at the application layer so the Result contract works without a live DB.
 *
 * Audit shim emits two event types: `identity.linked`, `identity.unlinked`
 * (NFR-04.5). Together with the user repository this totals the five
 * events required by AC-04.8.
 *
 * See spec:
 * docs/superpowers/specs/2026-05-21-wt-04-contract-user-identity-design.md
 */

import {
  IdentitySchema,
  type Identity,
  type IdentityProvider,
} from '@rox-one/shared/core';

import {
  Err,
  Ok,
  type RepositoryError,
  type Result,
} from './user-repository.ts';

export type IdentityAuditEventType = 'identity.linked' | 'identity.unlinked';

export interface IdentityAuditEvent {
  readonly type: IdentityAuditEventType;
  readonly identityId: string;
  readonly userId: string;
  readonly tenantId: string;
  readonly provider: IdentityProvider;
  readonly atUtc: string;
}

export type IdentityAuditSink = (event: IdentityAuditEvent) => void;

export interface IdentityCreateInput {
  readonly id: string;
  readonly userId: string;
  readonly tenantId: string;
  readonly provider: IdentityProvider;
  readonly externalId: string;
  readonly claims?: Record<string, unknown>;
  readonly primary?: boolean;
  readonly lastSeenAtUtc?: string | null;
  readonly createdAtUtc: string;
}

export interface IdentityStore {
  insert(identity: Identity): Result<Identity>;
  findById(id: string): Identity | undefined;
  findByProviderExternalId(
    tenantId: string,
    provider: IdentityProvider,
    externalId: string,
  ): Identity | undefined;
  listByUser(userId: string): readonly Identity[];
  update(
    id: string,
    patcher: (current: Identity) => Identity,
  ): Identity | undefined;
}

export interface IdentityRepositoryOptions {
  readonly featureFlagOn?: boolean;
  readonly auditSink?: IdentityAuditSink;
  readonly store?: IdentityStore;
}

export class IdentityRepository {
  private readonly store: IdentityStore;
  private readonly auditSink?: IdentityAuditSink;
  private readonly featureFlagOn: boolean;
  private registered = false;

  constructor(options: IdentityRepositoryOptions = {}) {
    this.store = options.store ?? createInMemoryIdentityStore();
    this.auditSink = options.auditSink;
    this.featureFlagOn = options.featureFlagOn ?? false;
  }

  register(): boolean {
    if (!this.featureFlagOn) return false;
    this.registered = true;
    return true;
  }

  isRegistered(): boolean {
    return this.registered;
  }

  create(input: IdentityCreateInput): Result<Identity> {
    const candidate = {
      id: input.id,
      userId: input.userId,
      tenantId: input.tenantId,
      provider: input.provider,
      externalId: input.externalId,
      claims: input.claims ?? {},
      primary: input.primary ?? false,
      lastSeenAtUtc: input.lastSeenAtUtc ?? null,
      createdAtUtc: input.createdAtUtc,
    };

    const parsed = IdentitySchema.safeParse(candidate);
    if (!parsed.success) {
      return Err({
        code: 'invalid-input',
        message: parsed.error.issues[0]?.message ?? 'invalid identity input',
        cause: parsed.error,
      });
    }

    // Compound unique check — mirrors the Postgres constraint.
    const dup = this.store.findByProviderExternalId(
      parsed.data.tenantId,
      parsed.data.provider,
      parsed.data.externalId,
    );
    if (dup) {
      return Err({
        code: 'duplicate',
        message: 'identity already linked for (tenant, provider, externalId)',
      });
    }

    const inserted = this.store.insert(parsed.data);
    if (!inserted.ok) return inserted;

    this.emit('identity.linked', inserted.value);
    return inserted;
  }

  findById(id: string): Result<Identity> {
    const row = this.store.findById(id);
    if (!row) return Err({ code: 'not-found', message: `identity ${id} not found` });
    return this.reparse(row);
  }

  findByProviderExternalId(
    provider: IdentityProvider,
    externalId: string,
    tenantId: string,
  ): Result<Identity> {
    const row = this.store.findByProviderExternalId(tenantId, provider, externalId);
    if (!row) {
      return Err({
        code: 'not-found',
        message: 'identity not found for (provider, externalId, tenantId)',
      });
    }
    return this.reparse(row);
  }

  listByUser(userId: string): Result<readonly Identity[]> {
    const rows = this.store.listByUser(userId);
    const parsed: Identity[] = [];
    for (const row of rows) {
      const r = IdentitySchema.safeParse(row);
      if (!r.success) {
        return Err({
          code: 'invalid-output',
          message: r.error.issues[0]?.message ?? 'invalid db row',
          cause: r.error,
        });
      }
      parsed.push(r.data);
    }
    return Ok(parsed);
  }

  /**
   * Re-points an existing identity row to a different user (e.g. account
   * merge). Emits `identity.linked` for the new binding.
   */
  linkToUser(identityId: string, userId: string, atUtc: string): Result<Identity> {
    const updated = this.store.update(identityId, (current) => ({
      ...current,
      userId,
      lastSeenAtUtc: atUtc,
    }));
    if (!updated) {
      return Err({ code: 'not-found', message: `identity ${identityId} not found` });
    }
    const reparsed = this.reparse(updated);
    if (!reparsed.ok) return reparsed;
    this.emit('identity.linked', reparsed.value, atUtc);
    return reparsed;
  }

  /**
   * Soft-detaches an identity (sets `deletedAtUtc`). Database FK is
   * `ON DELETE RESTRICT`, so we never hard-delete here.
   */
  unlinkFromUser(identityId: string, atUtc: string): Result<Identity> {
    const updated = this.store.update(identityId, (current) => ({
      ...current,
      deletedAtUtc: atUtc,
    }));
    if (!updated) {
      return Err({ code: 'not-found', message: `identity ${identityId} not found` });
    }
    const reparsed = this.reparse(updated);
    if (!reparsed.ok) return reparsed;
    this.emit('identity.unlinked', reparsed.value, atUtc);
    return reparsed;
  }

  private reparse(row: Identity): Result<Identity, RepositoryError> {
    const r = IdentitySchema.safeParse(row);
    if (!r.success) {
      return Err({
        code: 'invalid-output',
        message: r.error.issues[0]?.message ?? 'invalid db row',
        cause: r.error,
      });
    }
    return Ok(r.data);
  }

  private emit(
    type: IdentityAuditEventType,
    identity: Identity,
    atUtc: string = identity.createdAtUtc,
  ): void {
    if (!this.auditSink) return;
    this.auditSink({
      type,
      identityId: identity.id,
      userId: identity.userId,
      tenantId: identity.tenantId,
      provider: identity.provider,
      atUtc,
    });
  }
}

export function createInMemoryIdentityStore(): IdentityStore {
  const byId = new Map<string, Identity>();
  const byTenantProviderExternal = new Map<string, string>();
  const keyFor = (
    tenantId: string,
    provider: IdentityProvider,
    externalId: string,
  ): string => `${tenantId}::${provider}::${externalId}`;

  return {
    insert(identity) {
      const key = keyFor(identity.tenantId, identity.provider, identity.externalId);
      if (byTenantProviderExternal.has(key)) {
        return Err({
          code: 'duplicate',
          message: 'duplicate (tenant, provider, externalId)',
        });
      }
      byId.set(identity.id, identity);
      byTenantProviderExternal.set(key, identity.id);
      return Ok(identity);
    },
    findById(id) {
      return byId.get(id);
    },
    findByProviderExternalId(tenantId, provider, externalId) {
      const id = byTenantProviderExternal.get(keyFor(tenantId, provider, externalId));
      return id ? byId.get(id) : undefined;
    },
    listByUser(userId) {
      const rows: Identity[] = [];
      for (const row of byId.values()) {
        if (row.userId === userId && row.deletedAtUtc === null) rows.push(row);
      }
      return rows;
    },
    update(id, patcher) {
      const current = byId.get(id);
      if (!current) return undefined;
      const next = patcher(current);
      byId.set(id, next);
      return next;
    },
  };
}
