import * as React from 'react';

import { cn } from '@/lib/utils';

export type ExperienceTone = 'command' | 'game' | 'arena' | 'success' | 'warning' | 'danger' | 'neutral';
export type ExperienceStatus = 'ready' | 'running' | 'queued' | 'completed' | 'locked' | 'warning' | 'blocking' | 'success' | 'draft';
export type ExperienceSurfaceState = 'loading' | 'empty' | 'error';

const motionClass = 'transition-[transform,box-shadow,border-color,background-color,opacity] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none';
const interactiveSurfaceClass = cn(
  "before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit] before:content-['']",
  'before:bg-gradient-to-br before:from-white/10 before:via-transparent before:to-cyan-300/10',
  'before:opacity-0 before:transition-opacity before:duration-300',
  "after:pointer-events-none after:absolute after:inset-px after:rounded-[17px] after:content-['']",
  'after:border after:border-white/[0.06] after:opacity-0 after:transition-opacity after:duration-300',
  'motion-reduce:before:transition-none motion-reduce:after:transition-none',
);
const runningStatusPulseClass = "after:absolute after:inset-0 after:rounded-full after:bg-sky-200/10 after:content-[''] motion-safe:after:animate-pulse motion-reduce:after:animate-none";
const progressFillClass = cn(
  "relative h-full rounded-full bg-gradient-to-r from-cyan-300 via-sky-200 to-violet-300 shadow-tinted after:absolute after:inset-0 after:bg-white/20 after:opacity-0 after:content-['']",
  'motion-safe:after:animate-pulse motion-reduce:after:animate-none',
);

const toneClasses: Record<ExperienceTone, string> = {
  command: 'border-cyan-400/20 bg-cyan-400/[0.06] text-cyan-100',
  game: 'border-violet-400/20 bg-violet-400/[0.07] text-violet-100',
  arena: 'border-amber-400/25 bg-amber-400/[0.07] text-amber-100',
  success: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-100',
  warning: 'border-amber-500/25 bg-amber-500/10 text-amber-100',
  danger: 'border-rose-500/25 bg-rose-500/10 text-rose-100',
  neutral: 'border-white/10 bg-white/[0.035] text-foreground',
};

const statusClasses: Record<ExperienceStatus, string> = {
  ready: 'border-cyan-400/25 bg-cyan-500/12 text-cyan-100',
  running: 'border-sky-400/25 bg-sky-500/12 text-sky-100',
  queued: 'border-white/10 bg-white/[0.045] text-muted-foreground',
  completed: 'border-emerald-400/25 bg-emerald-500/12 text-emerald-100',
  locked: 'border-white/10 bg-white/[0.03] text-muted-foreground',
  warning: 'border-amber-400/25 bg-amber-500/12 text-amber-100',
  blocking: 'border-rose-400/25 bg-rose-500/12 text-rose-100',
  success: 'border-emerald-400/25 bg-emerald-500/12 text-emerald-100',
  draft: 'border-violet-400/20 bg-violet-500/10 text-violet-100',
};

const surfaceStateClasses: Record<ExperienceSurfaceState, string> = {
  loading: 'border-sky-400/20 bg-sky-500/[0.07] text-sky-100',
  empty: 'border-white/10 bg-white/[0.035] text-foreground',
  error: 'border-rose-400/25 bg-rose-500/[0.09] text-rose-100',
};

export const EXPERIENCE_INTERACTION_HINTS = ['Наведение', 'Фокус', 'Активно'] as const;

