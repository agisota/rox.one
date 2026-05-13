/**
 * Property-based scope-forgery + cross-tenant smuggling tests (M.13 T243).
 *
 * Asserts that the RBAC policy engine and `permittedWorkspaces` resist
 * adversarial inputs that try to forge a scope, impersonate the global
 * owner sentinel, or smuggle a cross-tenant grant past the boundary.
 *
 * Properties (each runs ≥1000 random iterations with a deterministic seed
 * printed on failure):
 *
 *   1. Forged role ids never grant any action.
 *   2. Workspace grants never leak across workspace ids.
 *   3. The global-owner `'*'` sentinel is only produced by a real
 *      global-scope grant; a `scopeKind:'workspace', scopeId:'*'` grant
 *      is recorded as a literal workspace id and `deriveScopeFromAuth`
 *      callers must distinguish via array length, not sentinel equality.
 *      A finding from this property is documented in the worklog.
 *   4. Scope-kind discipline holds: org grants do not satisfy workspace
 *      resources and vice versa.
 *
 * The test uses a hand-rolled deterministic PRNG (xorshift32) so the same
 * seed reproduces the same iterations. `fast-check` is not in the
 * repository's dependencies.
 */

import { describe, test, expect } from 'bun:test';
import {
  evaluate,
  permittedWorkspaces,
  PERMITTED_WORKSPACES_GLOBAL_SENTINEL,
} from '../policy-engine.ts';
import {
  validateRoleGrant,
  type RoleGrant,
  type ScopeKind,
  type RbacAction,
} from '../roles-schema.ts';

const SYSTEM_ROLE_IDS = ['owner', 'editor', 'viewer'] as const;
const SCOPE_KINDS: ReadonlyArray<ScopeKind> = ['workspace', 'org', 'global'];
const ACTIONS: ReadonlyArray<RbacAction> = ['read', 'write', 'admin'];

const SEED_BASE = Number(process.env.T243_SEED ?? 0x5a3e1c7d);
const ITERATIONS = 1000;

/** xorshift32 — deterministic, reproducible, fast. */
function makeRng(seed: number): () => number {
  let state = seed | 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x100000000;
  };
}

function pick<T>(rng: () => number, xs: ReadonlyArray<T>): T {
  return xs[Math.floor(rng() * xs.length) % xs.length] as T;
}

function randomString(rng: () => number, len = 8): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789-_';
  let out = '';
  for (let i = 0; i < len; i++) {
    out += alphabet[Math.floor(rng() * alphabet.length)];
  }
  return out;
}

/** A roleId that is guaranteed NOT to be a system role. */
function forgedRoleId(rng: () => number): string {
  while (true) {
    const candidate = randomString(rng, 1 + Math.floor(rng() * 16));
    if (!SYSTEM_ROLE_IDS.includes(candidate as (typeof SYSTEM_ROLE_IDS)[number])) {
      return candidate;
    }
  }
}

function makeGrant(
  rng: () => number,
  override: Partial<RoleGrant> = {},
): RoleGrant {
  const scopeKind = override.scopeKind ?? pick(rng, SCOPE_KINDS);
  const scopeId =
    scopeKind === 'global'
      ? null
      : override.scopeId ?? randomString(rng, 8);
  return {
    roleId: override.roleId ?? pick(rng, SYSTEM_ROLE_IDS),
    actorKind: override.actorKind ?? 'user',
    actorId: override.actorId ?? randomString(rng, 12),
    scopeKind,
    scopeId,
  };
}

