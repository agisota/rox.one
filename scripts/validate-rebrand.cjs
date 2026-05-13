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
  if (path.startsWith('docs/decision-records/')) return true
  if (/^docs\/worklog\/T[0-2].*-.*\.md$/.test(path)) return true
  if (/^docs\/tickets\/T[0-2].*-.*\.md$/.test(path)) return true
  if (path.startsWith('apps/electron/resources/release-notes/')) return true
  if (path.startsWith('.brv/') || path.startsWith('.swarm/') || path.startsWith('.git/')) return true
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
    return section === 'License' || section === 'Acknowledgements'
  }

  if (path === 'packages/shared/src/utils/env-compat.ts' && token === legacyPrefix) {
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
