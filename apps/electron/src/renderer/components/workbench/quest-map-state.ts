import {
  EXPERIENCE_QUEST_GRAPH,
  QuestProgressSchema,
  type ExperienceLayer,
  type ExperienceTruthState,
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

export function createQuestMapStateFromTruth(truthState: ExperienceTruthState, input: Partial<QuestMapState> = {}): QuestMapState {
  const baseState = createQuestMapState(input);
  const progressByQuestId = { ...baseState.progressByQuestId };

  for (const progress of truthState.questProgress) {
    progressByQuestId[progress.questId] = progress;
  }

  return evaluateQuestUnlocks(createQuestMapState({
    ...baseState,
    progressByQuestId,
  }));
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

export function completeQuestAndEvaluateUnlocks(
  state: QuestMapState,
  questId: string,
  evidenceRefs: string[],
): QuestMapState {
  return evaluateQuestUnlocks(completeQuest(state, questId, evidenceRefs));
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
      title: 'Карта квестов',
      laneLabel: 'Дерево навыков',
      progressLabel: 'Прогресс квеста',
    };
  }

  if (layer === 'arena') {
    return {
      title: 'Кампания арены',
      laneLabel: 'Линии арены',
      progressLabel: 'Прогресс арены',
    };
  }

  return {
    title: 'Карта задач',
    laneLabel: 'Вехи',
    progressLabel: 'Прогресс вехи',
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
  return EXPERIENCE_QUEST_GRAPH;
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
        status: quest.id === 'quest-frame-raw-prompt' ? 'available' : 'locked',
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
      requiredQuestIds: ['quest-frame-raw-prompt'],
      unlockQuestIds: ['quest-rewrite-prompt'],
      rewardIds: ['skill:spec-builder'],
    },
    {
      id: 'unlock-arena',
      requiredQuestIds: ['quest-final-verified-deliverable'],
      unlockQuestIds: ['quest-launch-swarm-arena'],
      rewardIds: ['agent:architect-prime'],
    },
  ];
}
