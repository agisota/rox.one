import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  ExperienceCard,
  ExperienceMetricCard,
  ExperiencePanel,
  ExperienceProgressBar,
  ExperienceShell,
  ExperienceStatusChip,
} from '../experience-ui';

describe('Experience visual system', () => {
  test('renders a RU-first shell with premium typography and motion-safe interaction classes', () => {
    const markup = renderToStaticMarkup(
      <ExperienceShell
        screen="deep-missions"
        tone="arena"
        eyebrow="Слой опыта"
        title="Долгие миссии"
        description="Настройте 24-часовой прогон с чекпоинтами, бюджетом и проверяемым результатом."
        actions={<button type="button">Запустить миссию</button>}
      >
        <ExperienceCard interactive selected title="24ч Deep Run" meta="12 агентов">
          Каждые 6 часов система выпускает промежуточный артефакт.
        </ExperienceCard>
      </ExperienceShell>,
    );

    expect(markup).toContain('data-experience-screen="deep-missions"');
    expect(markup).toContain('Слой опыта');
    expect(markup).toContain('Долгие миссии');
    expect(markup).toContain('Запустить миссию');
    expect(markup).toContain('Geist');
    expect(markup).toContain('hover:-translate-y-0.5');
    expect(markup).toContain('focus-visible:ring-2');
    expect(markup).toContain('ease-[cubic-bezier(0.32,0.72,0,1)]');
    expect(markup).toContain('motion-reduce:transition-none');
  });

  test('renders status chips and metrics as explicit gamification states', () => {
    const markup = renderToStaticMarkup(
      <ExperiencePanel title="Проверка">
        <ExperienceStatusChip status="blocking" label="Блокер" />
        <ExperienceStatusChip status="success" label="Готово" />
        <ExperienceMetricCard label="VDI" value="86" tone="success" detail="artifact:final-fix-plan" />
      </ExperiencePanel>,
    );

    expect(markup).toContain('Проверка');
    expect(markup).toContain('Блокер');
    expect(markup).toContain('Готово');
    expect(markup).toContain('VDI');
    expect(markup).toContain('bg-rose-500/12');
    expect(markup).toContain('bg-emerald-500/12');
  });

  test('renders polished game and arena affordances with accessible state hooks', () => {
    const markup = renderToStaticMarkup(
      <div>
        <ExperienceCard interactive selected tone="arena" title="Swarm mission" meta={<ExperienceStatusChip status="running" label="В работе" />}>
          Стая агентов собирает сигналы, дедуплицирует шум и повышает VDI только по доказательствам.
        </ExperienceCard>
        <ExperienceCard interactive disabled title="Locked quest" meta={<ExperienceStatusChip status="locked" label="Заблокировано" />}>
          Квест откроется после прохождения validation gate.
        </ExperienceCard>
        <ExperienceProgressBar value={72} label="Прогресс VDI" />
      </div>,
    );

    expect(markup).toContain('data-selected="true"');
    expect(markup).toContain('data-disabled="true"');
    expect(markup).toContain('data-tone="arena"');
    expect(markup).toContain('data-status="running"');
    expect(markup).toContain('relative overflow-hidden');
    expect(markup).toContain('hover:before:opacity-100');
    expect(markup).toContain('motion-safe:animate-pulse');
    expect(markup).toContain('shadow-panel-focused');
    expect(markup).toContain('role="progressbar"');
    expect(markup).toContain('aria-valuenow="72"');
    expect(markup).toContain('bg-gradient-to-r from-cyan-300 via-sky-200 to-violet-300');
    expect(markup).toContain('motion-reduce:after:animate-none');
  });
});
