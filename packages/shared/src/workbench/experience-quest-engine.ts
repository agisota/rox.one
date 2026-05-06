import {
  QuestProgressSchema,
  QuestSchema,
  type Quest,
} from './experience-layer';
import type { ExperienceEvent, ExperienceRuntimeState } from './experience-runtime-store';

export const EXPERIENCE_QUEST_GRAPH: Quest[] = [
  {
    id: 'quest-frame-raw-prompt',
    lane: 'formulate',
    defaultLayer: 'command',
    title: 'Frame raw prompt',
    description: 'Turn the raw request into a bounded prompt artifact.',
    requirements: ['prompt.submitted event', 'artifact evidence'],
    rewards: ['20 XP'],
    unlocks: ['quest-rewrite-prompt'],
  },
  {
    id: 'quest-rewrite-prompt',
    lane: 'formulate',
    defaultLayer: 'command',
    title: 'Rewrite prompt',
    description: 'Improve the prompt into an execution-ready request.',
    requirements: ['prompt.rewritten event', 'source prompt artifact'],
    rewards: ['20 XP'],
    unlocks: ['quest-clarify-assumptions'],
  },
  {
    id: 'quest-clarify-assumptions',
    lane: 'formulate',
    defaultLayer: 'command',
    title: 'Clarify assumptions',
    description: 'Record open assumptions before execution planning.',
    requirements: ['review.completed event with evidence'],
    rewards: ['15 XP'],
    unlocks: ['quest-build-executable-spec'],
  },
  {
    id: 'quest-build-executable-spec',
    lane: 'specify',
    defaultLayer: 'game',
    title: 'Build executable spec',
    description: 'Compile a spec artifact that agents can execute.',
    requirements: ['spec.compiled event', 'spec artifact'],
    rewards: ['30 XP'],
    unlocks: ['quest-generate-tdd-plan'],
  },
  {
    id: 'quest-generate-tdd-plan',
    lane: 'specify',
    defaultLayer: 'game',
    title: 'Generate TDD plan',
    description: 'Create a red-green-verify plan before execution.',
    requirements: ['tdd.plan.created event', 'TDD artifact'],
    rewards: ['25 XP'],
    unlocks: ['quest-run-review-gate'],
  },
  {
    id: 'quest-run-review-gate',
    lane: 'verify',
    defaultLayer: 'command',
    title: 'Run Review Gate',
    description: 'Run review validation and record gate evidence.',
    requirements: ['review.completed or gate event', 'gate evidence'],
    rewards: ['25 XP'],
    unlocks: ['quest-launch-first-deep-mission'],
  },
  {
    id: 'quest-launch-first-deep-mission',
    lane: 'execute',
    defaultLayer: 'command',
    title: 'Launch first deep mission',
    description: 'Launch a durable mission through the runtime store.',
    requirements: ['mission.launched event'],
    rewards: ['Mission Control access'],
    unlocks: ['quest-complete-checkpoint-with-evidence'],
  },
  {
    id: 'quest-complete-checkpoint-with-evidence',
    lane: 'execute',
    defaultLayer: 'game',
    title: 'Complete checkpoint with evidence',
    description: 'Complete a checkpoint only after artifact or gate evidence exists.',
    requirements: ['mission.checkpoint.completed event', 'artifact or gate evidence'],
    rewards: ['40 XP'],
    unlocks: ['quest-resolve-blocker'],
  },
  {
    id: 'quest-resolve-blocker',
    lane: 'verify',
    defaultLayer: 'command',
    title: 'Resolve blocker',
    description: 'Convert a blocking gate or paused mission into verified progress.',
    requirements: ['prior blocker', 'subsequent passing gate evidence'],
    rewards: ['Risk reduction'],
    unlocks: ['quest-final-verified-deliverable'],
  },
  {
    id: 'quest-final-verified-deliverable',
    lane: 'verify',
    defaultLayer: 'command',
    title: 'Final verified deliverable',
    description: 'Finalize a mission with a final artifact and passing gate evidence.',
    requirements: ['mission.finalized event', 'final artifact', 'passing gate evidence'],
    rewards: ['VDI completion'],
    unlocks: ['quest-launch-swarm-arena'],
  },
  {
    id: 'quest-launch-swarm-arena',
    lane: 'arena',
    defaultLayer: 'arena',
    title: 'Launch swarm arena',
    description: 'Create a swarm mission draft with selected trusted agents.',
    requirements: ['swarm_arena mission', 'selected agents'],
    rewards: ['Arena branch'],
    unlocks: ['quest-install-trusted-agent-package'],
  },
  {
    id: 'quest-install-trusted-agent-package',
    lane: 'marketplace',
    defaultLayer: 'arena',
    title: 'Install trusted agent package',
    description: 'Install a package only after contract and trust checks pass.',
    requirements: ['agent.package.installed event', 'trust evidence'],
    rewards: ['Agent roster entry'],
    unlocks: ['quest-fork-package-team-registry'],
  },
  {
    id: 'quest-fork-package-team-registry',
    lane: 'team',
    defaultLayer: 'arena',
    title: 'Fork package into team registry',
    description: 'Fork a trusted package into the team registry.',
    requirements: ['agent.package.forked event', 'team evidence'],
    rewards: ['Team registry package'],
    unlocks: ['quest-share-verified-session'],
  },
  {
    id: 'quest-share-verified-session',
    lane: 'team',
    defaultLayer: 'command',
    title: 'Share verified session',
    description: 'Share only a redacted verified session bundle.',
    requirements: ['share artifact', 'redaction evidence'],
    rewards: ['Share-ready proof'],
    unlocks: [],
  },
].map((quest) => QuestSchema.parse(quest));

