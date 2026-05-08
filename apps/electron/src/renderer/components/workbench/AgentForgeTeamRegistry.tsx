import * as React from 'react';

import { Button } from '../ui/button';
import {
  createAgentForgeState,
  createAgentForgeStateFromTruth,
  getPackageTrustScore,
  installAgentPackage,
  listVisibleAgentPackages,
  publishAgentPackage,
  type AgentForgeState,
  type AgentForgeStateInput,
} from './agent-forge-state';
import type { ExperienceTruthState } from '@rox-agent/shared/workbench';
import {
  ExperienceCard,
  ExperienceMetricRow,
  ExperiencePanel,
  ExperienceProgressBar,
  ExperienceShell,
  ExperienceStateBlock,
  ExperienceStatusChip,
} from './experience-ui';

export interface AgentForgeTeamRegistryProps {
  initialState?: AgentForgeState;
  initialInput?: AgentForgeStateInput;
  truthState?: ExperienceTruthState;
}

export function AgentForgeTeamRegistry({ initialState, initialInput, truthState }: AgentForgeTeamRegistryProps) {
  const [state, setState] = React.useState<AgentForgeState>(() =>
    initialState ?? (truthState ? createAgentForgeStateFromTruth(truthState, initialInput) : createAgentForgeState(initialInput)),
  );
  const [lastAction, setLastAction] = React.useState<string>('Ожидает действия');
  const visiblePackages = listVisibleAgentPackages(state, { viewerTeamId: state.viewerTeamId });

  const runForgeAction = React.useCallback((action: () => AgentForgeState, successMessage: string) => {
    try {
      setState(action());
      setLastAction(successMessage);
    } catch (error) {
      setLastAction(error instanceof Error ? error.message : 'Действие кузницы заблокировано');
    }
  }, []);

  return (
    <ExperienceShell
      screen="agent-forge"
      tone="arena"
      eyebrow="Кузница"
      title="Кузница агентов"
      description="Создавайте, проверяйте, устанавливайте и форкайте приватные или командные пакеты до публичного каталога. Проверки доверия обязательны."
      aside={(
        <>
          <ExperiencePanel title="Проверочный гаунтлет" subtitle="Публичная публикация закрыта, пока эти проверки не пройдены.">
            <ExperienceMetricRow label="Контракт" value="обязателен" />
            <ExperienceMetricRow label="Ревью" value="обязательно" />
            <ExperienceMetricRow label="Тесты" value="обязательны" />
            <ExperienceMetricRow label="Проверка prompt-injection" value="блокирует публичную публикацию" />
          </ExperiencePanel>

          <ExperiencePanel title="Защитные правила реестра">
            <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
              <li>Публичный каталог выключен до прохождения проверок командного и приватного реестра.</li>
              <li>Пакеты без контрактов нельзя установить.</li>
              <li>Командно-приватные пакеты скрыты между рабочими пространствами.</li>
            </ul>
          </ExperiencePanel>
        </>
      )}
    >
      <ExperiencePanel title="Приватные и командные пакеты" subtitle="Каждый пакет должен иметь контракт, проверки и понятную оценку доверия.">
        <div className="mb-4 rounded-[16px] border border-cyan-300/20 bg-cyan-400/[0.06] p-3 text-sm text-cyan-100">
          Forge action: {lastAction}
        </div>
        {visiblePackages.length === 0 ? (
          <ExperienceStateBlock
            state="empty"
            title="Пакеты пока не найдены"
            description="Подключите приватный или командный пакет после прохождения контрактов, ревью, тестов и проверки prompt-injection."
            className="mt-4"
          />
        ) : (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {visiblePackages.map((pkg) => {
              const contract = state.contractsByPackageId[pkg.id];
              const warnings = state.promptInjectionWarningsByPackageId[pkg.id] ?? [];
              const trustScore = getPackageTrustScore(state, pkg.id);
              return (
                <ExperienceCard
                  key={pkg.id}
                  title={pkg.name}
                  meta={`${localizeVisibility(pkg.visibility)} / доверие ${trustScore}`}
                  tone={warnings.length > 0 ? 'danger' : contract ? 'success' : 'warning'}
                >
                  <p>{localizePackageDescription(pkg.description)}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <ExperienceStatusChip status={contract ? 'success' : 'blocking'} label={contract ? 'Контракт есть' : 'Контракт отсутствует'} />
                    <ExperienceStatusChip status={warnings.length === 0 ? 'success' : 'warning'} label={`Предупреждения: ${warnings.length}`} />
                    <ExperienceStatusChip status={contract ? 'ready' : 'locked'} label={contract ? 'Установка разрешена' : 'Установка заблокирована'} />
                    <ExperienceStatusChip status="draft" label="Форк доступен" />
                  </div>
                  <ExperienceProgressBar value={trustScore} label="Оценка доверия" />
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      className="rounded-full"
                      variant="outline"
                      disabled={state.installedPackageIds.includes(pkg.id)}
                      onClick={() => runForgeAction(() => installAgentPackage(state, pkg.id), `Пакет установлен: ${pkg.id}`)}
                    >
                      {state.installedPackageIds.includes(pkg.id) ? 'Установлен' : 'Установить'}
                    </Button>
                    <Button
                      className="rounded-full"
                      variant="outline"
                      onClick={() => runForgeAction(() => forkAgentPackage(state, pkg.id), `Форк создан: ${pkg.id}`)}
                    >
                      Форкнуть
                    </Button>
                    <Button
                      className="rounded-full"
                      variant="outline"
                      onClick={() => runForgeAction(() => publishAgentPackage(state, pkg.id, 'public'), `Опубликовано публично: ${pkg.id}`)}
                    >
                      Publish public
                    </Button>
                  </div>
                </ExperienceCard>
              );
            })}
          </div>
        )}
      </ExperiencePanel>
    </ExperienceShell>
  );
}

