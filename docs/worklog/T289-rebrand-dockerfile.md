# T289 - Rebrand Dockerfile and server packaging surfaces

Status: DONE
Phase: R.7
Ticket: docs/tickets/T289-rebrand-dockerfile.md

## 1. Task summary

Rebrand Dockerfile, Docker smoke, and server install examples from legacy
`rox-agent` / `roxagents` names to ROX.ONE names.

## 2. Repo context discovered

`Dockerfile.server` still contains the old example tag, container user/group,
home directory, and dead package-copy references for removed `packages/rox-*`
directories. Supporting scripts still show `ROX_*` examples.

## 3. Files inspected

- `Dockerfile.server`
- `package.json` (workspace package list)
- `packages/` (directory listing — confirmed `audit` and `test-fixtures`
  exist; `rox-agents-commands` and `rox-cli` do NOT exist)
- `scripts/__tests__/r7-docker-ci-build.test.ts`

## 4. Tests added first

Added `scripts/__tests__/r7-docker-ci-build.test.ts` covering seven
assertions for Phase R.7:

1. Dockerfile.server header does not contain `-t rox-agent-server` and
   does contain `-t rox-one-server`.
2. Dockerfile.server creates `roxone` system user/group with
   `/home/roxone` HOME (no `roxagents` residue).
3. Dockerfile.server preserves the upstream attribution label
   `org.opencontainers.image.source="https://github.com/lukilabs/rox-agents-oss"`.
4. No `.github/workflows/*.yml` job/step `name:` value contains
   `Rox` or `rox-agent`.
5. No `.github/workflows/*.yml` artifact uses a `rox-agent-*` prefix.
6. `package.json` `electron:dev:logs` references `@rox-one/electron`
   and not `@rox-agent/electron`.
7. `apps/electron/electron-builder.yml` uses `productName: ROX.ONE`
   and a rox-namespaced reverse-DNS `appId`.

## 5. Expected failing test output

Initial run reported `5 pass / 2 fail / 12 expect() calls`. The two
failures were both Dockerfile.server assertions — header tag + system
user/group. The other five assertions were already green because R.5
and the earlier R.6 surface sweep had already migrated CI job names,
the electron-builder appId/productName, and `package.json` line 78.

```
(fail) R.7 Docker / CI / build rebrand > Dockerfile.server header does not advertise the legacy rox-agent-server image tag
expect(received).not.toContain(expected) — "-t rox-agent-server"

(fail) R.7 Docker / CI / build rebrand > Dockerfile.server creates the roxone system user/group instead of roxagents
expect(received).not.toMatch(expected) — /\broxagents\b/
```

## 6. Implementation changes

`Dockerfile.server`:

- Header comment: `docker buildx build ... -t rox-agent-server .` →
  `... -t rox-one-server .`.
- Header comment HOME examples: `/home/roxagents` → `/home/roxone`.
- Header comment image-tag examples: `rox-agent-server` →
  `rox-one-server`.
- Header comment volume mount: `-v ~/.rox:/home/roxagents/.rox` →
  `-v ~/.rox:/home/roxone/.rox`.
- System user/group: `groupadd -r roxagents && useradd -r -g
  roxagents -m -d /home/roxagents -s /bin/bash roxagents` →
  `groupadd -r roxone && useradd -r -g roxone -m -d /home/roxone -s
  /bin/bash roxone`.
- Pre-create directory: `mkdir -p /home/roxagents/.rox` → `mkdir -p
  /home/roxone/.rox`.
- chmod target: `chmod -R 777 /home/roxagents` → `chmod -R 777
  /home/roxone`.
- Final `USER roxagents` → `USER roxone`.
- COPY block: replaced the two dead `packages/rox-agents-commands` and
  `packages/rox-cli` manifest copies (those workspace packages no
  longer exist after R.5) with the real `packages/audit` and
  `packages/test-fixtures` copies that were already in the workspace
  but missing from the dependency-cache layer. Without this, a fresh
  `docker buildx build -f Dockerfile.server` would fail at the COPY
  step.

Legal-preserve assertion: the `org.opencontainers.image.source` LABEL
that points at `https://github.com/lukilabs/rox-agents-oss` is left
byte-identical. Apache 2.0 §4 attribution remains intact.

## 7. Validation commands run

- `bun test scripts/__tests__/r7-docker-ci-build.test.ts` (R.7 gate)
- `bun run validate:rebrand` (forbidden-token gate — known R.8+ findings
  remain elsewhere; the Dockerfile.server bucket no longer contributes
  new findings beyond the legal-preserve allowlist match)
- `bun run typecheck`
- `bun run lint` (limited — see remaining risks)
- `bun run validate:roadmap`
- `git diff --check`

## 8. Passing test output summary

`scripts/__tests__/r7-docker-ci-build.test.ts`:

```
7 pass
0 fail
17 expect() calls
Ran 7 tests across 1 file.
```

## 9. Build output summary

No `bun run build` / `docker buildx build` was triggered for this
docs/config phase per the operator's R.7 instructions. The Dockerfile
edits do not change runtime source.

## 10. Remaining risks

- A future R.10 closeout will demand a real `docker buildx build` smoke
  run; T289 cannot prove that here because the worktree has no Docker
  daemon configured. The COPY-block fix at least removes the
  previously-broken paths so the build is no longer un-runnable for
  trivial reasons.
- `.env.example` still contains non-canonical-16 `ROX_*` names
  (`ROX_MCP_URL`, `ROX_DATABASE_URL`, `ROX_AUTH_JWT_SECRET`, etc.).
  Those are outside the R.6 sixteen-var sweep and outside the operator's
  explicit R.7 scope; they are queued for the R.8+ application-config
  rebrand phase. Leaving them untouched here per scope discipline.

## 11. Acceptance criteria matrix

- [x] R.7 Dockerfile test asserts green.
- [x] Upstream attribution label preserved byte-for-byte.
- [x] No remaining `roxagents` system user/group references.
- [x] No remaining `-t rox-agent-server` build instruction.
- [x] COPY block contains only real workspace package paths.
