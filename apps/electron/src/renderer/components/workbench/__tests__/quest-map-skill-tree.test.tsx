import { describe, expect, test } from 'bun:test';
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

    expect(() => completeQuest(state, 'quest-formulate', ['note:unsupported'])).toThrow(
      'Completed quests require artifact or validation gate evidence',
    );

    const completed = completeQuest(state, 'quest-formulate', ['artifact:prompt-brief']);
    expect(completed.progressByQuestId['quest-formulate']?.status).toBe('completed');
    expect(completed.progressByQuestId['quest-formulate']?.percent).toBe(100);
  });

  test('locked quests cannot be manually completed', () => {
    const state = createQuestMapState();

    expect(() => completeQuest(state, 'quest-arena-swarm', ['artifact:arena-run'])).toThrow(
      'Locked quests cannot be manually completed.',
    );
  });

  test('unlock rules evaluate deterministically from completed requirements', () => {
    const state = createQuestMapState();
    const unlocked = evaluateQuestUnlocks(completeQuest(state, 'quest-formulate', ['gate:schema:passed']));

    expect(unlocked.progressByQuestId['quest-specify']?.status).toBe('available');
    expect(unlocked.unlockedRewardIds).toContain('skill:spec-builder');
  });

  test('Command view renders roadmap language while Game view renders quest language', () => {
    const state = createQuestMapState();
    const commandMarkup = renderToStaticMarkup(<QuestMapSkillTree initialState={state} layer="command" />);
    const gameMarkup = renderToStaticMarkup(<QuestMapSkillTree initialState={state} layer="game" />);

    expect(commandMarkup).toContain('Roadmap Map');
    expect(commandMarkup).toContain('Milestone lanes');
    expect(gameMarkup).toContain('Quest Map');
    expect(gameMarkup).toContain('Skill Tree');
  });
});
