/**
 * UserRepository — type-safe, Result-based persistence façade for `users`.
 *
 * Contract: every method strictly parses input AND output through the Zod
 * schema (FR-04.7), catches expected misses as `Err(RepositoryError)`
 * rather than throwing (NFR for predictable consumer code), and emits
 * audit events through the injected shim (NFR-04.5).
 *
 * Feature flag: `rox.feature.contracts.user-v1` (FR-04.8). When OFF, the
 * repository is constructible but `register()` does not bind to the global
 * service container — exposed via `isRegistered()` for downstream WTs.
 *
 * In-memory backend is provided here so contracts can be exercised before
 * the Postgres adapter lands. The interface boundary `UserStore` lets a
 * Postgres implementation slot in without touching this file.
 *
 * See spec:
 * docs/superpowers/specs/2026-05-21-wt-04-contract-user-identity-design.md
 */

import {
  DEFAULT_TENANT_ID,
  UserSchema,
  type User,
  type UserStatus,
} from '@rox-one/shared/core';

export type RepositoryErrorCode =
  | 'not-found'
  | 'duplicate'
  | 'invalid-input'
  | 'invalid-output'
  | 'forbidden';

export interface RepositoryError {
  readonly code: RepositoryErrorCode;
  readonly message: string;
  readonly cause?: unknown;
}

export type Result<T, E = RepositoryError> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export function Ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function Err<E = RepositoryError>(error: E): Result<never, E> {
  return { ok: false, error };
}

/**
 * Hash a raw email to a short opaque token suitable for audit payloads.
 * Used to satisfy NFR-04.2 — raw email is NEVER logged.
 */
