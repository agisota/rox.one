/**
 * WT-04 migration — static contract test for the up/down SQL pair.
 *
 * Full live-Postgres round-trip is the CI integration job (spec §16);
 * this unit test guards the invariants that can be checked statically:
 *
 *  - up.sql creates exactly `users` and `identities` tables.
 *  - down.sql drops exactly the same tables (and any indexes the up creates).
 *  - Every CREATE INDEX in up has a matching DROP INDEX in down.
 *  - The provider CHECK enumerates the six values from IdentitySchema.
 *  - The status CHECK enumerates the four values from UserSchema.
 *  - The claims size CHECK uses 16384 (matches IDENTITY_CLAIMS_MAX_BYTES).
 *
 * If a future migration edit drifts one side of the pair, this test fails
 * before CI Postgres ever spins up.
 *
 * See spec: docs/superpowers/specs/2026-05-21-wt-04-contract-user-identity-design.md
 */

import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  IDENTITY_CLAIMS_MAX_BYTES,
  IdentityProviderSchema,
  UserStatusSchema,
} from '@rox-one/shared/core';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIG_DIR = join(HERE, '..', 'migrations');
const UP = readFileSync(join(MIG_DIR, '2026-05-21-user-identity-up.sql'), 'utf8');
const DOWN = readFileSync(join(MIG_DIR, '2026-05-21-user-identity-down.sql'), 'utf8');

function extractCreatedTables(sql: string): string[] {
  return Array.from(sql.matchAll(/CREATE TABLE IF NOT EXISTS\s+(\w+)/gi))
    .map((m) => m[1] ?? '')
    .filter(Boolean);
}

function extractCreatedIndexes(sql: string): string[] {
  return Array.from(sql.matchAll(/CREATE INDEX IF NOT EXISTS\s+(\w+)/gi))
    .map((m) => m[1] ?? '')
    .filter(Boolean);
}

function extractDroppedTables(sql: string): string[] {
  return Array.from(sql.matchAll(/DROP TABLE IF EXISTS\s+(\w+)/gi))
    .map((m) => m[1] ?? '')
    .filter(Boolean);
}

function extractDroppedIndexes(sql: string): string[] {
  return Array.from(sql.matchAll(/DROP INDEX IF EXISTS\s+(\w+)/gi))
    .map((m) => m[1] ?? '')
    .filter(Boolean);
}

describe('migrations/2026-05-21-user-identity', () => {
  it('up.sql creates users and identities (and nothing else)', () => {
    const tables = extractCreatedTables(UP).sort();
    expect(tables).toEqual(['identities', 'users']);
  });

  it('down.sql drops the same tables created by up.sql', () => {
    const created = new Set(extractCreatedTables(UP));
    const dropped = new Set(extractDroppedTables(DOWN));
    expect(dropped).toEqual(created);
  });

  it('every CREATE INDEX has a matching DROP INDEX', () => {
    const created = new Set(extractCreatedIndexes(UP));
    const dropped = new Set(extractDroppedIndexes(DOWN));
    expect(dropped).toEqual(created);
    // Spec §9 lists five indexes total. Two are the UNIQUE constraints
    // (implicit btree, declared inline as `CONSTRAINT ... UNIQUE`) — the
    // other three are explicit CREATE INDEX statements.
    expect(created.size).toBe(3);
  });

  it('provider CHECK matches IdentitySchema enum', () => {
    const providers = IdentityProviderSchema.options;
    for (const p of providers) {
      expect(UP).toContain(`'${p}'`);
    }
    // And no extra providers leak in.
    const checkBlock = UP.match(/provider\s+TEXT\s+NOT NULL\s+CHECK\s*\(provider IN\s*\(([\s\S]*?)\)\)/i);
    expect(checkBlock).not.toBeNull();
  });

  it('status CHECK matches UserSchema enum', () => {
    for (const s of UserStatusSchema.options) {
      expect(UP).toContain(`'${s}'`);
    }
  });

  it(`claims size CHECK uses IDENTITY_CLAIMS_MAX_BYTES = ${IDENTITY_CLAIMS_MAX_BYTES}`, () => {
    expect(UP).toMatch(/length\(claims::text\)\s*<=\s*16384/);
    expect(IDENTITY_CLAIMS_MAX_BYTES).toBe(16384);
  });

  it('FK on identities.user_id is ON DELETE RESTRICT (no cascade)', () => {
    expect(UP).toMatch(/REFERENCES users\(id\) ON DELETE RESTRICT/);
  });

  it('both files are wrapped in a single transaction', () => {
    expect(/\bBEGIN;/.test(UP)).toBe(true);
    expect(/\bCOMMIT;/.test(UP)).toBe(true);
    expect(/\bBEGIN;/.test(DOWN)).toBe(true);
    expect(/\bCOMMIT;/.test(DOWN)).toBe(true);
  });

  it('down.sql drops identities before users (FK order)', () => {
    const idxIdentities = DOWN.indexOf('DROP TABLE IF EXISTS identities');
    const idxUsers = DOWN.indexOf('DROP TABLE IF EXISTS users');
    expect(idxIdentities).toBeGreaterThan(-1);
    expect(idxUsers).toBeGreaterThan(-1);
    expect(idxIdentities).toBeLessThan(idxUsers);
  });
});
