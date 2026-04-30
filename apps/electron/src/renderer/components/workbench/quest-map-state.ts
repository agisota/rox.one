import {
  QuestProgressSchema,
  type ExperienceLayer,
  type Quest,
  type QuestLane,
  type QuestProgress,
} from '@rox-agent/shared/workbench';

export type QuestUnlockRule = {
  id: string;
  requiredQuestIds: string[];
  unlockQuestIds: string[];
  rewardIds: string[];
};

export type QuestMapState = {
  quests: Quest[];
  progressByQuestId: Record<string, QuestProgress>;
  unlockRules: QuestUnlockRule[];
  unlockedRewardIds: string[];
};

export function createQuestMapState(input: Partial<QuestMapState> = {}): QuestMapState {
  const quests = input.quests ?? createQuests();
  const progressByQuestId = input.progressByQuestId ?? createQuestProgress(quests);
  return {
    quests,
    progressByQuestId,
    unlockRules: input.unlockRules ?? createUnlockRules(),
    unlockedRewardIds: input.unlockedRewardIds ?? [],
  };
}

export function completeQuest(state: QuestMapState, questId: string, evidenceRefs: string[]): QuestMapState {
  const progress = state.progressByQuestId[questId];
  if (!progress) return state;
  if (progress.status === 'locked') {
    throw new Error('Locked quests cannot be manually completed.');
  }

  const completed = QuestProgressSchema.parse({
    ...progress,
    status: 'completed',
    percent: 100,
    evidenceRefs,
    completedAt: '2026-04-30T00:00:00.000Z',
  });

  return createQuestMapState({
    ...state,
    progressByQuestId: {
      ...state.progressByQuestId,
      [questId]: completed,
    },
  });
}

export function evaluateQuestUnlocks(state: QuestMapState): QuestMapState {
  const completedQuestIds = new Set(
    Object.entries(state.progressByQuestId)
      .filter(([, progress]) => progress.status === 'completed')
      .map(([questId]) => questId),
  );
  const nextProgress = { ...state.progressByQuestId };
  const unlockedRewardIds = new Set(state.unlockedRewardIds);

  for (const rule of state.unlockRules) {
    if (!rule.requiredQuestIds.every((questId) => completedQuestIds.has(questId))) continue;

    for (const questId of rule.unlockQuestIds) {
      const progress = nextProgress[questId];
      if (progress?.status === 'locked') {
        nextProgress[questId] = { ...progress, status: 'available' };
      }
    }

    for (const rewardId of rule.rewardIds) {
      unlockedRewardIds.add(rewardId);
    }
  }

  return createQuestMapState({
    ...state,
    progressByQuestId: nextProgress,
    unlockedRewardIds: [...unlockedRewardIds],
  });
}

export function getQuestPresentation(layer: ExperienceLayer): {
  title: string;
  laneLabel: string;
  progressLabel: string;
} {
  if (layer === 'game') {
    return {
      title: 'Quest Map',
      laneLabel: 'Skill Tree',
      progressLabel: 'Quest progress',
    };
  }

  if (layer === 'arena') {
    return {
      title: 'Arena Campaign',
      laneLabel: 'Arena lanes',
      progressLabel: 'Arena progress',
    };
  }

  return {
    title: 'Roadmap Map',
    laneLabel: 'Milestone lanes',
    progressLabel: 'Milestone progress',
  };
}

export function groupQuestsByLane(quests: Quest[]): Array<{ lane: QuestLane; quests: Quest[] }> {
  const lanes: QuestLane[] = ['formulate', 'specify', 'execute', 'verify', 'marketplace', 'team', 'arena'];
  return lanes
    .map((lane) => ({
      lane,
      quests: quests.filter((quest) => quest.lane === lane),
    }))
    .filter((group) => group.quests.length > 0);
}

function createQuests(): Quest[] {
  return [
    {
      id: 'quest-formulate',
      lane: 'formulate',
      defaultLayer: 'command',
      title: 'Frame the raw prompt',
      description: 'Convert an unclear idea into objective, constraints, and evidence expectations.',
      requirements: ['Add prompt brief', 'Pass schema gate'],
      rewards: ['20 XP'],
      unlocks: ['skill:spec-builder'],
    },
    {
      id: 'quest-specify',
      lane: 'specify',
      defaultLayer: 'game',
      title: 'Build the executable spec',
      description: 'Select requirements and compile a build-ready spec.',
      requirements: ['Complete formulate lane'],
      rewards: ['30 XP'],
      unlocks: ['agent:architect-prime'],
    },
    {
      id: 'quest-arena-swarm',
      lane: 'arena',
      defaultLayer: 'arena',
      title: 'Launch a swarm arena',
      description: 'Run a deduped swarm and produce a verified minority report.',
      requirements: ['Complete verified review', 'Reach VDI 85'],
      rewards: ['Arena slot +1'],
      unlocks: ['swarm:expanded'],
    },
  ];
}

function createQuestProgress(quests: Quest[]): Record<string, QuestProgress> {
  return Object.fromEntries(
    quests.map((quest) => [
      quest.id,
      {
        id: `progress-${quest.id}`,
        questId: quest.id,
        userId: 'user-one',
        teamId: 'team-alpha',
        status: quest.id === 'quest-formulate' ? 'available' : 'locked',
        percent: 0,
        evidenceRefs: [],
      } satisfies QuestProgress,
    ]),
  );
}

function createUnlockRules(): QuestUnlockRule[] {
  return [
    {
      id: 'unlock-spec-builder',
      requiredQuestIds: ['quest-formulate'],
      unlockQuestIds: ['quest-specify'],
      rewardIds: ['skill:spec-builder'],
    },
    {
      id: 'unlock-arena',
      requiredQuestIds: ['quest-formulate', 'quest-specify'],
      unlockQuestIds: ['quest-arena-swarm'],
      rewardIds: ['agent:architect-prime'],
    },
  ];
}
