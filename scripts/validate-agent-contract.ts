import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.env.AGENT_CONTRACT_ROOT ?? process.cwd()

const requiredSkills = [
  'repo-cartographer',
  'tdd-loop',
  'ui-screen-builder',
  'agent-workflow-architect',
  'automation-designer',
  'cloud-sync-architect',
  'storage-quota-architect',
  'security-rbac-reviewer',
  'release-validator',
  'mac-arm-builder',
  'ralph-loop-controller',
]

const requiredDocs = [
  'AGENTS.md',
  'docs/tickets/README.md',
  'docs/tickets/TEMPLATE.md',
  'docs/worklog/README.md',
  'docs/validation/README.md',
  'docs/validation/baseline-commands.md',
  'docs/worklog/T000-bootstrap-agent-os.md',
]

const requiredAgentHeadings = [
  'Absolute Rules',
  'Required Worklog Format',
  'TDD Loop',
  'Subagent Usage',
  'Definition of Done',
]

function resolvePath(path: string): string {
  return join(root, path)
}

function fail(message: string): never {
  console.error(`[agent-contract] ${message}`)
  process.exit(1)
}

function assertFile(path: string): string {
  const absolutePath = resolvePath(path)
  if (!existsSync(absolutePath)) fail(`missing required file: ${path}`)
  return readFileSync(absolutePath, 'utf8')
}

for (const path of requiredDocs) {
  assertFile(path)
}

const agentContract = assertFile('AGENTS.md')
for (const heading of requiredAgentHeadings) {
  if (!agentContract.includes(heading)) fail(`AGENTS.md missing section: ${heading}`)
}

for (const skill of requiredSkills) {
  const path = join('.agents', 'skills', skill, 'SKILL.md')
  const body = assertFile(path)
  if (!body.startsWith('---')) fail(`${path} missing frontmatter`)
  if (!new RegExp(`^name:\\s*${skill}$`, 'm').test(body)) fail(`${path} missing matching name frontmatter`)
  if (!/^description:\s*\S.+$/m.test(body)) fail(`${path} missing description frontmatter`)
}

const ticketFiles = readdirSync(resolvePath('docs/tickets')).filter((name) => /^T\d{3}-.+\.md$/.test(name))
if (ticketFiles.length < 41) fail(`expected at least 41 ticket files, found ${ticketFiles.length}`)

console.log(`[agent-contract] ok: ${requiredSkills.length} skills, ${ticketFiles.length} tickets, ${requiredDocs.length} required docs`)
