import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import { WorkbenchRoutePage } from '../WorkbenchRoutePage';
import { ExperiencePanel, ExperienceShell } from '../experience-ui';

describe('Mobile responsive web shell', () => {
  test('ExperienceShell exposes a mobile-first shell contract without horizontal overflow', () => {
    const markup = renderToStaticMarkup(
      <ExperienceShell
        screen="mobile-contract"
        eyebrow="Слой опыта"
        title="Мобильный штаб"
        description="Основные поверхности должны стековаться на телефоне без горизонтального скролла."
        actions={<button type="button">Запустить</button>}
        aside={<ExperiencePanel title="Правый контекст">Контекст должен уходить под основной поток.</ExperiencePanel>}
      >
        <ExperiencePanel title="Основной поток">Содержимое миссии должно оставаться доступным.</ExperiencePanel>
      </ExperienceShell>,
    );

    expect(markup).toContain('data-mobile-shell="true"');
    expect(markup).toContain('overflow-x-hidden');
    expect(markup).toContain('grid-cols-1');
    expect(markup).toContain('xl:grid-cols-[minmax(0,1.24fr)_minmax(340px,0.76fr)]');
    expect(markup).toContain('px-4');
    expect(markup).toContain('sm:px-6');
    expect(markup).toContain('w-full');
    expect(markup).toContain('sm:w-auto');
    expect(markup).toContain('order-last');
    expect(markup).toContain('xl:order-none');
  });

  test.each([
    'deep-missions',
    'arena-builder',
    'mission-control',
    'progression',
    'quest-map',
    'agent-forge',
  ] as const)('renders %s inside the mobile shell surface', (screen) => {
    const markup = renderToStaticMarkup(<WorkbenchRoutePage screen={screen} />);

    expect(markup).toContain(`data-workbench-screen="${screen}"`);
    expect(markup).toContain('data-mobile-shell="true"');
    expect(markup).toContain('min-w-0');
    expect(markup).toContain('max-w-full');
  });
});
