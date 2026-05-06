import * as React from 'react'
import { MailCheck, ShieldCheck, Sparkles, Trophy, Users, WalletCards } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SettingsCard, SettingsInput } from '@/components/settings'
import { cn } from '@/lib/utils'

export type AccountAuthTab = 'sign-in' | 'register' | 'reset'

export interface NativeAccountAuthFields {
  displayName?: string
  email: string
  password?: string
}

export interface NativeAccountAuthRequest {
  path: '/api/auth/login' | '/api/auth/register' | '/api/auth/password-reset/request'
  method: 'POST'
  body: Record<string, string>
}

export interface AccountAuthPanelProps {
  error?: string | null
  success?: string | null
  saving?: boolean
  onSubmit: (tab: AccountAuthTab, request: NativeAccountAuthRequest) => void | Promise<void>
  onRefresh?: () => void
}

const ACCOUNT_AUTH_TABS: Array<{ id: AccountAuthTab; label: string }> = [
  { id: 'sign-in', label: 'Вход' },
  { id: 'register', label: 'Регистрация' },
  { id: 'reset', label: 'Сброс пароля' },
]

const ROX_ID_FEATURES = [
  { label: 'Профиль', description: 'ROX ID, безопасность и подтверждение email', icon: ShieldCheck },
  { label: 'Баланс', description: 'Кредиты, лимиты и история операций', icon: WalletCards },
  { label: 'Команды', description: 'Spaces, роли и совместные миссии', icon: Users },
  { label: 'Прогресс', description: 'VDI, квесты и награды Experience Layer', icon: Trophy },
]

export function createNativeAccountAuthRequest(tab: AccountAuthTab, fields: NativeAccountAuthFields): NativeAccountAuthRequest {
  const email = fields.email.trim()
  const password = fields.password?.trim() ?? ''
  const displayName = fields.displayName?.trim() ?? ''

  if (tab === 'register') {
    return {
      path: '/api/auth/register',
      method: 'POST',
      body: { displayName, email, password },
    }
  }

  if (tab === 'reset') {
    return {
      path: '/api/auth/password-reset/request',
      method: 'POST',
      body: { email },
    }
  }

  return {
    path: '/api/auth/login',
    method: 'POST',
    body: { email, password },
  }
}

export function isAllowedAccountExternalUrl(value?: string | null): boolean {
  if (!value) return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && (url.hostname === 'dv.net' || url.hostname.endsWith('.dv.net'))
  } catch {
    return false
  }
}

export function AccountAuthPanel({ error, success, saving = false, onSubmit, onRefresh }: AccountAuthPanelProps) {
  const [activeTab, setActiveTab] = React.useState<AccountAuthTab>('sign-in')
  const [displayName, setDisplayName] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')

  const requiresPassword = activeTab !== 'reset'
  const canSubmit = email.trim().length > 3 && (!requiresPassword || password.trim().length >= 8)

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSubmit || saving) return
    void onSubmit(activeTab, createNativeAccountAuthRequest(activeTab, { displayName, email, password }))
  }

  const currentTabLabel = ACCOUNT_AUTH_TABS.find(tab => tab.id === activeTab)?.label ?? 'Вход'
  const statusMessage = success || error || null
  const statusTone = success ? 'success' : error ? 'error' : 'idle'

  return (
    <SettingsCard
      divided={false}
      className="border border-border/70 bg-background/95 shadow-strong"
    >
      <form
        data-auth-surface="rox-id"
        className="grid gap-6 p-5 lg:grid-cols-[minmax(280px,0.9fr)_minmax(360px,1fr)] xl:p-6"
        onSubmit={submit}
        aria-label="Native account authentication"
      >
        <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-muted/20 p-5">
          <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/70 to-transparent" />
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl border border-cyan-300/30 bg-cyan-300/10 text-cyan-200">
              <Sparkles className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">Личный кабинет</p>
              <h2 className="text-2xl font-semibold text-foreground">ROX ID</h2>
            </div>
          </div>

          <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
            Один встроенный аккаунт для профиля, баланса, команд, публичных ссылок сессий и персонального прогресса.
            Регистрация требует подтверждения email, поэтому качество и доступы не подменяются локальным статусом формы.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {ROX_ID_FEATURES.map((feature) => {
              const Icon = feature.icon
              return (
                <div
                  key={feature.label}
                  className="group rounded-xl border border-border/70 bg-background/70 p-3 transition duration-200 hover:-translate-y-0.5 hover:border-cyan-300/40 hover:bg-background"
                >
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Icon className="size-4 text-cyan-200 transition-colors group-hover:text-emerald-200" aria-hidden="true" />
                    {feature.label}
                  </div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{feature.description}</p>
                </div>
              )
            })}
          </div>

          <div className="mt-5 rounded-xl border border-emerald-300/20 bg-emerald-300/5 px-4 py-3 text-xs leading-5 text-emerald-100/90">
            Сессия считается активной только после ответа `/api/account/me`. Ошибки проверки email показываются как состояние ожидания,
            а не как авария приложения.
          </div>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card/70 p-4 shadow-minimal">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase text-muted-foreground">Действие ROX ID</p>
              <h3 className="text-xl font-semibold text-foreground">{currentTabLabel}</h3>
            </div>
            <div className="rounded-full border border-border bg-background/80 p-1" role="tablist" aria-label="Account auth mode">
              {ACCOUNT_AUTH_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground transition duration-200 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                    activeTab === tab.id && 'bg-foreground text-background shadow-minimal hover:text-background',
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {activeTab === 'register' && (
              <SettingsInput label="Имя в профиле" value={displayName} onChange={setDisplayName} placeholder="ROX User" disabled={saving} />
            )}
            <SettingsInput label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" disabled={saving} />
            {requiresPassword && (
              <SettingsInput label="Пароль" type="password" value={password} onChange={setPassword} placeholder="Минимум 8 символов" disabled={saving} />
            )}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/70 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                {activeTab === 'reset' ? 'Восстановление доступа' : activeTab === 'register' ? 'Создание ROX ID' : 'Вход в кабинет'}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Запрос отправляется внутри приложения напрямую в account API. Внешний браузер не открывается.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap justify-end gap-2">
              {onRefresh && <Button type="button" size="sm" variant="outline" onClick={onRefresh} disabled={saving}>Обновить</Button>}
              <Button type="submit" size="sm" disabled={saving || !canSubmit}>
                {saving ? 'Отправка...' : activeTab === 'reset' ? 'Отправить ссылку' : activeTab === 'register' ? 'Создать аккаунт' : 'Войти'}
              </Button>
            </div>
          </div>

          {statusMessage && (
            <div
              className={cn(
                'mt-4 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm leading-5',
                statusTone === 'success'
                  ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-100'
                  : 'border-red-400/30 bg-red-400/10 text-red-100',
              )}
            >
              {statusTone === 'success' ? (
                <MailCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              ) : (
                <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              )}
              <span>{statusMessage}</span>
            </div>
          )}
        </div>
      </form>
    </SettingsCard>
  )
}
