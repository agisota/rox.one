import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import { AgentForgeTeamRegistry } from '../AgentForgeTeamRegistry';
import { ArenaBuilderScreen } from '../ArenaBuilderScreen';
import { DeepMissionsScreen } from '../DeepMissionsScreen';
import { MissionControlRunDetail } from '../MissionControlRunDetail';
import { ProgressionObservatory } from '../ProgressionObservatory';
import { QuestMapSkillTree } from '../QuestMapSkillTree';

describe('Experience screens localization and polish contract', () => {
  test('main experience screens expose RU-first headings and gamification state labels', () => {
    const markup = [
      renderToStaticMarkup(<DeepMissionsScreen />),
      renderToStaticMarkup(<ArenaBuilderScreen />),
      renderToStaticMarkup(<MissionControlRunDetail />),
      renderToStaticMarkup(<ProgressionObservatory />),
      renderToStaticMarkup(<QuestMapSkillTree layer="game" />),
      renderToStaticMarkup(<AgentForgeTeamRegistry />),
    ].join('\n');

    for (const label of [
      'Долгие миссии',
      'Арена агентов',
      'Центр миссий',
      'Обсерватория прогресса',
      'Карта квестов',
      'Кузница агентов',
      'Индекс проверенного результата',
      'Очки качества',
      'Готовность к выполнению',
      'Разблокировано',
      'Заблокировано',
      'Наведение',
      'Фокус',
    ]) {
      expect(markup).toContain(label);
    }

    for (const staleEnglish of [
      'Experience Layer',
      'Deep Missions',
      'Arena Builder',
      'Progression Observatory',
      'Quest Map',
      'Team Registry',
    ]) {
      expect(markup).not.toContain(staleEnglish);
    }
  });

  test('experience microcopy does not leak English scaffolding in visible cards', () => {
    const markup = [
      renderToStaticMarkup(<ArenaBuilderScreen />),
      renderToStaticMarkup(<MissionControlRunDetail />),
      renderToStaticMarkup(<ProgressionObservatory />),
      renderToStaticMarkup(<AgentForgeTeamRegistry />),
    ].join('\n');

    for (const label of [
      'дельта VDI',
      'Сводка чекпоинта',
      'Кредиты',
      'Минимум доверия',
      'Обязательные гейты',
      'уровень',
      'Емкость, не качество.',
      'доверие 80',
      'Оценка доверия',
      'Проверка prompt-injection',
      'блокирует публичную публикацию',
    ]) {
      expect(markup).toContain(label);
    }

    for (const staleEnglish of [
      'VDI delta',
      ' summary',
      'Capacity, не качество.',
      'Credits',
      'Trust floor',
      'Required gates',
      'level ',
      'trust 80',
      'Trust score',
      'Prompt injection scan',
      'public publish',
      'team/private registry checks',
      'Team-private',
      'tenants',
    ]) {
      expect(markup).not.toContain(staleEnglish);
    }
  });
});
