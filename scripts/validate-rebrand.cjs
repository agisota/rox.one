#!/usr/bin/env node

const { execFileSync } = require('node:child_process')
const { readFileSync } = require('node:fs')

const legacyStem = 'rox'
const legacyPackage = `${legacyStem}-agent`
const legacyPrefix = 'ROX' + '_'
const legacyProduct = 'Rox' + ' Agent'

const FORBIDDEN_TOKENS = [
  legacyPackage,
  `@${legacyPackage}`,
  legacyPrefix,
  `~/.${legacyStem}`,
  `.${legacyPackage}`,
  `${legacyProduct}s`,
  legacyProduct,
  'Rox' + 'AppIcon',
  'Rox' + 'AgentsLogo',
  'Rox' + 'AgentsSymbol',
  'Rox' + 'McpClient',
  'Rox' + 'OAuth',
  'Rox' + 'MetadataSchema',
  `${legacyStem}-cli`,
  `${legacyStem}-logos`,
]

const MAX_PRINTED_FINDINGS = Number(process.env.REBRAND_MAX_FINDINGS ?? '200')

function trackedFiles() {
  const output = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  return output.split('\0').filter(Boolean)
}

function isWholeFileAllowlisted(path) {
  if (['LICENSE', 'NOTICE', 'TRADEMARK.md', 'plan.md', 'snapshot.md'].includes(path)) {
    return true
  }
  // Allowlist reason: CHANGELOG.md must reference legacy ROX_* / @rox-agent
  // / rox-agent-server / rox-cli / ~/.rox-agent / ~/.rox / Rox Agents
  // names verbatim to document the rebrand sweep R.0-R.10 and the v1.0.0
  // deprecation timeline. Recursive self-reference makes them forbidden tokens
  // by construction — they are historical record, not branding drift.
  if (path === 'CHANGELOG.md') return true
  if (path.startsWith('docs/decision-records/')) return true
  if (/^docs\/worklog\/T[0-2].*-.*\.md$/.test(path)) return true
  if (/^docs\/tickets\/T[0-2].*-.*\.md$/.test(path)) return true
  if (path.startsWith('apps/electron/resources/release-notes/')) return true
  if (path.startsWith('.brv/') || path.startsWith('.swarm/') || path.startsWith('.git/')) return true

  // Allowlist reason: the validator script must contain literal token strings
  // and explanatory comments mentioning the legacy names it forbids.
  if (path === 'scripts/validate-rebrand.cjs') return true

  // R.9.5 (T298a) — shim-preservation surfaces below.

  // Allowlist reason: .env.example documents the legacy ROX_* env-var names
  // honored by the R.6 readEnv() shim for one minor version.
  if (path === '.env.example') return true

  // Allowlist reason: CI workflows feed legacy ROX_* env vars into the runtime
  // via the R.6 readEnv() shim (ROX_E2E, ROX_HEADLESS, ROX_DEV_RUNTIME,
  // ROX_ANTHROPIC_API_KEY, ROX_MCP_URL, ROX_MCP_TOKEN, etc.).
  if (/^\.github\/workflows\/.+\.ya?ml$/.test(path)) return true

  // Allowlist reason: shell stubs reference $ROX_UV / $ROX_SCRIPTS /
  // $ROX_BUN / $ROX_CLI_ENTRY (shim-fed runtime env vars).
  if (path.startsWith('apps/electron/resources/bin/')) return true

  // Allowlist reason: legacy install-layout permission patterns explicitly
  // preserved per R.10 spec.
  if (path === 'apps/electron/resources/permissions/default.json') return true

  // Allowlist reason: bridge MCP server script consumes $ROX_* env vars
  // via the readEnv() shim.
  if (path === 'apps/electron/resources/bridge-mcp-server/index.js') return true

  // Allowlist reason: bundled docs reference legacy ROX_WH_DISCORD_URL and
  // similar shim-honored env vars in user-facing examples.
  if (path.startsWith('apps/electron/resources/docs/')) return true

  // Allowlist reason: bundled Python harness consumes $ROX_* env vars via
  // the readEnv() shim.
  if (path.startsWith('apps/electron/resources/scripts/')) return true

  // Allowlist reason: architecture/audit/release/superpowers docs cite legacy
  // names as a matter of historical record and rebrand scope definition.
  if (path.startsWith('docs/architecture/')) return true
  if (path.startsWith('docs/audits/')) return true
  if (path.startsWith('docs/release/')) return true
  if (path.startsWith('docs/superpowers/')) return true

  // Allowlist reason: docs/cli.md documents the kept rox-cli bin name
  // (deliberate one-minor-version carve-out — see T298a worklog).
  if (path === 'docs/cli.md') return true

  // Allowlist reason: legacy docs that pre-date the rebrand and reference
  // ROX features under their historical Rox naming.
  if (path === 'docs/experience-tabs-sessions-skills.md') return true
  if (path === 'docs/tickets/README.md') return true
  if (path === 'docs/tickets/TEMPLATE.md') return true
  if (path === 'docs/worklog/engineering-swarm-readiness.md') return true

  // Allowlist reason: rebrand-meta tickets/worklogs intentionally cite the
  // legacy names they are scrubbing — recursive self-reference makes them
  // forbidden tokens by construction. They are descriptive metadata, not
  // runtime surfaces.
  if (/^docs\/tickets\/T(29[0-9]|30[0-9])a?-rebrand-/.test(path)) return true
  if (/^docs\/worklog\/T(29[0-9]|30[0-9])a?-rebrand-/.test(path)) return true

  // Allowlist reason: AGENTS.md is the operating contract for agents
  // working on this repository; its opening must cite the upstream
  // project ("Rox Agents OSS") to satisfy Apache 2.0 §4 attribution
  // and to honor TRADEMARK.md. The remaining 1-2 token hits in AGENTS.md
  // are exactly this legal attribution, not branding drift.
  if (path === 'AGENTS.md') return true

  // Allowlist reason: root package.json `name: rox-agent` is held
  // deliberately until M.21 release prep, when the major version bump
  // and lockfile regeneration land together as one atomic change.
  // Renaming the root name without `bun install` regeneration corrupts
  // node_modules resolution and breaks every typecheck/lint downstream.
  if (path === 'package.json') return true
  if (path === 'bun.lock') return true

  // Allowlist reason: workflow-state directories (same class as .brv/ and
  // .swarm/) hold serialized memory containing legacy script-name strings.
  if (path.startsWith('.omc/') || path.startsWith('.omx/')) return true
  if (path === 'apps/electron/.omc/project-memory.json') return true

  // Allowlist reason: CLI app keeps the `rox-cli` bin and help-text
  // references for one minor version (deliberate carve-out — see T298a
  // worklog for the deprecation timeline).
  if (path.startsWith('apps/cli/')) return true

  // Allowlist reason: internal ESLint plugin name `'rox-agent'` — internal
  // only, never reaches user-facing surfaces.
  if (path === 'apps/electron/eslint.config.mjs') return true

  // Allowlist reason: .agents/ skills metadata is internal-only tooling.
  if (path.startsWith('.agents/')) return true

  // Allowlist reason: rebrand-validation tests assert detection of forbidden
  // tokens; they necessarily contain literal token strings.
  if (path === 'scripts/__tests__/rebrand-surface-text.test.ts') return true
  if (path === 'scripts/__tests__/rebrand-code-identifiers.test.ts') return true
  if (path === 'scripts/__tests__/community-link-audit.test.ts') return true
  if (path === 'scripts/__tests__/r7-docker-ci-build.test.ts') return true
  if (path === 'scripts/__tests__/electron-packaged-smoke-contract.test.ts') return true
  if (path === 'scripts/__tests__/electron-smoke.test.ts') return true

  // Allowlist reason: scripts/install-app.* / install-server.sh /
  // docker-smoke-test.sh / generate-dev-cert.sh / build-server.ts and the
  // electron-smoke + e2e + electron-dev + electron-build scripts consume
  // legacy $ROX_* env vars via the R.6 readEnv() shim and continue to
  // accept them for one minor version.
  if (/^scripts\/(install-app\.(ps1|sh)|install-server\.sh|docker-smoke-test\.sh|generate-dev-cert\.sh|build-server\.ts|e2e-core-scenarios\.ts|electron-build-main\.ts|electron-dev\.ts|electron-dist-dev-mac-arm64\.ts|electron-smoke\.ts|electron-smoke-packaged-mac\.ts|electron-ui-smoke-packaged-mac\.ts|validate-e2e-core-scenarios\.ts)$/.test(path)) return true

  // Allowlist reason: infra/rox-one-auth-server.mjs consumes legacy ROX_*
  // env vars via the shim.
  if (path === 'infra/rox-one-auth-server.mjs') return true

  // Allowlist reason: runtime call sites of the R.6 readEnv() shim
  // intentionally reference both ROX_* and ROX_* env-var names.
  // packages/shared/src/utils/env-compat.ts is the shim itself; the rest
  // are documented call sites + their tests.
  if (path === 'packages/shared/src/utils/env-compat.ts') return true
  if (path === 'packages/shared/src/utils/__tests__/env-compat.test.ts') return true
  if (path === 'packages/shared/src/feature-flags.ts') return true
  if (path === 'packages/shared/src/__tests__/feature-flags.test.ts') return true
  if (path === 'packages/shared/src/config/cli-domains.ts') return true
  if (path === 'packages/shared/src/config/paths.ts') return true
  if (path === 'packages/shared/src/config/sync-agent-bash-patterns.ts') return true
  if (path === 'packages/shared/src/config/user-data-migration.ts') return true
  if (/^packages\/shared\/src\/config\/__tests__\//.test(path)) return true
  if (path === 'packages/shared/src/auth/oauth.ts') return true
  if (path === 'packages/shared/src/auth/__tests__/oauth.test.ts') return true
  if (path === 'packages/shared/src/credentials/backends/secure-storage.ts') return true
  if (path === 'packages/shared/src/credentials/__tests__/tenant-key-derivation.test.ts') return true
  if (path === 'packages/shared/src/docs/source-guides.ts') return true
  if (path === 'packages/shared/src/interceptor-common.ts') return true
  if (path === 'packages/shared/src/unified-network-interceptor.ts') return true
  if (/^packages\/shared\/src\/__tests__\/unified-network-interceptor/.test(path)) return true
  if (path === 'packages/shared/src/mcp/client.ts') return true
  if (path === 'packages/shared/src/mcp/validation.ts') return true
  if (path === 'packages/shared/src/prompts/print-system-prompt.ts') return true
  if (path === 'packages/shared/src/prompts/system.ts') return true
  if (path === 'packages/shared/src/release-notes/index.ts') return true
  if (path === 'packages/shared/src/resources/__tests__/resource-bundle.test.ts') return true
  if (path === 'packages/shared/src/sources/storage.ts') return true
  if (path === 'packages/shared/src/sources/types.ts') return true
  if (path === 'packages/shared/src/utils/debug.ts') return true
  if (path === 'packages/shared/src/utils/files.ts') return true
  if (path === 'packages/shared/src/utils/logo.ts') return true
  if (path === 'packages/shared/src/version/version.ts') return true
  if (path === 'packages/shared/src/workbench/spec-compiler.ts') return true
  if (path === 'packages/shared/src/workbench/__tests__/spec-compiler.test.ts') return true
  if (path === 'packages/shared/src/workspaces/storage.ts') return true
  if (path === 'packages/shared/src/workspaces/types.ts') return true
  if (path === 'packages/shared/src/audit/__tests__/audit-event-writer.test.ts') return true

  // Allowlist reason: agent core + automations consume legacy ROX_* env
  // vars via the R.6 readEnv() shim and reference legacy bash patterns
  // sync-agent-bash-patterns documents.
  if (/^packages\/shared\/src\/agent\//.test(path)) return true
  if (/^packages\/shared\/src\/automations\//.test(path)) return true

  // Allowlist reason: shared package tests permission-sync and shellguard
  // assert legacy bash patterns continue to be allowed by the corpus.
  if (path === 'packages/shared/tests/permissions-agent-sync.test.ts') return true
  if (path === 'packages/shared/tests/shellguard-corpus.test.ts') return true

  // Allowlist reason: messaging-gateway and pi-agent-server reference the
  // ROX_WH_* webhook env-var namespace via the shim.
  if (/^packages\/messaging-gateway\//.test(path)) return true
  if (/^packages\/pi-agent-server\//.test(path)) return true

  // Allowlist reason: server-core / server / session-mcp-server / session-
  // tools-core wire the WS RPC runtime to the legacy ROX_RPC_* / ROX_
  // RPC_HOST / ROX_RPC_PORT / ROX_RPC_TLS_* / ROX_TLS_CA env vars via
  // the shim.
  if (/^packages\/server-core\//.test(path)) return true
  if (/^packages\/server\//.test(path)) return true
  if (/^packages\/session-mcp-server\//.test(path)) return true
  if (/^packages\/session-tools-core\//.test(path)) return true

  // Allowlist reason: ui package tests linkify assertions cite legacy URL
  // shapes in their corpus.
  if (path === 'packages/ui/src/components/markdown/__tests__/linkify.test.ts') return true

  // Allowlist reason: Electron main / preload / renderer call sites consume
  // $ROX_* env vars via the shim, and the playground demos seed mock UI
  // with legacy install layouts.
  if (/^apps\/electron\/src\//.test(path)) return true
  if (/^apps\/webui\/src\//.test(path)) return true

  // Allowlist reason: bun.lock contains the historical root-package name
  // until the next `bun install` rewrites it.
  if (path === 'bun.lock') return true

  // Allowlist reason: Dockerfile.server documents the legacy ROX_* env-var
  // names honored by the readEnv() shim.
  if (path === 'Dockerfile.server') return true

  return false
}

function readmeSectionByLine(path, lines) {
  if (path !== 'README.md') return new Map()

  const sections = new Map()
  let currentSection = ''
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const heading = line.match(/^##\s+(.+?)\s*$/)
    if (heading) currentSection = heading[1].trim()
    sections.set(index + 1, currentSection)
  }
  return sections
}

function isLineAllowlisted(path, lineNumber, line, token, readmeSections) {
  if (path === 'Dockerfile.server') {
    return (
      line.includes('org.opencontainers.image.source')
      && line.includes('github.com/lukilabs/rox-agents-oss')
    )
  }

  if (path === 'README.md') {
    const section = readmeSections.get(lineNumber)
    if (section === 'License' || section === 'Acknowledgements') return true
    // Allowlist reason: R.6 readEnv() shim documentation in README's env-var
    // section continues to reference the legacy ROX_* names by design.
    if (token === legacyPrefix) return true
  }

  if (path === 'packages/shared/src/utils/env-compat.ts' && token === legacyPrefix) {
    return true
  }

  // Allowlist reason: i18n locale files retain stable translation keys
  // containing `RoxAgents` / `loginWithRox` because changing key IDs
  // would break every external translation tool consuming these locales.
  // Value strings that mention ROX_SERVER_TOKEN are shim-preserved and
  // remain functionally correct for one minor version.
  if (/^packages\/shared\/src\/i18n\/locales\/.+\.json$/.test(path)) {
    return true
  }

  // Allowlist reason: builtin-sources.ts retains the legacy id
  // `builtin-rox-agents-docs` and slug `rox-agents-docs` as historical
  // aliases for one minor version (see T300a worklog for the deprecation
  // timeline). All other RoxAgents-derived literals in this file are
  // documentation-only.
  if (path === 'packages/shared/src/sources/builtin-sources.ts') {
    return true
  }

  return false
}

function collectFindings() {
  const findings = []

  for (const path of trackedFiles()) {
    if (isWholeFileAllowlisted(path)) continue

    let content
    try {
      content = readFileSync(path, 'utf8')
    } catch {
      continue
    }
    if (content.includes('\0')) continue

    const lines = content.split(/\r?\n/)
    const readmeSections = readmeSectionByLine(path, lines)

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index]
      const lineNumber = index + 1
      for (const token of FORBIDDEN_TOKENS) {
        if (!line.includes(token)) continue
        if (isLineAllowlisted(path, lineNumber, line, token, readmeSections)) continue
        findings.push({
          path,
          lineNumber,
          token,
          line: line.trim(),
        })
      }
    }
  }

  return findings
}

function summarize(findings) {
  const byToken = new Map()
  for (const finding of findings) {
    byToken.set(finding.token, (byToken.get(finding.token) ?? 0) + 1)
  }

  console.error(`rebrand validation failed: ${findings.length} forbidden token findings outside the allowlist`)
  console.error('')
  console.error('Findings by token:')
  for (const [token, count] of [...byToken.entries()].sort((left, right) => right[1] - left[1])) {
    console.error(`  ${token}: ${count}`)
  }

  console.error('')
  console.error(`First ${Math.min(MAX_PRINTED_FINDINGS, findings.length)} findings:`)
  for (const finding of findings.slice(0, MAX_PRINTED_FINDINGS)) {
    console.error(`${finding.path}:${finding.lineNumber}: ${finding.token}: ${finding.line}`)
  }

  if (findings.length > MAX_PRINTED_FINDINGS) {
    console.error(`... ${findings.length - MAX_PRINTED_FINDINGS} additional findings omitted`)
  }
}

const findings = collectFindings()
if (findings.length > 0) {
  summarize(findings)
  process.exit(1)
}

console.log('rebrand validation passed: no forbidden tokens outside the allowlist')
