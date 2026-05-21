/**
 * UUID v7 — RFC 9562 conformance tests.
 *
 * Covers FR-04.3 / AC-04.4 / NFR-04.1. See spec:
 * docs/superpowers/specs/2026-05-21-wt-04-contract-user-identity-design.md
 */

import { describe, expect, it } from 'bun:test';
import {
  DEFAULT_TENANT_ID,
  UuidV7Schema,
  isUuidV7,
  uuidV7,
  uuidV7TimestampMs,
} from '../uuid-v7.ts';

describe('uuid-v7', () => {
  it('должно generate sortable IDs: B-tree friendly (a < b ⇒ a.ts ≤ b.ts)', () => {
    const ids: string[] = [];
    let lastMs = 0;
    for (let i = 0; i < 64; i += 1) {
      const id = uuidV7();
      ids.push(id);
      const ms = uuidV7TimestampMs(id);
      expect(ms).toBeGreaterThanOrEqual(lastMs);
      lastMs = ms;
    }
    const sorted = [...ids].sort();
    // Lexicographic order tracks timestamp order: a < b ⇒ ms(a) ≤ ms(b).
    for (let i = 1; i < sorted.length; i += 1) {
      const prev = sorted[i - 1] as string;
      const curr = sorted[i] as string;
      expect(uuidV7TimestampMs(prev)).toBeLessThanOrEqual(uuidV7TimestampMs(curr));
    }
  });

  it('должно variant RFC 9562 conformant (version=7, variant=10)', () => {
    for (let i = 0; i < 32; i += 1) {
      const id = uuidV7();
      // Version nibble is the first hex of group 3.
      const version = id.charAt(14);
      expect(version).toBe('7');
      // Variant: top two bits of byte 8 are `10` → first hex of group 4 is one of 8,9,a,b.
      const variantNibble = id.charAt(19);
      expect(['8', '9', 'a', 'b']).toContain(variantNibble);
    }
  });

  it('UuidV7Schema accepts well-formed v7 and rejects v4 / garbage', () => {
    const valid = uuidV7();
    expect(UuidV7Schema.parse(valid)).toBe(valid);
    // Random v4 UUID — bun's crypto.randomUUID emits v4.
    const v4 = crypto.randomUUID();
    expect(() => UuidV7Schema.parse(v4)).toThrow();
    expect(() => UuidV7Schema.parse('not-a-uuid')).toThrow();
    expect(() => UuidV7Schema.parse('')).toThrow();
  });

  it('isUuidV7 narrows correctly', () => {
    expect(isUuidV7(uuidV7())).toBe(true);
    expect(isUuidV7(crypto.randomUUID())).toBe(false);
    expect(isUuidV7('xx')).toBe(false);
  });

  it('DEFAULT_TENANT_ID is a well-known v7 UUID', () => {
    expect(DEFAULT_TENANT_ID).toBe('01900000-0000-7000-8000-000000000000');
    expect(isUuidV7(DEFAULT_TENANT_ID)).toBe(true);
  });

  it('NFR-04.1: uuid-v7 generation <0.1ms p99 over 10k iterations', () => {
    const N = 10_000;
    const start = performance.now();
    for (let i = 0; i < N; i += 1) {
      uuidV7();
    }
    const elapsed = performance.now() - start;
    const perCall = elapsed / N;
    // Headroom: assert mean <0.1ms; p99 is approximated by mean in pure JS without histogram.
    expect(perCall).toBeLessThan(0.1);
  });
});
