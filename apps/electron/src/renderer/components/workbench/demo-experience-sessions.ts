import { createExperienceTruthState, type ExperienceTruthState } from '@rox-agent/shared/workbench'
import type { WorkbenchScreen } from '../../../shared/types'

const NOW = '2026-05-08T00:00:00.000Z'

export const EXPERIENCE_SCREEN_LABELS: Record<WorkbenchScreen, string> = {
  'deep-missions': 'Долгие миссии',
  'arena-builder': 'Арена агентов',
  'mission-control': 'Центр миссий',
  progression: 'Прогресс',
  'quest-map': 'Карта квестов',
  'agent-forge': 'Кузница агентов',
}

export const EXPERIENCE_SCREEN_PRODUCT_ROLES: Record<WorkbenchScreen, string> = {
  'deep-missions': 'Собирает большой запрос в автономную миссию: цель, бюджет, длительность, checkpoints, gates и допустимый риск.',
  'arena-builder': 'Запускает несколько агентов/скилл-паков против одной задачи и сравнивает качество, стоимость, риск и доказательства.',
  'mission-control': 'Операционный пульт живой миссии: статусы, approvals, чекпоинты, runtime events, evidence и стоп-кнопки.',
  progression: 'Переводит проверенную работу в VDI, XP, trust, readiness и историю улучшений пользователя/команды.',
  'quest-map': 'Показывает долгую траекторию навыков как unlockable quests: что открыто, что заблокировано, какие evidence нужны.',
  'agent-forge': 'Упаковывает сессии, промпты и skills в приватные/командные agent packages с permission profile, trust score и risk gates.',
}

type DemoSpec = {
  screen: WorkbenchScreen
  id: string
  title: string
  objective: string
  mode: 'deep_run' | 'deep_reasoning_lab' | 'agenda_carnage' | 'swarm_arena' | 'round_table' | 'autoresearch_loop' | 'proactive_watchtower'
  layer: 'command' | 'game' | 'arena'
  status: 'draft' | 'queued' | 'running' | 'waiting_for_approval' | 'paused' | 'completed' | 'failed' | 'cancelled'
  vdi: number
  quality: number
  readiness: number
  risk: number
  agent: string
  packageType: 'persona' | 'skill' | 'skill_pack' | 'swarm_pack' | 'review_pack'
  questLane: 'formulate' | 'specify' | 'execute' | 'verify' | 'marketplace' | 'team' | 'arena'
  reward: string
}

export type DemoExperienceActionId = 'configure' | 'run' | 'expectations' | 'evidence' | 'reset'

export type DemoExperienceAction = {
  id: DemoExperienceActionId
  label: string
  result: string
}

const QUEST_ID_BY_LANE: Record<DemoSpec['questLane'], string> = {
  formulate: 'quest-frame-raw-prompt',
  specify: 'quest-build-executable-spec',
  execute: 'quest-launch-first-deep-mission',
  verify: 'quest-run-review-gate',
  marketplace: 'quest-install-trusted-agent-package',
  team: 'quest-fork-package-team-registry',
  arena: 'quest-launch-swarm-arena',
}

const MCP_PRESETS_BY_SCREEN: Record<WorkbenchScreen, string[]> = {
  'deep-missions': ['exa', 'byterover', 'playwright', 'github'],
  'arena-builder': ['exa', 'playwright', 'github', 'firecrawl'],
  'mission-control': ['github', 'playwright', 'byterover', 'zai-mcp-server'],
  progression: ['byterover', 'exa', 'github'],
  'quest-map': ['exa', 'firecrawl', 'byterover'],
  'agent-forge': ['github', 'byterover', 'playwright', 'zai-mcp-server'],
}

const STATUS_LABELS: Record<DemoSpec['status'], string> = {
  draft: 'черновик',
  queued: 'в очереди',
  running: 'в работе',
  waiting_for_approval: 'ждет согласования',
  paused: 'пауза',
  completed: 'завершено',
  failed: 'ошибка',
  cancelled: 'отменено',
}