export function projectExperienceQuestProgress(
  state: ExperienceRuntimeState,
  event: ExperienceEvent,
): ExperienceRuntimeState {
  const progressByQuestId = new Map(
    EXPERIENCE_QUEST_GRAPH.map((quest, index) => [
      quest.id,
      QuestProgressSchema.parse({
        id: `progress-${quest.id}`,
        questId: quest.id,
        status: index === 0 ? 'available' : 'locked',
        percent: 0,
        evidenceRefs: [],
      }),
    ]),
  );

  for (const progress of state.questProgress) {
    progressByQuestId.set(progress.questId, QuestProgressSchema.parse(progress));
  }

  const completion = inferQuestCompletion(state, event);
  if (completion) {
    const existing = progressByQuestId.get(completion.questId);
    progressByQuestId.set(completion.questId, QuestProgressSchema.parse({
      ...existing,
      id: existing?.id ?? `progress-${completion.questId}`,
      questId: completion.questId,
      status: 'completed',
      percent: 100,
      evidenceRefs: completion.evidenceRefs,
      completedAt: event.createdAt,
    }));
  }

  const completedQuestIds = new Set(
    [...progressByQuestId.values()]
      .filter((progress) => progress.status === 'completed')
      .map((progress) => progress.questId),
  );

  for (const quest of EXPERIENCE_QUEST_GRAPH) {
    if (completedQuestIds.has(quest.id)) continue;
    const requirements = getQuestDependencies(quest.id);
    if (requirements.length === 0) continue;
    if (!requirements.every((questId) => completedQuestIds.has(questId))) continue;

    const progress = progressByQuestId.get(quest.id);
    if (progress?.status === 'locked') {
      progressByQuestId.set(quest.id, QuestProgressSchema.parse({
        ...progress,
        status: 'available',
      }));
    }
  }

  return {
    ...state,
    questProgress: [...progressByQuestId.values()],
  };
}

