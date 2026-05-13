import { describe, expect, test } from 'bun:test';
import { EXPERIENCE_QUEST_GRAPH } from '@rox-one/shared/workbench';
import { renderToStaticMarkup } from 'react-dom/server';

import { QuestMapSkillTree } from '../QuestMapSkillTree';
import {
  completeQuest,
  createQuestMapState,
  evaluateQuestUnlocks,
} from '../quest-map-state';

describe('Quest Map and Skill Tree', () => {
  test('quest completion requires artifact or gate evidence', () => {
    const state = createQuestMapState();

    expect(() => completeQuest(state, 'quest-frame-raw-prompt', ['note:unsupported'])).toThrow(
      'Completed quests require artifact or validation gate evidence',
    );

    const completed = completeQuest(state, 'quest-frame-raw-prompt', ['artifact:prompt-brief']);
    expect(completed.progressByQuestId['quest-frame-raw-prompt']?.status).toBe('completed');
    expect(completed.progressByQuestId['quest-frame-raw-prompt']?.percent).toBe(100);
  });

  test('locked quests cannot be manually completed', () => {
    const state = createQuestMapState();

    expect(() => completeQuest(state, 'quest-launch-swarm-arena', ['artifact:arena-run'])).toThrow(
      'Locked quests cannot be manually completed.',
    );
  });

  test('unlock rules evaluate deterministically from completed requirements', () => {
    const state = createQuestMapState();
    const unlocked = evaluateQuestUnlocks(completeQuest(state, 'quest-frame-raw-prompt', ['gate:schema:passed']));

    expect(unlocked.progressByQuestId['quest-rewrite-prompt']?.status).toBe('available');
    expect(unlocked.unlockedRewardIds).toContain('skill:spec-builder');
  });

  test('renders the shared required ROX quest graph instead of a local short fixture', () => {
    const state = createQuestMapState();
    const markup = renderToStaticMarkup(<QuestMapSkillTree initialState={state} layer="game" />);

    expect(state.quests.map((quest) => quest.id)).toEqual(EXPERIENCE_QUEST_GRAPH.map((quest) => quest.id));
    expect(markup).toContain('Оформить сырой prompt');
    expect(markup).toContain('Финальный проверенный результат');
    expect(markup).toContain('Поделиться проверенной сессией');
  });

  test('Command view renders roadmap language while Game view renders quest language', () => {
    const state = createQuestMapState();
    const commandMarkup = renderToStaticMarkup(<QuestMapSkillTree initialState={state} layer="command" />);
    const gameMarkup = renderToStaticMarkup(<QuestMapSkillTree initialState={state} layer="game" />);

    expect(commandMarkup).toContain('Карта задач');
    expect(commandMarkup).toContain('Вехи');
    expect(gameMarkup).toContain('Карта квестов');
    expect(gameMarkup).toContain('Дерево навыков');
  });
});
