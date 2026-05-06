import * as React from 'react';

import {
  createAgentForgeState,
  createAgentForgeStateFromTruth,
  getPackageTrustScore,
  listVisibleAgentPackages,
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
  ExperienceStatusChip,
} from './experience-ui';

export interface AgentForgeTeamRegistryProps {
  initialState?: AgentForgeState;
  initialInput?: AgentForgeStateInput;
  truthState?: ExperienceTruthState;
}

export function AgentForgeTeamRegistry({ initialState, initialInput, truthState }: AgentForgeTeamRegistryProps) {
  const [state] = React.useState<AgentForgeState>(() =>
    initialState ?? (truthState ? createAgentForgeStateFromTruth(truthState, initialInput) : createAgentForgeState(initialInput)),
  );
  const visiblePackages = listVisibleAgentPackages(state, { viewerTeamId: state.viewerTeamId });

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
                    <ExperienceStatusChip status={contract ? 'ready' : 'locked'} label={contract ? 'Установить' : 'Заблокировано'} />
                    <ExperienceStatusChip status="draft" label="Форкнуть" />
                  </div>
                  <ExperienceProgressBar value={trustScore} label="Оценка доверия" />
                </ExperienceCard>
              );
            })}
          </div>
      </ExperiencePanel>
    </ExperienceShell>
  );
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