const DEMO_SPECS: DemoSpec[] = [
  // Долгие миссии — long-running autonomous work from real operator patterns.
  { screen: 'deep-missions', id: 'deep-rox-production-rc', title: 'ROX.ONE Production RC Hardening', objective: 'Fix Electron naming, package ROX.ONE.app, smoke-test desktop flows, and collect UI evidence.', mode: 'deep_run', layer: 'command', status: 'running', vdi: 92, quality: 88, readiness: 85, risk: 10, agent: 'Desktop Release Captain', packageType: 'persona', questLane: 'execute', reward: 'desktop-release-trust' },
  { screen: 'deep-missions', id: 'deep-hermes-gateway-recovery', title: 'Hermes Gateway Recovery Loop', objective: 'Restore multi-gateway Hermes health, isolate boston/default drift, and validate Telegram lane routing.', mode: 'proactive_watchtower', layer: 'command', status: 'waiting_for_approval', vdi: 87, quality: 83, readiness: 79, risk: 14, agent: 'Hermes Ops Watchtower', packageType: 'skill_pack', questLane: 'verify', reward: 'gateway-resilience-xp' },
  { screen: 'deep-missions', id: 'deep-obsidian-vault-index', title: 'Obsidian Vault Knowledge Index', objective: 'Turn vault-v2 sessions, notes, PDFs, and images into searchable sanitized product memory.', mode: 'autoresearch_loop', layer: 'game', status: 'queued', vdi: 80, quality: 78, readiness: 73, risk: 18, agent: 'Vault Cartographer', packageType: 'skill', questLane: 'formulate', reward: 'knowledge-map-unlock' },
  { screen: 'deep-missions', id: 'deep-cloudflare-zone-audit', title: 'Cloudflare Zone Audit Sprint', objective: 'Audit ROX/PZD/YOLO zones for DNS, SSL, workers, and stale risky records with rollback notes.', mode: 'deep_reasoning_lab', layer: 'command', status: 'draft', vdi: 84, quality: 80, readiness: 76, risk: 20, agent: 'Cloudflare Auditor', packageType: 'review_pack', questLane: 'specify', reward: 'infra-safety-badge' },
  { screen: 'deep-missions', id: 'deep-tailscale-health-watch', title: 'Tailscale + IDS Health Watch', objective: 'Continuously validate Tailscale, Suricata, KeePassXC, DNS hosts, and local lab readiness.', mode: 'proactive_watchtower', layer: 'command', status: 'running', vdi: 86, quality: 82, readiness: 80, risk: 12, agent: 'Local Health Sentinel', packageType: 'skill_pack', questLane: 'team', reward: 'ops-streak-xp' },

  // Арена агентов — compare agents on the same task.
  { screen: 'arena-builder', id: 'arena-naming-regression-battle', title: 'Electron Naming Regression Battle', objective: 'Compare Codex, Claude, OpenCode, and Hermes fixes for Electron→ROX.ONE naming across dev and packaged launch paths.', mode: 'swarm_arena', layer: 'arena', status: 'running', vdi: 91, quality: 90, readiness: 86, risk: 9, agent: 'Arena Verifier Pack', packageType: 'swarm_pack', questLane: 'arena', reward: 'leaderboard-slot' },
  { screen: 'arena-builder', id: 'arena-pzdrk-extension-fix', title: 'PZDRK Extension Fix-Off', objective: 'Run competing agents on a Chrome MV3 regression and rank by patch size, tests, and browser evidence.', mode: 'swarm_arena', layer: 'arena', status: 'queued', vdi: 85, quality: 82, readiness: 77, risk: 16, agent: 'Browser QA Duelists', packageType: 'swarm_pack', questLane: 'arena', reward: 'extension-arena-xp' },
  { screen: 'arena-builder', id: 'arena-kimi-modal-serving', title: 'Kimi Modal Serving Duel', objective: 'Compare serving plans for K2.5 on Modal B200 by latency, cost, cold-start, and rollback path.', mode: 'round_table', layer: 'arena', status: 'waiting_for_approval', vdi: 88, quality: 85, readiness: 81, risk: 15, agent: 'Modal GPU Council', packageType: 'review_pack', questLane: 'arena', reward: 'gpu-eval-badge' },
  { screen: 'arena-builder', id: 'arena-skill-pack-review', title: 'Skill Pack Review Tournament', objective: 'Evaluate installed skills for trigger accuracy, stale commands, verification discipline, and overlap.', mode: 'swarm_arena', layer: 'arena', status: 'completed', vdi: 89, quality: 87, readiness: 88, risk: 8, agent: 'Skill Curator Swarm', packageType: 'review_pack', questLane: 'marketplace', reward: 'curator-trust' },
  { screen: 'arena-builder', id: 'arena-ui-redesign-shotgun', title: 'Workbench UI Redesign Shotgun', objective: 'Generate several UI variants for Experience surfaces and select by visual QA, density, and founder fit.', mode: 'swarm_arena', layer: 'arena', status: 'paused', vdi: 78, quality: 75, readiness: 70, risk: 19, agent: 'Design Shotgun Team', packageType: 'swarm_pack', questLane: 'specify', reward: 'design-range-unlock' },

  // Центр миссий — active run operations.
  { screen: 'mission-control', id: 'mission-packaged-smoke-run', title: 'Packaged Smoke Run Control', objective: 'Operate build, plist validation, packaged smoke, screenshot, and final evidence index as a controlled release run.', mode: 'round_table', layer: 'game', status: 'completed', vdi: 95, quality: 93, readiness: 94, risk: 5, agent: 'Release Mission Controller', packageType: 'persona', questLane: 'verify', reward: 'release-approval-token' },
  { screen: 'mission-control', id: 'mission-s3-artifact-handoff', title: 'Private S3 Artifact Handoff', objective: 'Bundle screenshots, logs, reports, and manifests to private MinIO without leaking source code or secrets.', mode: 'deep_run', layer: 'command', status: 'queued', vdi: 82, quality: 79, readiness: 75, risk: 13, agent: 'Artifact Quartermaster', packageType: 'skill', questLane: 'execute', reward: 'artifact-chain-proof' },
  { screen: 'mission-control', id: 'mission-api-model-visibility', title: 'API + Model Visibility Audit', objective: 'Trace onboarding, default connection, Pi provider, model resolver, and pre-login user visibility.', mode: 'deep_reasoning_lab', layer: 'command', status: 'running', vdi: 86, quality: 84, readiness: 80, risk: 11, agent: 'Backend Visibility Auditor', packageType: 'review_pack', questLane: 'verify', reward: 'provider-map-proof' },
  { screen: 'mission-control', id: 'mission-db-backup-validation', title: 'Mongo/Qdrant Backup Validation', objective: 'Validate local backup jobs, rclone destination, manifests, restore notes, and authSource behavior.', mode: 'proactive_watchtower', layer: 'command', status: 'waiting_for_approval', vdi: 83, quality: 81, readiness: 78, risk: 17, agent: 'Backup Mission Ops', packageType: 'skill_pack', questLane: 'team', reward: 'restore-confidence-xp' },
  { screen: 'mission-control', id: 'mission-agentbook-rc', title: 'AgentBook Enterprise RC', objective: 'Coordinate spec, build gates, browser proof, release notes, and customer-ready handoff for AgentBook.', mode: 'round_table', layer: 'game', status: 'draft', vdi: 79, quality: 77, readiness: 72, risk: 21, agent: 'Enterprise Release Desk', packageType: 'persona', questLane: 'specify', reward: 'enterprise-rc-unlock' },

  // Прогресс — evidence-backed progression.
  { screen: 'progression', id: 'progress-release-ledger-backfill', title: 'Release Ledger Backfill', objective: 'Convert verified ROX build/typecheck/smoke/UI proof into VDI, XP, and release-readiness history.', mode: 'autoresearch_loop', layer: 'game', status: 'completed', vdi: 94, quality: 91, readiness: 92, risk: 6, agent: 'Ledger Historian', packageType: 'review_pack', questLane: 'team', reward: 'mastery-ledger' },
  { screen: 'progression', id: 'progress-hermes-ops-streak', title: 'Hermes Ops Streak', objective: 'Track consecutive healthy Telegram lanes, cron reports, STT, and gateway recovery outcomes.', mode: 'proactive_watchtower', layer: 'game', status: 'running', vdi: 87, quality: 84, readiness: 82, risk: 10, agent: 'Ops Progress Oracle', packageType: 'skill', questLane: 'team', reward: 'ops-streak-level' },
  { screen: 'progression', id: 'progress-research-citations', title: 'Research Citation Trust', objective: 'Score research sessions by source quality, currentness, citation completeness, and contradiction handling.', mode: 'autoresearch_loop', layer: 'game', status: 'queued', vdi: 81, quality: 79, readiness: 74, risk: 15, agent: 'Citation Scorer', packageType: 'skill', questLane: 'verify', reward: 'research-trust-xp' },
  { screen: 'progression', id: 'progress-skill-maintenance', title: 'Skill Maintenance XP', objective: 'Reward verified skill patches, stale-command removal, and reusable workflow extraction.', mode: 'round_table', layer: 'game', status: 'completed', vdi: 88, quality: 86, readiness: 85, risk: 9, agent: 'Skill XP Accountant', packageType: 'review_pack', questLane: 'marketplace', reward: 'skill-curator-level' },
  { screen: 'progression', id: 'progress-infra-risk-burn-down', title: 'Infra Risk Burn-Down', objective: 'Track Cloudflare, Tailscale, DB backup, DNS, IDS, and secrets hygiene risk deltas over time.', mode: 'proactive_watchtower', layer: 'game', status: 'paused', vdi: 84, quality: 80, readiness: 78, risk: 18, agent: 'Risk Burn-Down Bot', packageType: 'skill_pack', questLane: 'team', reward: 'infra-readiness-tier' },

  // Карта квестов — roadmap / capability unlocks.
  { screen: 'quest-map', id: 'quest-ship-rox-desktop', title: 'Quest: Ship ROX Desktop', objective: 'Unlock release capability by completing naming, signing, notarization, ASAR, icons, and smoke evidence.', mode: 'deep_run', layer: 'game', status: 'running', vdi: 90, quality: 87, readiness: 83, risk: 12, agent: 'Desktop Quest Guide', packageType: 'persona', questLane: 'verify', reward: 'desktop-shipping-unlock' },
  { screen: 'quest-map', id: 'quest-import-agent-memory', title: 'Quest: Import Agent Memory', objective: 'Unlock sanitized import of sessions, skills, and artifacts into Experience truth state.', mode: 'deep_reasoning_lab', layer: 'game', status: 'queued', vdi: 82, quality: 79, readiness: 74, risk: 20, agent: 'Memory Quest Guide', packageType: 'skill_pack', questLane: 'formulate', reward: 'memory-import-unlock' },
  { screen: 'quest-map', id: 'quest-ai-cloud-stack', title: 'Quest: AI Cloud Stack', objective: 'Unlock Modal/vLLM/GPU serving path with cost dashboards, evals, and fallback providers.', mode: 'autoresearch_loop', layer: 'game', status: 'draft', vdi: 78, quality: 76, readiness: 69, risk: 22, agent: 'GPU Quest Smith', packageType: 'skill', questLane: 'specify', reward: 'gpu-serving-unlock' },
  { screen: 'quest-map', id: 'quest-secure-ops-foundation', title: 'Quest: Secure Ops Foundation', objective: 'Unlock baseline infra health: secrets, S3, DNS, IDS, backups, Tailscale, and cron evidence.', mode: 'proactive_watchtower', layer: 'game', status: 'running', vdi: 86, quality: 83, readiness: 81, risk: 13, agent: 'Secure Ops Guide', packageType: 'skill_pack', questLane: 'team', reward: 'secure-ops-unlock' },
  { screen: 'quest-map', id: 'quest-public-content-engine', title: 'Quest: Public Content Engine', objective: 'Unlock pipeline from research and build logs into X/newsletter/blog drafts without leaking private data.', mode: 'round_table', layer: 'game', status: 'waiting_for_approval', vdi: 80, quality: 77, readiness: 73, risk: 17, agent: 'Content Quest Planner', packageType: 'persona', questLane: 'marketplace', reward: 'content-engine-unlock' },

  // Кузница агентов — package/fork/install private skills and personas.
  { screen: 'agent-forge', id: 'forge-private-rox-pack', title: 'Forge: Private ROX Pack', objective: 'Package ROX desktop release, browser QA, naming validation, and evidence collection as a reusable private skill pack.', mode: 'proactive_watchtower', layer: 'command', status: 'running', vdi: 88, quality: 86, readiness: 83, risk: 11, agent: 'Private Pack Smith', packageType: 'skill_pack', questLane: 'marketplace', reward: 'private-agent-unlock' },
  { screen: 'agent-forge', id: 'forge-hermes-stt-ops', title: 'Forge: Hermes STT Ops', objective: 'Bundle Deepgram STT recovery, Telegram topic routing, gateway triage, and voice transcript validation.', mode: 'deep_run', layer: 'command', status: 'queued', vdi: 85, quality: 82, readiness: 78, risk: 14, agent: 'Voice Ops Smith', packageType: 'skill_pack', questLane: 'team', reward: 'voice-agent-pack' },
  { screen: 'agent-forge', id: 'forge-modal-gpu-servant', title: 'Forge: Modal GPU Servant', objective: 'Create an installable agent package for Modal GPU serving, model evals, and cost-aware fallback routing.', mode: 'autoresearch_loop', layer: 'command', status: 'draft', vdi: 81, quality: 78, readiness: 72, risk: 19, agent: 'GPU Servant Smith', packageType: 'persona', questLane: 'marketplace', reward: 'gpu-agent-package' },
  { screen: 'agent-forge', id: 'forge-cloudflare-auditor', title: 'Forge: Cloudflare Auditor', objective: 'Package DNS/SSL/workers audit workflow with rollback gates and no-secret reporting.', mode: 'deep_reasoning_lab', layer: 'command', status: 'completed', vdi: 87, quality: 85, readiness: 86, risk: 8, agent: 'Cloudflare Auditor Pack', packageType: 'review_pack', questLane: 'verify', reward: 'infra-auditor-pack' },
  { screen: 'agent-forge', id: 'forge-obsidian-librarian', title: 'Forge: Obsidian Librarian', objective: 'Turn vault search, note ingestion, PDF summary, and Cornell notes workflows into a permissioned skill package.', mode: 'round_table', layer: 'command', status: 'paused', vdi: 79, quality: 76, readiness: 71, risk: 16, agent: 'Vault Librarian Pack', packageType: 'skill_pack', questLane: 'formulate', reward: 'knowledge-agent-pack' },
]