function forkAgentPackage(state: AgentForgeState, packageId: string): AgentForgeState {
  const source = state.packages.find((pkg) => pkg.id === packageId);
  if (!source) return state;
  const forkId = `${packageId}-team-fork-${state.packages.length + 1}`;
  return {
    ...state,
    packages: state.packages.concat({
      ...source,
      id: forkId,
      name: `${source.name} Team Fork`,
      visibility: 'team',
      ownerTeamId: state.viewerTeamId,
      ownerUserId: undefined,
      createdAt: '2026-04-30T00:00:00.000Z',
      updatedAt: '2026-04-30T00:00:00.000Z',
    }),
    contractsByPackageId: {
      ...state.contractsByPackageId,
      [forkId]: state.contractsByPackageId[packageId],
    },
    reviewsByPackageId: {
      ...state.reviewsByPackageId,
      [forkId]: state.reviewsByPackageId[packageId] ?? 0,
    },
    testsByPackageId: {
      ...state.testsByPackageId,
      [forkId]: state.testsByPackageId[packageId] ?? 0,
    },
    promptInjectionWarningsByPackageId: {
      ...state.promptInjectionWarningsByPackageId,
      [forkId]: state.promptInjectionWarningsByPackageId[packageId] ?? [],
    },
  };
}

function localizeVisibility(visibility: string): string {
  switch (visibility) {
    case 'team':
      return 'командный';
    case 'private':
      return 'приватный';
    case 'public':
      return 'публичный';
    case 'built_in':
      return 'встроенный';
    default:
      return visibility;
  }
}

function localizePackageDescription(description: string): string {
  if (description.includes('Private team reviewer')) return 'Приватный командный ревьюер для согласованности, доказательств и планов исправления.';
  if (description.includes('Legacy prompt pack')) return 'Устаревший prompt-пак без формального контракта.';
  if (description.includes('Persona candidate')) return 'Кандидат persona с незакрытым предупреждением prompt-injection.';
  return description;
}