export function ExperienceShell({
  screen,
  tone = 'command',
  eyebrow,
  title,
  description,
  actions,
  children,
  aside,
  className,
}: {
  screen: string;
  tone?: ExperienceTone;
  eyebrow: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  aside?: React.ReactNode;
  className?: string;
}) {
  return (
    <main
      data-experience-screen={screen}
      data-mobile-shell="true"
      style={{ fontFamily: '"Geist", "SF Pro Text", ui-sans-serif, system-ui, sans-serif' }}
      className={cn('experience-surface flex h-full min-h-0 min-w-0 max-w-full flex-col overflow-x-hidden bg-[#08090d] text-foreground', className)}
      aria-label={title}
    >
      <header className="border-b border-white/[0.07] px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn('rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em]', toneClasses[tone])}>
                {eyebrow}
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Единая модель
              </span>
            </div>
            <h1 className="mt-3 text-[28px] font-semibold leading-tight tracking-normal text-foreground">{title}</h1>
            <p className="mt-2 max-w-4xl text-[15px] leading-6 text-muted-foreground">{description}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground" aria-label="Состояния интерфейса">
              {EXPERIENCE_INTERACTION_HINTS.map((hint) => (
                <span key={hint} className="rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1">
                  {hint}
                </span>
              ))}
            </div>
          </div>
          {actions && <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">{actions}</div>}
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-x-hidden overflow-y-auto p-3 sm:p-4 xl:grid-cols-[minmax(0,1.24fr)_minmax(340px,0.76fr)] xl:overflow-hidden">
        <section className="min-h-0 min-w-0 max-w-full overflow-y-auto rounded-[24px] border border-white/[0.07] bg-white/[0.025] p-2 shadow-thin">
          <div className="min-h-full rounded-[18px] border border-white/[0.06] bg-[#0b0d12] p-4">
            {children}
          </div>
        </section>
        {aside && <aside className="order-last min-h-0 min-w-0 max-w-full space-y-4 overflow-y-visible xl:order-none xl:overflow-y-auto">{aside}</aside>}
      </div>
    </main>
  );
}

export function ExperiencePanel({
  title,
  subtitle,
  children,
  tone = 'neutral',
  className,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  tone?: ExperienceTone;
  className?: string;
}) {
  return (
    <section data-tone={tone} className={cn('relative overflow-hidden rounded-[22px] border bg-[#0b0d12] p-1 shadow-thin', toneClasses[tone], className)}>
      <div className="rounded-[17px] border border-white/[0.06] bg-[#090b10] p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold leading-tight">{title}</h2>
            {subtitle && <p className="mt-1 text-sm leading-5 text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        {children}
      </div>
    </section>
  );
}

export function ExperienceCard({
  title,
  meta,
  children,
  selected = false,
  interactive = false,
  disabled = false,
  tone = 'neutral',
  className,
  ...props
}: React.HTMLAttributes<HTMLElement> & {
  title: string;
  meta?: React.ReactNode;
  selected?: boolean;
  interactive?: boolean;
  disabled?: boolean;
  tone?: ExperienceTone;
}) {
  const Component = interactive ? 'button' : 'article';
  return (
    <Component
      {...props}
      type={interactive ? 'button' : undefined}
      disabled={interactive ? disabled : undefined}
      aria-pressed={interactive ? selected : undefined}
      aria-disabled={disabled || undefined}
      data-selected={selected ? 'true' : 'false'}
      data-disabled={disabled ? 'true' : 'false'}
      data-tone={tone}
      className={cn(
        'group relative overflow-hidden block w-full rounded-[18px] border p-4 text-left shadow-thin',
        motionClass,
        interactive && cn(interactiveSurfaceClass, 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/40 focus-visible:before:opacity-100 active:scale-[0.99] hover:-translate-y-0.5 hover:before:opacity-100 hover:after:opacity-100 hover:shadow-tinted motion-safe:hover:-translate-y-0.5'),
        selected
          ? 'border-cyan-300/40 bg-cyan-300/12 text-foreground shadow-panel-focused'
          : toneClasses[tone],
        disabled && 'cursor-not-allowed opacity-60 hover:translate-y-0 hover:before:opacity-0 hover:after:opacity-0 active:scale-100',
        className,
      )}
    >
      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[15px] font-semibold leading-5">{title}</div>
          {meta && <div className="mt-1 text-xs leading-5 text-muted-foreground">{meta}</div>}
        </div>
      </div>
      <div className="relative z-10 mt-3 text-sm leading-6 text-muted-foreground">{children}</div>
    </Component>
  );
}

export function ExperienceMetricCard({
  label,
  value,
  detail,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: ExperienceTone;
}) {
  return (
    <div data-tone={tone} className={cn('group relative overflow-hidden rounded-[18px] border p-4 shadow-thin hover:border-white/20 hover:bg-white/[0.055]', motionClass, toneClasses[tone])}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className="mt-2 text-3xl font-semibold leading-none">{value}</div>
      {detail && <div className="mt-2 text-xs leading-5 text-muted-foreground">{detail}</div>}
    </div>
  );
}

export function ExperienceMetricRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="mt-3 flex items-center justify-between gap-4 border-b border-white/[0.07] pb-2 last:border-b-0 last:pb-0">
      <span className="min-w-0 text-sm leading-5 text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-semibold leading-5 text-foreground">{value}</span>
    </div>
  );
}

export function ExperienceStatusChip({
  status,
  label,
  className,
}: {
  status: ExperienceStatus;
  label: string;
  className?: string;
}) {
  return (
    <span
      data-status={status}
      className={cn(
        'relative inline-flex items-center overflow-hidden rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-none',
        motionClass,
        statusClasses[status],
        status === 'running' && runningStatusPulseClass,
        className,
      )}
    >
      <span aria-hidden="true" className={cn('relative z-10 mr-1.5 h-1.5 w-1.5 rounded-full bg-current opacity-80', status === 'running' && 'motion-safe:animate-pulse')} />
      <span className="relative z-10">{label}</span>
    </span>
  );
}

export function ExperienceProgressBar({ value, label }: { value: number; label?: string }) {
  const safeValue = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="mt-3">
      {label && <div className="mb-1 text-xs text-muted-foreground">{label}</div>}
      <div
        role="progressbar"
        aria-label={label ?? 'Progress'}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={safeValue}
        className="relative h-2.5 overflow-hidden rounded-full bg-white/[0.06]"
      >
        <div
          className={cn(progressFillClass, motionClass)}
          style={{ transform: `scaleX(${safeValue / 100})`, transformOrigin: 'left center' }}
        />
      </div>
    </div>
  );
}