export function hashEmailForAudit(email: string): string {
  // FNV-1a 32-bit — deterministic, no crypto subtle import needed in the hot
  // audit path. Sufficient for log correlation, not for security.
  let hash = 0x811c9dc5;
  for (let i = 0; i < email.length; i += 1) {
    hash ^= email.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0').slice(0, 8);
}

export type UserAuditEventType =
  | 'user.created'
  | 'user.updated'
  | 'user.soft-deleted'
  | 'user.restored';

export interface UserAuditEvent {
  readonly type: UserAuditEventType;
  readonly userId: string;
  readonly tenantId: string;
  readonly emailHash: string;
  readonly atUtc: string;
}

export type AuditSink = (event: UserAuditEvent) => void;

export interface UserCreateInput {
  readonly id: string;
  readonly tenantId?: string;
  readonly email: string;
  readonly username?: string;
  readonly displayName: string;
  readonly locale?: string;
  readonly timezone?: string;
  readonly status?: UserStatus;
  readonly createdAtUtc: string;
  readonly updatedAtUtc: string;
}

export interface UserPatch {
  readonly displayName?: string;
  readonly username?: string;
  readonly locale?: string;
  readonly timezone?: string;
  readonly status?: UserStatus;
  readonly updatedAtUtc: string;
}

export interface UserListFilter {
  readonly tenantId?: string;
  readonly status?: UserStatus;
  /** Default: false → soft-deleted rows are excluded. */
  readonly includeDeleted?: boolean;
}

/**
 * Storage seam — keeps Postgres concerns out of the repository so the
 * Result-based contract can be unit-tested without testcontainers.
 */
export interface UserStore {
  insert(user: User): Result<User>;
  findById(id: string): User | undefined;
  findByEmail(tenantId: string, email: string): User | undefined;
  update(id: string, patcher: (current: User) => User): User | undefined;
  list(filter: UserListFilter): readonly User[];
}

export interface UserRepositoryOptions {
  readonly featureFlagOn?: boolean;
  readonly tenantFlagOn?: boolean;
  readonly defaultTenantId?: string;
  readonly auditSink?: AuditSink;
  readonly store?: UserStore;
}

export class UserRepository {
  private readonly store: UserStore;
  private readonly auditSink?: AuditSink;
  private readonly featureFlagOn: boolean;
  private readonly tenantFlagOn: boolean;
  private readonly defaultTenantId: string;
  private registered = false;

  constructor(options: UserRepositoryOptions = {}) {
    this.store = options.store ?? createInMemoryUserStore();
    this.auditSink = options.auditSink;
    this.featureFlagOn = options.featureFlagOn ?? false;
    this.tenantFlagOn = options.tenantFlagOn ?? false;
    this.defaultTenantId = options.defaultTenantId ?? DEFAULT_TENANT_ID;
  }

  /**
   * FR-04.8 — register the repository to the global service container only
   * when `rox.feature.contracts.user-v1` is ON. The container itself is
   * defined by downstream WTs; here we expose the bit so consumers can
   * branch (or assert) on registration state.
   */
  register(): boolean {
    if (!this.featureFlagOn) return false;
    this.registered = true;
    return true;
  }

  isRegistered(): boolean {
    return this.registered;
  }

  create(input: UserCreateInput): Result<User> {
    // FR-04.5 — backfill DEFAULT_TENANT_ID when tenant-v1 flag is OFF
    // and caller did not supply a tenantId.
    const tenantId =
      input.tenantId ?? (this.tenantFlagOn ? undefined : this.defaultTenantId);
    if (!tenantId) {
      return Err({
        code: 'invalid-input',
        message: 'tenantId is required when tenant-v1 flag is ON',
      });
    }

    const candidate = {
      id: input.id,
      tenantId,
      email: input.email,
      username: input.username,
      displayName: input.displayName,
      locale: input.locale,
      timezone: input.timezone,
      status: input.status ?? 'active',
      createdAtUtc: input.createdAtUtc,
      updatedAtUtc: input.updatedAtUtc,
    };

    const parsed = UserSchema.safeParse(candidate);
    if (!parsed.success) {
      return Err({
        code: 'invalid-input',
        message: parsed.error.issues[0]?.message ?? 'invalid user input',
        cause: parsed.error,
      });
    }

    // AC-04.5 — duplicate email per tenant returns Err, not throws.
    if (this.store.findByEmail(parsed.data.tenantId, parsed.data.email)) {
      return Err({
        code: 'duplicate',
        message: `user already exists for email in tenant`,
      });
    }

    const inserted = this.store.insert(parsed.data);
    if (!inserted.ok) return inserted;

    this.emit('user.created', inserted.value);
    return inserted;
  }

  findById(id: string): Result<User> {
    const row = this.store.findById(id);
    if (!row) {
      return Err({ code: 'not-found', message: `user ${id} not found` });
    }
    return this.reparse(row);
  }

  findByEmail(tenantId: string, email: string): Result<User> {
    const row = this.store.findByEmail(tenantId, email);
    if (!row) {
      return Err({ code: 'not-found', message: `user not found for email` });
    }
    return this.reparse(row);
  }

  update(id: string, patch: UserPatch): Result<User> {
    const updated = this.store.update(id, (current) => ({
      ...current,
      ...patch,
      updatedAtUtc: patch.updatedAtUtc,
    }));
    if (!updated) {
      return Err({ code: 'not-found', message: `user ${id} not found` });
    }
    const reparsed = this.reparse(updated);
    if (!reparsed.ok) return reparsed;
    this.emit('user.updated', reparsed.value);
    return reparsed;
  }

  softDelete(id: string, atUtc: string): Result<User> {
    const updated = this.store.update(id, (current) => ({
      ...current,
      status: 'deleted',
      deletedAtUtc: atUtc,
      updatedAtUtc: atUtc,
    }));
    if (!updated) {
      return Err({ code: 'not-found', message: `user ${id} not found` });
    }
    const reparsed = this.reparse(updated);
    if (!reparsed.ok) return reparsed;
    this.emit('user.soft-deleted', reparsed.value);
    return reparsed;
  }

  restore(id: string, atUtc: string): Result<User> {
    const updated = this.store.update(id, (current) => ({
      ...current,
      status: 'active',
      deletedAtUtc: null,
      updatedAtUtc: atUtc,
    }));
    if (!updated) {
      return Err({ code: 'not-found', message: `user ${id} not found` });
    }
    const reparsed = this.reparse(updated);
    if (!reparsed.ok) return reparsed;
    this.emit('user.restored', reparsed.value);
    return reparsed;
  }

  list(filter: UserListFilter = {}): Result<readonly User[]> {
    const rows = this.store.list(filter);
    const parsed: User[] = [];
    for (const row of rows) {
      const r = UserSchema.safeParse(row);
      if (!r.success) {
        return Err({
          code: 'invalid-output',
          message: `db row failed schema validation: ${r.error.issues[0]?.message}`,
          cause: r.error,
        });
      }
      parsed.push(r.data);
    }
    return Ok(parsed);
  }

  private reparse(row: User): Result<User> {
    const r = UserSchema.safeParse(row);
    if (!r.success) {
      return Err({
        code: 'invalid-output',
        message: `db row failed schema validation: ${r.error.issues[0]?.message}`,
        cause: r.error,
      });
    }
    return Ok(r.data);
  }

  private emit(type: UserAuditEventType, user: User): void {
    if (!this.auditSink) return;
    this.auditSink({
      type,
      userId: user.id,
      tenantId: user.tenantId,
      emailHash: hashEmailForAudit(user.email),
      atUtc: user.updatedAtUtc,
    });
  }
}

/**
 * In-memory implementation of `UserStore`. Production backend is Postgres
 * (see migrations/2026-05-21-user-identity-up.sql); this exists so the
 * contract is testable without a live database.
 */
export function createInMemoryUserStore(): UserStore {
  const byId = new Map<string, User>();
  const byTenantEmail = new Map<string, string>();
  const keyFor = (tenantId: string, email: string): string =>
    `${tenantId}::${email.toLowerCase()}`;

  return {
    insert(user) {
      const key = keyFor(user.tenantId, user.email);
      if (byTenantEmail.has(key)) {
        return Err({ code: 'duplicate', message: 'duplicate email per tenant' });
      }
      byId.set(user.id, user);
      byTenantEmail.set(key, user.id);
      return Ok(user);
    },
    findById(id) {
      return byId.get(id);
    },
    findByEmail(tenantId, email) {
      const id = byTenantEmail.get(keyFor(tenantId, email));
      return id ? byId.get(id) : undefined;
    },
    update(id, patcher) {
      const current = byId.get(id);
      if (!current) return undefined;
      const next = patcher(current);
      byId.set(id, next);
      return next;
    },
    list(filter) {
      const rows: User[] = [];
      for (const row of byId.values()) {
        if (filter.tenantId && row.tenantId !== filter.tenantId) continue;
        if (filter.status && row.status !== filter.status) continue;
        if (!filter.includeDeleted && row.deletedAtUtc !== null) continue;
        rows.push(row);
      }
      return rows;
    },
  };
}