export interface DemoExperienceSession {
  id: string
  screen: WorkbenchScreen
  label: string
  title: string
  description: string
  sourceSessionLabel: string
  usageSteps: string[]
  setupSteps: string[]
  expectedOutcomes: string[]
  mcpPresetIds: string[]
  demoActions: DemoExperienceAction[]
  truthState: ExperienceTruthState
}

export const DEMO_EXPERIENCE_SESSIONS: DemoExperienceSession[] = DEMO_SPECS.map((spec, index) => {
  const screenOrdinal = DEMO_SPECS.filter((candidate) => candidate.screen === spec.screen).findIndex((candidate) => candidate.id === spec.id) + 1
  const missionId = `mission:${spec.id}`
  const artifactId = `artifact:${spec.id}:evidence-pack`
  const gateId = `gate:${spec.id}:schema-pass`
  const agentPackageId = `pkg:${spec.id}`
  const questId = QUEST_ID_BY_LANE[spec.questLane]
  const hasStarted = spec.status !== 'draft' && spec.status !== 'queued'
  const isCompleted = spec.status === 'completed'

  return {
    id: spec.id,
    screen: spec.screen,
    label: `${screenOrdinal}. ${spec.title}`,
    title: spec.title,
    description: spec.objective,
    sourceSessionLabel: `Сессия-пример ${screenOrdinal}: ${spec.title}`,
    usageSteps: buildUsageSteps(spec),
    setupSteps: buildSetupSteps(spec),
    expectedOutcomes: buildExpectedOutcomes(spec),
    mcpPresetIds: MCP_PRESETS_BY_SCREEN[spec.screen],
    demoActions: buildDemoActions(spec, artifactId, gateId),
    truthState: createExperienceTruthState({
      mission: {
        id: missionId,
        ownerUserId: 'demo-user',
        teamId: 'demo-team',
        workspaceId: 'demo-workspace',
        sourceArtifactId: artifactId,
        mode: spec.mode,
        experienceLayer: spec.layer,
        title: spec.title,
        objective: spec.objective,
        durationHours: 24 + (index % 5) * 12,
        checkpointCadenceHours: 6,
        status: spec.status,
        vdiTarget: spec.vdi,
        budgetCapCredits: 500 + index * 90,
        tokenCap: 1_000_000 + index * 125_000,
        storageCapBytes: 1_073_741_824,
        selectedAgentPackageIds: [agentPackageId],
        requiredGateIds: ['schema', 'fact_check', 'security_check'],
        createdAt: NOW,
        startedAt: hasStarted ? NOW : undefined,
        completedAt: isCompleted ? NOW : undefined,
      },
      checkpoints: [0, 6, 12, 18, 24].map((hour, checkpointIndex) => ({
        id: `cp:${spec.id}:${hour}h`,
        missionRunId: missionId,
        ordinal: checkpointIndex,
        dueAt: NOW,
        completedAt: (hour <= 12 && hasStarted) || isCompleted ? NOW : undefined,
        title: hour === 0 ? 'Launch brief' : `Checkpoint ${hour}h`,
        summary: hour === 0 ? 'Sanitized mission brief accepted.' : `Evidence slice ${hour}h ready for review.`,
        artifactIds: hour <= 12 || isCompleted ? [artifactId] : [],
        vdiDelta: hour === 0 ? 0 : 2 + checkpointIndex,
        status: isCompleted || (hour <= 12 && hasStarted) ? 'completed' : spec.status === 'running' && hour === 18 ? 'running' : 'queued',
      })),
      gateResults: [
        { gateId: 'schema', status: 'pass', evidenceRef: gateId },
        { gateId: 'fact_check', status: spec.risk > 16 ? 'warn' : 'pass', evidenceRef: `gate:${spec.id}:fact-check` },
        { gateId: 'security_check', status: spec.risk > 21 ? 'warn' : 'pass', evidenceRef: `gate:${spec.id}:secret-scan` },
      ],
      metricSnapshots: [
        {
          id: `metric:${spec.id}`,
          missionRunId: missionId,
          userId: 'demo-user',
          teamId: 'demo-team',
          qualityScore: spec.quality,
          executionReadiness: spec.readiness,
          verifiedDeliverableIndex: spec.vdi,
          costEfficiency: 2 + (index % 7),
          openRiskScore: spec.risk,
          noiseScore: 5 + (index % 6),
          evidenceRefs: [artifactId, gateId],
          createdAt: NOW,
        },
      ],
      questProgress: [
        {
          id: `progress:${spec.id}`,
          questId,
          userId: 'demo-user',
          teamId: 'demo-team',
          status: isCompleted ? 'completed' : 'active',
          percent: isCompleted ? 100 : Math.min(95, 30 + (index % 5) * 13),
          evidenceRefs: [artifactId],
          completedAt: isCompleted ? NOW : undefined,
        },
      ],
      ledger: [
        {
          id: `ledger:${spec.id}:xp`,
          userId: 'demo-user',
          teamId: 'demo-team',
          eventType: 'xp',
          amount: 120 + index * 25,
          currency: 'xp',
          reason: `Evidence-backed progress: ${spec.reward}`,
          sourceArtifactId: artifactId,
          createdAt: NOW,
        },
      ],
      agentPackages: [
        {
          id: agentPackageId,
          packageType: spec.packageType,
          name: spec.agent,
          description: `Demo package for ${spec.title}. Sanitized: no credentials, local paths, tokens, cookies, or private transcripts.`,
          ownerTeamId: 'demo-team',
          visibility: index % 3 === 0 ? 'team' : 'private',
          rarity: spec.vdi >= 90 ? 'legendary' : spec.vdi >= 84 ? 'epic' : 'rare',
          trustScore: Math.min(99, spec.quality + 5),
          riskLevel: spec.risk >= 18 ? 'medium' : 'low',
          permissionProfileId: `permission:${spec.id}`,
          latestVersion: '1.0.0-demo',
          pricingModel: 'demo_private',
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
      installedAgentPackageIds: [agentPackageId],
    }),
  }
})

export function getDemoSessionsForScreen(screen: WorkbenchScreen): DemoExperienceSession[] {
  return DEMO_EXPERIENCE_SESSIONS.filter((session) => session.screen === screen)
}

function buildUsageSteps(spec: DemoSpec): string[] {
  const screenLabel = EXPERIENCE_SCREEN_LABELS[spec.screen]
  return [
    `Откройте демо "${spec.title}" во вкладке "${screenLabel}" и проверьте заполненный objective, статус и risk.`,
    `Используйте кнопки панели, чтобы увидеть setup, запуск, ожидания и evidence без внешнего продакшен-сайд-эффекта.`,
    `Дальше переходите в рабочий экран ниже: он получает тот же truth state, что и демо-панель.`,
  ]
}

function buildSetupSteps(spec: DemoSpec): string[] {
  return [
    `Agent package: ${spec.agent}; режим: ${spec.mode}; слой: ${spec.layer}.`,
    `Цель качества: VDI ${spec.vdi}, readiness ${spec.readiness}, quality ${spec.quality}.`,
    `Ограничение риска: open risk ${spec.risk}; статус старта: ${STATUS_LABELS[spec.status]}.`,
  ]
}

function buildExpectedOutcomes(spec: DemoSpec): string[] {
  return [
    `Понятно, какие действия доступны в "${EXPERIENCE_SCREEN_LABELS[spec.screen]}" и почему они включены или заблокированы.`,
    `Пользователь видит expected result: ${spec.reward}, связанный с sanitized session example.`,
    `Evidence chain остается локальным: artifact, gate, ledger, quest progress и agent package не требуют секретов.`,
  ]
}

function buildDemoActions(spec: DemoSpec, artifactId: string, gateId: string): DemoExperienceAction[] {
  return [
    {
      id: 'configure',
      label: 'Настроить',
      result: `Шаг: настройка. Выбран ${spec.agent}, цель VDI ${spec.vdi}, пакет ${spec.packageType}, MCP: ${MCP_PRESETS_BY_SCREEN[spec.screen].join(', ')}.`,
    },
    {
      id: 'run',
      label: 'Запустить демо',
      result: `Шаг: запуск. ${spec.mode} переводит сценарий "${spec.title}" в состояние "${STATUS_LABELS[spec.status]}" без внешних side effects.`,
    },
    {
      id: 'expectations',
      label: 'Ожидания',
      result: `Шаг: ожидания. Должны появиться ${spec.reward}, verified deliverable index ${spec.vdi} и понятные blocking reasons при риске ${spec.risk}.`,
    },
    {
      id: 'evidence',
      label: 'Evidence',
      result: `Шаг: evidence. Используются ${artifactId}, ${gateId}, ledger:${spec.id}:xp и quest progress для ${QUEST_ID_BY_LANE[spec.questLane]}.`,
    },
    {
      id: 'reset',
      label: 'Сбросить',
      result: `Шаг: сброс. Демо возвращено к исходной sanitized сессии "${spec.title}".`,
    },
  ]
}