export function ExperienceStateBlock({
  state,
  title,
  description,
  action,
  className,
}: {
  state: ExperienceSurfaceState;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      role="status"
      aria-live="polite"
      data-state={state}
      className={cn('min-w-0 overflow-hidden rounded-[18px] border p-4 shadow-thin', motionClass, surfaceStateClasses[state], className)}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span
          aria-hidden="true"
          className={cn(
            'mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-current opacity-80',
            state === 'loading' && 'motion-safe:animate-pulse motion-reduce:animate-none',
          )}
        />
        <div className="min-w-0 flex-1">
          <h3 className="break-words text-[15px] font-semibold leading-5">{title}</h3>
          <p className="mt-2 break-words text-sm leading-6 text-muted-foreground">{description}</p>
          {action && <div className="mt-3 flex min-w-0 flex-wrap gap-2">{action}</div>}
        </div>
      </div>
    </section>
  );
}

export function ExperienceSkeletonCard({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <div
      aria-label={label}
      role="status"
      className={cn('min-w-0 overflow-hidden rounded-[18px] border border-white/10 bg-white/[0.035] p-4 shadow-thin', className)}
    >
      <span className="sr-only">{label}</span>
      <div className="h-3 w-28 rounded-full bg-white/10 motion-safe:animate-pulse motion-reduce:animate-none" />
      <div className="mt-4 h-8 rounded-[12px] bg-white/[0.07] motion-safe:animate-pulse motion-reduce:animate-none" />
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <div className="h-3 rounded-full bg-white/[0.06] motion-safe:animate-pulse motion-reduce:animate-none" />
        <div className="h-3 rounded-full bg-white/[0.06] motion-safe:animate-pulse motion-reduce:animate-none" />
        <div className="h-3 rounded-full bg-white/[0.06] motion-safe:animate-pulse motion-reduce:animate-none" />
      </div>
    </div>
  );
}

export function getStatusLabel(status: string): string {
  switch (status) {
    case 'completed':
    case 'pass':
      return 'Готово';
    case 'running':
      return 'В работе';
    case 'queued':
      return 'В очереди';
    case 'locked':
      return 'Заблокировано';
    case 'available':
      return 'Доступно';
    case 'warn':
      return 'Предупреждение';
    case 'fail':
      return 'Провалено';
    case 'draft':
      return 'Черновик';
    case 'pending':
      return 'Ожидает';
    default:
      return status;
  }
}

export function getStatusTone(status: string, blocking = false): ExperienceStatus {
  if (blocking) return 'blocking';
  switch (status) {
    case 'completed':
    case 'pass':
      return 'completed';
    case 'running':
      return 'running';
    case 'queued':
      return 'queued';
    case 'locked':
      return 'locked';
    case 'available':
      return 'ready';
    case 'warn':
      return 'warning';
    case 'fail':
      return 'blocking';
    case 'draft':
      return 'draft';
    case 'pending':
      return 'warning';
    default:
      return 'queued';
  }
}
