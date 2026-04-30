import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  ExperienceCard,
  ExperienceMetricCard,
  ExperiencePanel,
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
});