function inferQuestCompletion(
  state: ExperienceRuntimeState,
  event: ExperienceEvent,
): { questId: string; evidenceRefs: string[] } | undefined {
  switch (event.type) {
    case 'prompt.submitted':
      return {
        questId: 'quest-frame-raw-prompt',
        evidenceRefs: [asArtifactRef(event.payload.artifactId)],
      };
    case 'prompt.rewritten':
      return {
        questId: 'quest-rewrite-prompt',
        evidenceRefs: [asArtifactRef(event.payload.artifactId), asArtifactRef(event.payload.sourceArtifactId)],
      };
    case 'spec.compiled':
      return {
        questId: 'quest-build-executable-spec',
        evidenceRefs: [asArtifactRef(event.payload.artifactId)],
      };
    case 'tdd.plan.created':
      return {
        questId: 'quest-generate-tdd-plan',
        evidenceRefs: [asArtifactRef(event.payload.artifactId)],
      };
    case 'review.completed': {
      const evidenceRefs = event.payload.gateEvidenceRefs.length > 0
        ? event.payload.gateEvidenceRefs
        : event.payload.artifactId
          ? [asArtifactRef(event.payload.artifactId)]
          : [];
      if (evidenceRefs.length === 0) return undefined;
      return {
        questId: 'quest-run-review-gate',
        evidenceRefs,
      };
    }
    case 'gate.passed':
    case 'gate.warned':
    case 'gate.failed':
      if (!event.payload.evidenceRef) return undefined;
      return {
        questId: 'quest-run-review-gate',
        evidenceRefs: [event.payload.evidenceRef],
      };
    case 'mission.launched':
      return {
        questId: event.payload.mission.mode === 'swarm_arena' ? 'quest-launch-swarm-arena' : 'quest-launch-first-deep-mission',
        evidenceRefs: [asArtifactRef(event.payload.mission.id)],
      };
    case 'mission.checkpoint.completed': {
      const artifactRefs = event.payload.artifactIds.map(asArtifactRef);
      const gateRefs = state.gateResults
        .filter((gate) => !gate.missionRunId || gate.missionRunId === event.payload.missionRunId)
        .map((gate) => gate.evidenceRef);
      const evidenceRefs = uniqueSortedStrings([...artifactRefs, ...gateRefs]);
      if (evidenceRefs.length === 0) return undefined;
      return {
        questId: 'quest-complete-checkpoint-with-evidence',
        evidenceRefs,
      };
    }
    case 'mission.finalized': {
      const mission = state.missions.find((candidate) => candidate.id === event.payload.missionRunId);
      if (mission?.status !== 'completed') return undefined;

      const evidenceRefs = uniqueSortedStrings([
        ...(event.payload.finalArtifactId ? [asArtifactRef(event.payload.finalArtifactId)] : []),
        ...event.payload.gateEvidenceRefs,
      ]);
      if (evidenceRefs.length < 2) return undefined;
      return {
        questId: 'quest-final-verified-deliverable',
        evidenceRefs,
      };
    }
    case 'agent.package.installed':
      if (event.payload.evidenceRefs.length === 0) return undefined;
      return {
        questId: 'quest-install-trusted-agent-package',
        evidenceRefs: event.payload.evidenceRefs,
      };
    case 'agent.package.forked':
      if (event.payload.evidenceRefs.length === 0) return undefined;
      return {
        questId: 'quest-fork-package-team-registry',
        evidenceRefs: event.payload.evidenceRefs,
      };
    default:
      return undefined;
  }
}

function getQuestDependencies(questId: string): string[] {
  switch (questId) {
    case 'quest-rewrite-prompt':
      return ['quest-frame-raw-prompt'];
    case 'quest-clarify-assumptions':
      return ['quest-rewrite-prompt'];
    case 'quest-build-executable-spec':
      return ['quest-rewrite-prompt'];
    case 'quest-generate-tdd-plan':
      return ['quest-build-executable-spec'];
    case 'quest-run-review-gate':
      return ['quest-generate-tdd-plan'];
    case 'quest-launch-first-deep-mission':
      return ['quest-run-review-gate'];
    case 'quest-complete-checkpoint-with-evidence':
      return ['quest-launch-first-deep-mission'];
    case 'quest-resolve-blocker':
      return ['quest-complete-checkpoint-with-evidence'];
    case 'quest-final-verified-deliverable':
      return ['quest-complete-checkpoint-with-evidence'];
    case 'quest-launch-swarm-arena':
      return ['quest-final-verified-deliverable'];
    case 'quest-install-trusted-agent-package':
      return ['quest-launch-swarm-arena'];
    case 'quest-fork-package-team-registry':
      return ['quest-install-trusted-agent-package'];
    case 'quest-share-verified-session':
      return ['quest-fork-package-team-registry'];
    default:
      return [];
  }
}

function asArtifactRef(id: string): string {
  return id.startsWith('artifact:') || id.startsWith('gate:') ? id : `artifact:${id}`;
}

function uniqueSortedStrings(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}
