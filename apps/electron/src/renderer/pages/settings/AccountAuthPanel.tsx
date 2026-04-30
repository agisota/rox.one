import * as React from 'react'
import { Button } from '@/components/ui/button'
import { SettingsCard, SettingsInput } from '@/components/settings'
import { SettingsRow } from '@/components/settings/SettingsRow'

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
  saving?: boolean
  onSubmit: (tab: AccountAuthTab, request: NativeAccountAuthRequest) => void | Promise<void>
  onRefresh?: () => void
}

const ACCOUNT_AUTH_TABS: Array<{ id: AccountAuthTab; label: string }> = [
  { id: 'sign-in', label: 'Вход' },
  { id: 'register', label: 'Регистрация' },
  { id: 'reset', label: 'Сброс пароля' },
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

export function AccountAuthPanel({ error, saving = false, onSubmit, onRefresh }: AccountAuthPanelProps) {
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

  return (
    <SettingsCard>
      <form className="space-y-4" onSubmit={submit} aria-label="Native account authentication">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Account auth mode">
          {ACCOUNT_AUTH_TABS.map((tab) => (
            <Button
              key={tab.id}
              type="button"
              size="sm"
              variant={activeTab === tab.id ? 'default' : 'outline'}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </Button>
          ))}
        </div>

        {activeTab === 'register' && (
          <SettingsInput label="Display name" value={displayName} onChange={setDisplayName} placeholder="ROX User" inCard />
        )}
        <SettingsInput label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" inCard />
        {requiresPassword && (
          <SettingsInput label="Password" type="password" value={password} onChange={setPassword} placeholder="Minimum 8 characters" inCard />
        )}

        <SettingsRow
          label={activeTab === 'reset' ? 'Сброс пароля' : activeTab === 'register' ? 'Регистрация' : 'Вход'}
          description="Форма работает внутри ROX ONE и отправляет запросы напрямую в account API."
          action={(
            <div className="flex flex-wrap justify-end gap-2">
              {onRefresh && <Button type="button" size="sm" variant="outline" onClick={onRefresh}>Обновить кабинет</Button>}
              <Button type="submit" size="sm" disabled={saving || !canSubmit}>
                {activeTab === 'reset' ? 'Отправить ссылку' : activeTab === 'register' ? 'Создать аккаунт' : 'Войти'}
              </Button>
            </div>
          )}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
      </form>
    </SettingsCard>
  )
}
