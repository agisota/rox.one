import * as React from 'react';

import {
  createAgentForgeState,
  getPackageTrustScore,
  listVisibleAgentPackages,
  type AgentForgeState,
  type AgentForgeStateInput,
} from './agent-forge-state';
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
}

export function AgentForgeTeamRegistry({ initialState, initialInput }: AgentForgeTeamRegistryProps) {
  const [state] = React.useState<AgentForgeState>(() => initialState ?? createAgentForgeState(initialInput));
  const visiblePackages = listVisibleAgentPackages(state, { viewerTeamId: state.viewerTeamId });

  return (
    <ExperienceShell
      screen="agent-forge"
      tone="arena"
      eyebrow="Кузница"
      title="Кузница агентов"
      description="Создавайте, проверяйте, устанавливайте и форкайте приватные или командные пакеты до публичного marketplace. Trust checks обязательны."
      aside={(
        <>
          <ExperiencePanel title="Проверочный гаунтлет" subtitle="Публичная публикация закрыта, пока эти проверки не пройдены.">
            <ExperienceMetricRow label="Контракт" value="обязателен" />
            <ExperienceMetricRow label="Ревью" value="обязательно" />
            <ExperienceMetricRow label="Тесты" value="обязательны" />
            <ExperienceMetricRow label="Prompt injection scan" value="блокирует public publish" />
          </ExperiencePanel>

          <ExperiencePanel title="Защитные правила реестра">
            <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
              <li>Публичный marketplace выключен до прохождения team/private registry checks.</li>
              <li>Пакеты без контрактов нельзя установить.</li>
              <li>Team-private пакеты скрыты между tenants.</li>
            </ul>
          </ExperiencePanel>
        </>
      )}
    >
      <ExperiencePanel title="Приватные и командные пакеты" subtitle="Каждый пакет должен иметь контракт, проверки и понятный trust score.">
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {visiblePackages.map((pkg) => {
              const contract = state.contractsByPackageId[pkg.id];
              const warnings = state.promptInjectionWarningsByPackageId[pkg.id] ?? [];
              const trustScore = getPackageTrustScore(state, pkg.id);
              return (
                <ExperienceCard
                  key={pkg.id}
                  title={pkg.name}
                  meta={`${localizeVisibility(pkg.visibility)} / trust ${trustScore}`}
                  tone={warnings.length > 0 ? 'danger' : contract ? 'success' : 'warning'}
                >
                  <p>{localizePackageDescription(pkg.description)}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <ExperienceStatusChip status={contract ? 'success' : 'blocking'} label={contract ? 'Контракт есть' : 'Контракт отсутствует'} />
                    <ExperienceStatusChip status={warnings.length === 0 ? 'success' : 'warning'} label={`Предупреждения: ${warnings.length}`} />
                    <ExperienceStatusChip status={contract ? 'ready' : 'locked'} label={contract ? 'Установить' : 'Заблокировано'} />
                    <ExperienceStatusChip status="draft" label="Форкнуть" />
                  </div>
                  <ExperienceProgressBar value={trustScore} label="Trust score" />
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
  if (description.includes('Private team reviewer')) return 'Приватный командный reviewer для consistency, evidence и fix plans.';
  if (description.includes('Legacy prompt pack')) return 'Legacy prompt pack без формального контракта.';
  if (description.includes('Persona candidate')) return 'Кандидат persona с unresolved prompt-injection warning.';
  return description;
}