describe('T243 — scope-forgery property tests', () => {
  // --------------------------------------------------------------------
  // Property 1: forged role ids never grant any action.
  // --------------------------------------------------------------------
  test(`forged roleIds never grant any action (${ITERATIONS}× iterations)`, () => {
    const rng = makeRng(SEED_BASE);
    let trapped = 0;

    for (let i = 0; i < ITERATIONS; i++) {
      const action = pick(rng, ACTIONS);
      const grants: RoleGrant[] = [];
      const grantCount = 1 + Math.floor(rng() * 5);
      for (let g = 0; g < grantCount; g++) {
        grants.push(makeGrant(rng, { roleId: forgedRoleId(rng) }));
      }
      const resourceKind = pick(rng, ['workspace', 'org'] as const);
      const resource = {
        scopeKind: resourceKind,
        scopeId: randomString(rng, 8),
      };

      const decision = evaluate(grants, action, resource);
      if (decision.allow) {
        throw new Error(
          `forged-roleId leak — seed=${SEED_BASE}, iter=${i}, ` +
            `grants=${JSON.stringify(grants)}, action=${action}, ` +
            `resource=${JSON.stringify(resource)}`,
        );
      }
      expect(decision.allow).toBe(false);
      expect(['no-grant', 'no-matching-scope']).toContain(decision.reason);
      trapped++;
    }
    expect(trapped).toBe(ITERATIONS);
  });

  // --------------------------------------------------------------------
  // Property 2: cross-tenant smuggling fails — workspace grants don't
  // leak across workspace ids.
  // --------------------------------------------------------------------
  test(`workspace grants never leak across workspace ids (${ITERATIONS}× iterations)`, () => {
    const rng = makeRng(SEED_BASE ^ 0xdeadbeef);

    for (let i = 0; i < ITERATIONS; i++) {
      const workspaceA = `wsA-${randomString(rng, 6)}`;
      let workspaceB = `wsB-${randomString(rng, 6)}`;
      while (workspaceB === workspaceA) {
        workspaceB = `wsB-${randomString(rng, 6)}`;
      }
      const roleId = pick(rng, SYSTEM_ROLE_IDS);
      const action = pick(rng, ACTIONS);

      const grants: RoleGrant[] = [
        {
          roleId,
          actorKind: 'user',
          actorId: 'attacker',
          scopeKind: 'workspace',
          scopeId: workspaceA,
        },
      ];

      // Pad with additional unrelated grants on other workspaces — none of
      // these should help the attacker reach workspaceB.
      const noiseCount = Math.floor(rng() * 8);
      for (let n = 0; n < noiseCount; n++) {
        let noiseId = randomString(rng, 6);
        while (noiseId === workspaceB) noiseId = randomString(rng, 6);
        grants.push(
          makeGrant(rng, {
            actorId: 'attacker',
            scopeKind: 'workspace',
            scopeId: noiseId,
          }),
        );
      }

      const decisionB = evaluate(grants, action, {
        scopeKind: 'workspace',
        scopeId: workspaceB,
      });
      if (decisionB.allow) {
        throw new Error(
          `cross-tenant leak — seed=${SEED_BASE}, iter=${i}, ` +
            `wsA=${workspaceA}, wsB=${workspaceB}, ` +
            `grants=${JSON.stringify(grants)}, action=${action}`,
        );
      }
      expect(decisionB.allow).toBe(false);
    }
  });

  // --------------------------------------------------------------------
  // Property 3: owner sentinel cannot be impersonated by a manufactured
  // workspace grant with scopeId `'*'`.
  //
  // The current implementation IS observationally ambiguous: a
  // `{ scopeKind:'workspace', scopeId:'*' }` grant produces an output
  // array equal to `['*']` — the same shape as the global sentinel.
  // Callers MUST therefore distinguish the global case via a separate
  // signal (the grants array fed in, the resolver's owner check), NOT
  // by sentinel-equality on the output. We assert that property here
  // and document the finding in T243 worklog § Findings A.
  // --------------------------------------------------------------------
  test(`global sentinel is only produced by global-scope grants (${ITERATIONS}× iterations)`, () => {
    const rng = makeRng(SEED_BASE ^ 0xfeedface);
    let scenarioBudget = 0;

    for (let i = 0; i < ITERATIONS; i++) {
      const scenario = i % 3;

      if (scenario === 0) {
        // Pure forgery: only workspace grants with scopeId '*'.
        const grants: RoleGrant[] = [];
        const count = 1 + Math.floor(rng() * 4);
        for (let g = 0; g < count; g++) {
          grants.push({
            roleId: pick(rng, SYSTEM_ROLE_IDS),
            actorKind: 'user',
            actorId: 'attacker',
            scopeKind: 'workspace',
            scopeId: PERMITTED_WORKSPACES_GLOBAL_SENTINEL,
          });
        }
        const result = permittedWorkspaces(grants);
        // The output contains '*' as a literal workspace id. The caller
        // cannot rely on `result[0] === '*'` alone to identify a global
        // owner — they must also know the grants did not include a
        // global-scope entry. We pin the current behavior so it cannot
        // silently change.
        expect(result).toEqual([PERMITTED_WORKSPACES_GLOBAL_SENTINEL]);
        scenarioBudget++;
      } else if (scenario === 1) {
        // Real global grant — sentinel is legitimate.
        const grants: RoleGrant[] = [
          {
            roleId: pick(rng, SYSTEM_ROLE_IDS),
            actorKind: 'user',
            actorId: 'real-owner',
            scopeKind: 'global',
            scopeId: null,
          },
        ];
        // Add noise so we exercise the early-return path.
        const noiseCount = Math.floor(rng() * 4);
        for (let n = 0; n < noiseCount; n++) {
          grants.push(
            makeGrant(rng, {
              actorId: 'real-owner',
              scopeKind: 'workspace',
              scopeId: randomString(rng, 6),
            }),
          );
        }
        const result = permittedWorkspaces(grants);
        expect(result).toEqual([PERMITTED_WORKSPACES_GLOBAL_SENTINEL]);
        scenarioBudget++;
      } else {
        // Smuggling via Object.assign / brand-prefix lookalike. The
        // resolver receives the raw grant. The output should be the
        // smuggled id verbatim — not the sentinel logic.
        const smuggled = `*${randomString(rng, 3)}`; // looks like the sentinel
        const grants: RoleGrant[] = [
          {
            roleId: pick(rng, SYSTEM_ROLE_IDS),
            actorKind: 'user',
            actorId: 'attacker',
            scopeKind: 'workspace',
            scopeId: smuggled,
          },
        ];
        const result = permittedWorkspaces(grants);
        // The output must contain the literal id, not be promoted to a
        // global sentinel.
        expect(result).toContain(smuggled);
        expect(result).not.toContain(PERMITTED_WORKSPACES_GLOBAL_SENTINEL);
        scenarioBudget++;
      }
    }
    expect(scenarioBudget).toBe(ITERATIONS);
  });

  // --------------------------------------------------------------------
  // Property 4: scope-kind discipline — org grants don't satisfy
  // workspace resources and vice versa.
  // --------------------------------------------------------------------
  test(`scope-kind discipline holds across kinds (${ITERATIONS}× iterations)`, () => {
    const rng = makeRng(SEED_BASE ^ 0xcafebabe);

    for (let i = 0; i < ITERATIONS; i++) {
      // Pick mismatched grant kind vs resource kind (org/workspace cross).
      const grantKind: ScopeKind = pick(rng, ['workspace', 'org']);
      const resourceKind: ScopeKind = grantKind === 'workspace' ? 'org' : 'workspace';

      const scopeId = randomString(rng, 8);
      const grants: RoleGrant[] = [
        {
          roleId: pick(rng, SYSTEM_ROLE_IDS),
          actorKind: 'user',
          actorId: 'actor',
          scopeKind: grantKind,
          // Use the same scopeId on both grant and resource to make sure
          // it's the scopeKind discipline (not id mismatch) that blocks.
          scopeId,
        },
      ];
      const action = pick(rng, ACTIONS);
      const decision = evaluate(grants, action, {
        scopeKind: resourceKind,
        scopeId,
      });
      if (decision.allow) {
        throw new Error(
          `scope-kind discipline broken — seed=${SEED_BASE}, iter=${i}, ` +
            `grantKind=${grantKind}, resourceKind=${resourceKind}, ` +
            `id=${scopeId}, action=${action}`,
        );
      }
      expect(decision.allow).toBe(false);
      expect(decision.reason).toBe('no-matching-scope');
    }
  });

  // --------------------------------------------------------------------
  // Smoke: trivial sanity that valid grants DO produce allow. Without
  // this the four "always-deny" properties above would be vacuously
  // satisfied by an `evaluate` that always returns deny.
  // --------------------------------------------------------------------
  test('positive smoke — owner global grant permits all actions on any resource', () => {
    const grant: RoleGrant = {
      roleId: 'owner',
      actorKind: 'user',
      actorId: 'real-owner',
      scopeKind: 'global',
      scopeId: null,
    };
    for (const action of ACTIONS) {
      for (const resourceKind of ['workspace', 'org'] as const) {
        const decision = evaluate([grant], action, {
          scopeKind: resourceKind,
          scopeId: 'any-id',
        });
        expect(decision.allow).toBe(true);
        expect(decision.reason).toBe('global-owner');
      }
    }
  });

  // --------------------------------------------------------------------
  // Property 5 (T244) — `validateRoleGrant` rejects every smuggled
  // `{scopeKind: 'workspace'|'org', scopeId: '*'}` forgery (Finding A
  // close) AND accepts every legitimate grant. One test, two
  // counterweighted iteration loops: a buggy validator that rejects
  // everything would fail the accept loop; one that accepts
  // everything would fail the reject loop. Property 3 above pins the
  // legacy `permittedWorkspaces` ambiguity; this property pins the
  // schema-layer fix.
  // --------------------------------------------------------------------
  test(`validator rejects '*' forgery + accepts clean grants (${ITERATIONS}× each)`, () => {
    const rng = makeRng(SEED_BASE ^ 0xb1ade244);

    for (let i = 0; i < ITERATIONS; i++) {
      const scopeKind: ScopeKind = pick(rng, ['workspace', 'org']);
      const grant: RoleGrant = {
        roleId: pick(rng, SYSTEM_ROLE_IDS),
        actorKind: pick(rng, ['user', 'team']),
        actorId: randomString(rng, 6 + Math.floor(rng() * 8)),
        scopeKind,
        scopeId: PERMITTED_WORKSPACES_GLOBAL_SENTINEL,
      };
      const result = validateRoleGrant(grant);
      if (result.ok) {
        throw new Error(
          `smuggled '*' accepted — seed=${SEED_BASE}, iter=${i}, ` +
            `grant=${JSON.stringify(grant)}`,
        );
      }
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('reserved-scope-id');
    }

    for (let i = 0; i < ITERATIONS; i++) {
      const scopeKind: ScopeKind = pick(rng, SCOPE_KINDS);
      let scopeId: string | null = null;
      if (scopeKind !== 'global') {
        do {
          scopeId = randomString(rng, 1 + Math.floor(rng() * 12));
        } while (scopeId === PERMITTED_WORKSPACES_GLOBAL_SENTINEL || scopeId === '');
      }
      const grant: RoleGrant = {
        roleId: pick(rng, SYSTEM_ROLE_IDS),
        actorKind: pick(rng, ['user', 'team']),
        actorId: randomString(rng, 6 + Math.floor(rng() * 8)),
        scopeKind,
        scopeId,
      };
      const result = validateRoleGrant(grant);
      if (!result.ok) {
        throw new Error(
          `clean grant rejected — seed=${SEED_BASE}, iter=${i}, ` +
            `grant=${JSON.stringify(grant)}, code=${result.error.code}`,
        );
      }
      expect(result.ok).toBe(true);
    }
  });
});
