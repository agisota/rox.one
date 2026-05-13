import { describe, it, expect } from 'bun:test';
import { BudgetGuard, BudgetExceededError } from '../budget-guard.ts';

describe('BudgetGuard', () => {
  it('accepts consumption within budget and reports remaining', () => {
    const g = new BudgetGuard({ budgetPerKey: 100 });
    const r = g.consume('user-1', 30);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.remaining).toBe(70);
    }
    expect(g.usage('user-1')).toBe(30);
    expect(g.remaining('user-1')).toBe(70);
  });

  it('accumulates usage across multiple consumes for the same key', () => {
    const g = new BudgetGuard({ budgetPerKey: 100 });
    g.consume('user-1', 30);
    g.consume('user-1', 40);
    const r = g.consume('user-1', 20);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.remaining).toBe(10);
    expect(g.usage('user-1')).toBe(90);
  });

  it('rejects when consume would exceed budget and leaves state unchanged', () => {
    const g = new BudgetGuard({ budgetPerKey: 100 });
    g.consume('user-1', 80);
    const r = g.consume('user-1', 30);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toBeInstanceOf(BudgetExceededError);
      expect(r.error.reason).toBe('exceeded');
      expect(r.error.budget).toBe(100);
      expect(r.error.used).toBe(80);
      expect(r.error.requested).toBe(30);
      expect(r.error.key).toBe('user-1');
    }
    // No mutation on rejection
    expect(g.usage('user-1')).toBe(80);
  });

  it('allows consume that exactly equals remaining budget', () => {
    const g = new BudgetGuard({ budgetPerKey: 50 });
    g.consume('u', 30);
    const r = g.consume('u', 20);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.remaining).toBe(0);
    expect(g.remaining('u')).toBe(0);
  });

  it('rejects consume that exceeds remaining by epsilon', () => {
    const g = new BudgetGuard({ budgetPerKey: 50 });
    g.consume('u', 30);
    const r = g.consume('u', 20.0001);
    expect(r.ok).toBe(false);
  });

  it('isolates usage between keys', () => {
    const g = new BudgetGuard({ budgetPerKey: 10 });
    g.consume('user-a', 7);
    g.consume('user-b', 9);
    expect(g.usage('user-a')).toBe(7);
    expect(g.usage('user-b')).toBe(9);
    expect(g.consume('user-a', 4).ok).toBe(false);
    expect(g.consume('user-b', 1).ok).toBe(true);
    expect(g.usage('user-b')).toBe(10);
  });

  it('reset(key) clears only that key', () => {
    const g = new BudgetGuard({ budgetPerKey: 10 });
    g.consume('a', 8);
    g.consume('b', 8);
    g.reset('a');
    expect(g.usage('a')).toBe(0);
    expect(g.usage('b')).toBe(8);
    expect(g.consume('a', 10).ok).toBe(true);
  });

  it('reset() with no arg clears all keys', () => {
    const g = new BudgetGuard({ budgetPerKey: 10 });
    g.consume('a', 5);
    g.consume('b', 5);
    expect(g.keyCount()).toBe(2);
    g.reset();
    expect(g.keyCount()).toBe(0);
    expect(g.usage('a')).toBe(0);
    expect(g.usage('b')).toBe(0);
  });

  it('rejects negative or non-finite amounts as invalid-amount', () => {
    const g = new BudgetGuard({ budgetPerKey: 100 });
    const r1 = g.consume('u', -1);
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.error.reason).toBe('invalid-amount');

    const r2 = g.consume('u', Number.NaN);
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.error.reason).toBe('invalid-amount');

    const r3 = g.consume('u', Number.POSITIVE_INFINITY);
    expect(r3.ok).toBe(false);
    if (!r3.ok) expect(r3.error.reason).toBe('invalid-amount');

    // State must not have moved
    expect(g.usage('u')).toBe(0);
  });

  it('allows zero-amount consume without mutating usage', () => {
    const g = new BudgetGuard({ budgetPerKey: 10 });
    g.consume('u', 5);
    const r = g.consume('u', 0);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.remaining).toBe(5);
    expect(g.usage('u')).toBe(5);
  });

  it('usage() / remaining() default to 0 / budget for unseen keys', () => {
    const g = new BudgetGuard({ budgetPerKey: 42 });
    expect(g.usage('never-seen')).toBe(0);
    expect(g.remaining('never-seen')).toBe(42);
    expect(g.keyCount()).toBe(0);
  });

  it('budgetPerKey=0 rejects any positive spend immediately', () => {
    const g = new BudgetGuard({ budgetPerKey: 0 });
    const r = g.consume('u', 0.1);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.reason).toBe('exceeded');
    expect(g.usage('u')).toBe(0);
  });

  it('throws on invalid budgetPerKey construction', () => {
    expect(() => new BudgetGuard({ budgetPerKey: -1 })).toThrow(RangeError);
    expect(() => new BudgetGuard({ budgetPerKey: Number.NaN })).toThrow(RangeError);
    expect(() => new BudgetGuard({ budgetPerKey: Number.POSITIVE_INFINITY })).toThrow(RangeError);
  });

  it('BudgetExceededError carries structured fields and a useful message', () => {
    const g = new BudgetGuard({ budgetPerKey: 10 });
    g.consume('u', 9);
    const r = g.consume('u', 5);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.name).toBe('BudgetExceededError');
      expect(r.error.message).toContain('budget 10');
      expect(r.error.message).toContain('used=9');
      expect(r.error.message).toContain('requested=5');
      expect(r.error.message).toContain('u');
    }
  });

  it('keyCount reflects distinct keys with non-zero usage', () => {
    const g = new BudgetGuard({ budgetPerKey: 100 });
    g.consume('a', 1);
    g.consume('b', 1);
    g.consume('c', 1);
    expect(g.keyCount()).toBe(3);
    g.reset('b');
    expect(g.keyCount()).toBe(2);
  });

  it('getBudget() returns the configured budget', () => {
    const g = new BudgetGuard({ budgetPerKey: 250 });
    expect(g.getBudget()).toBe(250);
  });

  it('typed key generic narrows acceptable keys', () => {
    type Key = 'tenant-a' | 'tenant-b';
    const g = new BudgetGuard<Key>({ budgetPerKey: 5 });
    expect(g.consume('tenant-a', 3).ok).toBe(true);
    expect(g.consume('tenant-b', 5).ok).toBe(true);
    expect(g.usage('tenant-a')).toBe(3);
    expect(g.usage('tenant-b')).toBe(5);
  });

  it('combined with rate-limit pattern: budget exhaustion is permanent until reset', () => {
    const g = new BudgetGuard({ budgetPerKey: 3 });
    expect(g.consume('u', 1).ok).toBe(true);
    expect(g.consume('u', 1).ok).toBe(true);
    expect(g.consume('u', 1).ok).toBe(true);
    // No automatic refill; further spends always rejected
    for (let i = 0; i < 5; i++) {
      const r = g.consume('u', 0.5);
      expect(r.ok).toBe(false);
    }
    g.reset('u');
    expect(g.consume('u', 3).ok).toBe(true);
  });
});
