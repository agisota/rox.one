import * as React from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PanelHeader } from '@/components/app-shell/PanelHeader'
import { HeaderMenu } from '@/components/ui/HeaderMenu'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { routes } from '@/lib/navigate'
import { Spinner } from '@rox-agent/ui'
import { SettingsCard, SettingsInput, SettingsSection } from '@/components/settings'
import { SettingsRow } from '@/components/settings/SettingsRow'
import type { DetailsPageMeta } from '@/lib/navigation-registry'

const ACCOUNT_WEB_ORIGIN = 'https://rox.one'
const ACCOUNT_LOGIN_PATH = '/login'
const ACCOUNT_SIGNUP_PATH = '/login?tab=register'
const ACCOUNT_RESET_PATH = '/login?tab=reset-request'

type AccountApiInit = {
  method?: string
  headers?: Record<string, string>
  body?: string | null
}

interface AccountUser {
  id: string
  email: string
  displayName: string | null
  role: string
  status: string
  emailVerifiedAt: string | null
  createdAt?: string
  updatedAt?: string
}

interface AccountSession {
  id: string
  userAgent: string | null
  ipAddress: string | null
  authMethod: string
  createdAt: string
  expiresAt: string
  revokedAt: string | null
}

interface AccountBalance {
  userId?: string
  balanceUnits: number
  currency: string
  updatedAt: string | null
}

interface BillingResponse {
  balance: AccountBalance
  topUp: {
    enabled: boolean
    provider: string
    url: string | null
  }
}

interface AccountEvent {
  id: string
  type: string
  title: string
  details: unknown
  createdAt: string
}

interface AccountOrganization {
  id: string
  name: string
  slug: string
  role: string
  status: string
  createdAt: string
  updatedAt?: string
}

interface AccountResponse {
  mode: 'account' | 'legacy'
  user: AccountUser | null
  currentSessionId?: string
}

interface SessionsResponse {
  currentSessionId: string
  sessions: AccountSession[]
}

interface DesktopBridgeResponse {
  ok: boolean
  status: number
  body: string
}

export const meta: DetailsPageMeta = {
  navigator: 'settings',
  slug: 'account',
}

async function readError(res: Response): Promise<string> {
  try {
    const body = await res.json() as { error?: string | { message?: string } }
    if (typeof body.error === 'string') return body.error
    return body.error?.message || `HTTP ${res.status}`
  } catch {
    return `HTTP ${res.status}`
  }
}

function readBridgeError(status: number, body: string): string {
  try {
    const parsed = JSON.parse(body) as { error?: string | { message?: string } }
    if (typeof parsed.error === 'string') return parsed.error
    return parsed.error?.message || `HTTP ${status}`
  } catch {
    return body || `HTTP ${status}`
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function detailsText(value: unknown): string {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (typeof value !== 'object') return String(value)
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== null && item !== undefined && String(item).length > 0)
    .slice(0, 4)
  return entries.map(([key, item]) => `${key}: ${String(item)}`).join(' / ')
}

function isRoxAccountUrl(value?: string | null): boolean {
  if (!value) return false
  try {
    const url = new URL(value)
    return url.origin === ACCOUNT_WEB_ORIGIN && url.pathname === '/account'
  } catch {
    return false
  }
}

export default function AccountSettingsPage() {
  const { t } = useTranslation()
  const bridgePaneIdRef = useRef<string | null>(null)
  const visibleAuthPaneIdRef = useRef<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [account, setAccount] = useState<AccountResponse | null>(null)
  const [billing, setBilling] = useState<BillingResponse | null>(null)
  const [sessions, setSessions] = useState<SessionsResponse | null>(null)
  const [events, setEvents] = useState<AccountEvent[]>([])
  const [organizations, setOrganizations] = useState<AccountOrganization[]>([])
  const [displayName, setDisplayName] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newOrganizationName, setNewOrganizationName] = useState('')
  const [joinCode, setJoinCode] = useState('')

  const isHostedHttp = window.location.protocol === 'http:' || window.location.protocol === 'https:'

  const formatDate = (value?: string | null): string => {
    if (!value) return t('settings.account.never')
    return new Date(value).toLocaleString()
  }

  const formatBalance = (value?: AccountBalance | null): string => {
    if (!value) return '0 ROX'
    return `${Number(value.balanceUnits || 0).toLocaleString('ru-RU')} ${value.currency || 'ROX'}`
  }

  const openAccountUrl = useCallback(async (url: string) => {
    if (isHostedHttp) {
      window.location.href = url
      return
    }

    try {
      const instanceId = await window.electronAPI.browserPane.create({
        show: true,
        initialUrl: url,
        hostMode: 'embedded',
      })
      visibleAuthPaneIdRef.current = instanceId
      await window.electronAPI.browserPane.focus(instanceId)
    } catch (err) {
      console.error('[AccountSettings] Failed to open account browser tab:', err)
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [isHostedHttp])

  const openAccountPath = useCallback(async (path: string) => {
    await openAccountUrl(`${ACCOUNT_WEB_ORIGIN}${path}`)
  }, [openAccountUrl])

  const ensureDesktopBridge = useCallback(async (): Promise<string> => {
    if (bridgePaneIdRef.current) return bridgePaneIdRef.current
    const instanceId = await window.electronAPI.browserPane.create({
      show: false,
      initialUrl: `${ACCOUNT_WEB_ORIGIN}/account`,
      hostMode: 'embedded',
    })
    bridgePaneIdRef.current = instanceId
    await sleep(900)
    return instanceId
  }, [])

  const accountApi = useCallback(async <T,>(path: string, init: AccountApiInit = {}): Promise<T> => {
    if (isHostedHttp) {
      const res = await fetch(path, {
        method: init.method || 'GET',
        headers: init.headers,
        body: init.body ?? undefined,
        credentials: 'same-origin',
      })
      if (!res.ok) throw new Error(await readError(res))
      return await res.json() as T
    }

    const paneId = await ensureDesktopBridge()
    const request = {
      url: `${ACCOUNT_WEB_ORIGIN}${path}`,
      method: init.method || 'GET',
      headers: init.headers || {},
      body: init.body ?? null,
    }
    const expression = `(() => {
      const request = ${JSON.stringify(request)};
      return fetch(request.url, {
        method: request.method,
        headers: request.headers,
        body: request.body === null ? undefined : request.body,
        credentials: 'include'
      }).then(async (res) => ({ ok: res.ok, status: res.status, body: await res.text() }));
    })()`
    const result = await window.electronAPI.browserPane.evaluate(paneId, expression) as DesktopBridgeResponse
    if (!result.ok) throw new Error(readBridgeError(result.status, result.body))
    return JSON.parse(result.body || '{}') as T
  }, [ensureDesktopBridge, isHostedHttp])

  const loadAccount = useCallback(async () => {
    setError(null)
    try {
      const accountData = await accountApi<AccountResponse>('/api/account/me')
      setAccount(accountData)
      setDisplayName(accountData.user?.displayName ?? '')

      if (accountData.mode === 'account' && accountData.user) {
        const [billingResult, sessionsResult, eventsResult, organizationsResult] = await Promise.allSettled([
          accountApi<BillingResponse>('/api/account/billing'),
          accountApi<SessionsResponse>('/api/account/sessions'),
          accountApi<{ events: AccountEvent[] }>('/api/account/events'),
          accountApi<{ organizations: AccountOrganization[] }>('/api/account/organizations'),
        ])

        setBilling(billingResult.status === 'fulfilled' ? billingResult.value : null)
        setSessions(sessionsResult.status === 'fulfilled' ? sessionsResult.value : null)
        setEvents(eventsResult.status === 'fulfilled' ? eventsResult.value.events : [])
        setOrganizations(organizationsResult.status === 'fulfilled' ? organizationsResult.value.organizations : [])
      }
    } catch (err) {
      setAccount(null)
      setBilling(null)
      setSessions(null)
      setEvents([])
      setOrganizations([])
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [accountApi])

  useEffect(() => {
    void loadAccount()
  }, [loadAccount])

  useEffect(() => {
    if (isHostedHttp || !window.electronAPI?.browserPane?.list) return

    void window.electronAPI.browserPane.list().then((instances) => {
      for (const instance of instances) {
        if (instance.id === bridgePaneIdRef.current) continue
        if (!isRoxAccountUrl(instance.url)) continue
        void window.electronAPI.browserPane.destroy(instance.id).catch((err) => {
          console.warn('[AccountSettings] Failed to close restored account browser tab:', err)
        })
      }
    }).catch((err) => {
      console.warn('[AccountSettings] Failed to inspect restored browser tabs:', err)
    })
  }, [isHostedHttp])

  useEffect(() => {
    if (isHostedHttp || !window.electronAPI?.browserPane?.onStateChanged) return undefined

    const cleanupState = window.electronAPI.browserPane.onStateChanged((info) => {
      if (!visibleAuthPaneIdRef.current || info.id !== visibleAuthPaneIdRef.current) return

      if (!isRoxAccountUrl(info.url)) return

      const paneId = visibleAuthPaneIdRef.current
      visibleAuthPaneIdRef.current = null
      window.setTimeout(() => {
        void window.electronAPI.browserPane.destroy(paneId).catch((err) => {
          console.warn('[AccountSettings] Failed to close auth browser tab after login:', err)
        })
        void loadAccount()
      }, 350)
    })

    const cleanupRemoved = window.electronAPI.browserPane.onRemoved((id) => {
      if (visibleAuthPaneIdRef.current === id) {
        visibleAuthPaneIdRef.current = null
        void loadAccount()
      }
    })

    return () => {
      cleanupState()
      cleanupRemoved()
    }
  }, [isHostedHttp, loadAccount])

  async function saveProfile() {
    setSaving(true)
    setError(null)
    setSaved(null)
    try {
      const data = await accountApi<{ user: AccountUser }>('/api/account/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName }),
      })
      setAccount({ mode: 'account', user: data.user })
      setSaved(t('settings.account.profileSaved'))
      await loadAccount()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  async function changePassword() {
    setSaving(true)
    setError(null)
    setSaved(null)
    try {
      await accountApi('/api/account/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      setCurrentPassword('')
      setNewPassword('')
      setSaved(t('settings.account.passwordChanged'))
      await loadAccount()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  async function sendPasswordReset() {
    if (!account?.user?.email) return
    setSaving(true)
    setError(null)
    setSaved(null)
    try {
      await accountApi('/api/auth/password-reset/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: account.user.email }),
      })
      setSaved(t('settings.account.passwordResetSent'))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  async function resendVerification() {
    setSaving(true)
    setError(null)
    setSaved(null)
    try {
      await accountApi('/api/account/email/verify', { method: 'POST' })
      setSaved(t('settings.account.verificationEmailSent'))
      await loadAccount()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  async function topUpBalance() {
    setSaving(true)
    setError(null)
    setSaved(null)
    try {
      const data = await accountApi<{ status: string; redirectUrl: string | null; message: string; billing: BillingResponse }>('/api/account/billing/top-up-intent', { method: 'POST' })
      setBilling(data.billing)
      if (data.redirectUrl) {
        await openAccountUrl(data.redirectUrl.startsWith('http') ? data.redirectUrl : `${ACCOUNT_WEB_ORIGIN}${data.redirectUrl}`)
        setSaved('Открыта платежная страница для пополнения баланса.')
      } else {
        setSaved(data.message || 'Платежный провайдер пока не настроен.')
      }
      await loadAccount()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  async function createOrganization() {
    setSaving(true)
    setError(null)
    setSaved(null)
    try {
      const data = await accountApi<{ organizations: AccountOrganization[] }>('/api/account/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newOrganizationName }),
      })
      setOrganizations(data.organizations)
      setNewOrganizationName('')
      setSaved('Команда создана.')
      await loadAccount()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  async function joinOrganization() {
    setSaving(true)
    setError(null)
    setSaved(null)
    try {
      const data = await accountApi<{ organizations: AccountOrganization[] }>('/api/account/organizations/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: joinCode }),
      })
      setOrganizations(data.organizations)
      setJoinCode('')
      setSaved('Вы присоединились к организации.')
      await loadAccount()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  async function revokeSession(sessionId: string) {
    setSaving(true)
    setError(null)
    setSaved(null)
    try {
      await accountApi(`/api/account/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' })
      if (sessionId === sessions?.currentSessionId) {
        setAccount(null)
        setSaved('Текущая сессия завершена.')
        return
      }
      setSaved(t('settings.account.sessionRevoked'))
      await loadAccount()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  async function revokeOtherSessions() {
    setSaving(true)
    setError(null)
    setSaved(null)
    try {
      await accountApi('/api/account/sessions/revoke-all', { method: 'POST' })
      setSaved(t('settings.account.otherSessionsRevoked'))
      await loadAccount()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  async function logout() {
    await accountApi('/api/auth/logout', { method: 'POST' }).catch(() => null)
    setAccount(null)
    setBilling(null)
    setSessions(null)
    setEvents([])
    setOrganizations([])
    if (isHostedHttp) window.location.href = '/login'
  }

  if (loading) {
    return <div className="h-full flex items-center justify-center"><Spinner className="text-lg text-muted-foreground" /></div>
  }

  const accountUser = account?.mode === 'account' ? account.user : null

  return (
    <div className="h-full flex flex-col">
      <PanelHeader title={t('settings.account.title')} actions={<HeaderMenu route={routes.view.settings('account')} />} />
      <div className="flex-1 min-h-0 mask-fade-y">
        <ScrollArea className="h-full">
          <div className="px-5 py-7 max-w-5xl mx-auto space-y-8">
            {accountUser ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="rounded-xl border border-border bg-card px-4 py-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Баланс</div>
                    <div className="mt-2 text-2xl font-semibold text-foreground">{formatBalance(billing?.balance)}</div>
                    <div className="mt-1 text-xs text-muted-foreground">Обновлено: {formatDate(billing?.balance.updatedAt)}</div>
                  </div>
                  <div className="rounded-xl border border-border bg-card px-4 py-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Сессии</div>
                    <div className="mt-2 text-2xl font-semibold text-foreground">{sessions?.sessions.length ?? 0}</div>
                    <div className="mt-1 text-xs text-muted-foreground">Активные входы аккаунта</div>
                  </div>
                  <div className="rounded-xl border border-border bg-card px-4 py-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Организации</div>
                    <div className="mt-2 text-2xl font-semibold text-foreground">{organizations.length}</div>
                    <div className="mt-1 text-xs text-muted-foreground">Команды и рабочие контуры</div>
                  </div>
                </div>

                <SettingsSection title="Баланс и пополнение" description="Деньги, лимиты и платежные действия аккаунта.">
                  <SettingsCard divided>
                    <SettingsRow label="Текущий баланс" description={`${formatBalance(billing?.balance)} / ${billing?.topUp.enabled ? 'пополнение настроено' : 'платежный провайдер не настроен'}`} />
                    <SettingsRow
                      label="Пополнить баланс"
                      description="Создать intent пополнения и открыть платежную страницу, если provider включен на сервере."
                      action={<Button size="sm" onClick={topUpBalance} disabled={saving}>{billing?.topUp.enabled ? 'Пополнить' : 'Проверить пополнение'}</Button>}
                    />
                  </SettingsCard>
                </SettingsSection>

                <SettingsSection title={t('settings.account.profile')} description="Данные пользователя отображаются прямо внутри приложения, без browser-tab кабинета.">
                  <SettingsCard divided>
                    <SettingsRow label={t('settings.account.email')} description={accountUser.email} />
                    <SettingsRow
                      label={t('settings.account.emailVerification')}
                      description={accountUser.emailVerifiedAt ? t('settings.account.verifiedAt', { date: formatDate(accountUser.emailVerifiedAt) }) : t('settings.account.notVerified')}
                      action={!accountUser.emailVerifiedAt ? <Button size="sm" onClick={resendVerification} disabled={saving}>{t('settings.account.sendEmail')}</Button> : undefined}
                    />
                    <SettingsInput
                      label={t('settings.account.displayName')}
                      value={displayName}
                      onChange={setDisplayName}
                      placeholder={t('settings.account.displayNamePlaceholder')}
                      inCard
                    />
                    <SettingsRow label={t('settings.account.role')} description={`${accountUser.role} / ${accountUser.status}`} />
                    <SettingsRow
                      label={t('settings.account.created')}
                      description={formatDate(accountUser.createdAt)}
                      action={<Button size="sm" onClick={saveProfile} disabled={saving}>{t('settings.account.save')}</Button>}
                    />
                  </SettingsCard>
                </SettingsSection>

                <SettingsSection title="Команды и организации" description="Создание команды, присоединение к организации и список доступных рабочих контуров.">
                  <SettingsCard divided>
                    <SettingsInput label="Название новой команды" value={newOrganizationName} onChange={setNewOrganizationName} placeholder="например, ROX Ops" inCard />
                    <SettingsRow
                      label="Создать команду"
                      description="Вы станете владельцем команды. Slug можно передать другим пользователям как код подключения."
                      action={<Button size="sm" onClick={createOrganization} disabled={saving || newOrganizationName.trim().length < 2}>Создать команду</Button>}
                    />
                    <SettingsInput label="Код или slug организации" value={joinCode} onChange={setJoinCode} placeholder="например, rox-ops-a1b2c3" inCard />
                    <SettingsRow
                      label="Присоединиться к организации"
                      description="Введите slug/id организации, созданной другим пользователем."
                      action={<Button size="sm" variant="outline" onClick={joinOrganization} disabled={saving || !joinCode.trim()}>Присоединиться</Button>}
                    />
                    {organizations.length ? organizations.map((organization) => (
                      <SettingsRow
                        key={organization.id}
                        label={organization.name}
                        description={`${organization.role} / ${organization.status} / код: ${organization.slug}`}
                      />
                    )) : (
                      <SettingsRow label="Организации не подключены" description="Создайте команду или присоединитесь по коду." />
                    )}
                  </SettingsCard>
                </SettingsSection>

                <SettingsSection title="Логи и события" description="Последние действия аккаунта: входы, пополнения, изменения профиля, команды и сессии.">
                  <SettingsCard divided>
                    {events.length ? events.map((event) => (
                      <SettingsRow
                        key={event.id}
                        label={event.title}
                        description={`${formatDate(event.createdAt)} / ${event.type}${detailsText(event.details) ? ` / ${detailsText(event.details)}` : ''}`}
                      />
                    )) : (
                      <SettingsRow label="Событий пока нет" description="Новые входы, изменения и действия будут появляться здесь." />
                    )}
                  </SettingsCard>
                </SettingsSection>

                <SettingsSection title={t('settings.account.security')} description={t('settings.account.passwordChange')}>
                  <SettingsCard divided>
                    <SettingsInput label={t('settings.account.currentPassword')} type="password" value={currentPassword} onChange={setCurrentPassword} inCard />
                    <SettingsInput label={t('settings.account.newPassword')} type="password" value={newPassword} onChange={setNewPassword} inCard />
                    <SettingsRow
                      label={t('settings.account.password')}
                      description={t('settings.account.passwordChangeRevokes')}
                      action={<Button size="sm" onClick={changePassword} disabled={saving || newPassword.length < 8}>{t('settings.account.changePassword')}</Button>}
                    />
                    <SettingsRow
                      label={t('settings.account.passwordResetEmail')}
                      description={t('settings.account.passwordResetEmailDesc')}
                      action={<Button size="sm" variant="outline" onClick={sendPasswordReset} disabled={saving}>{t('settings.account.sendResetLink')}</Button>}
                    />
                  </SettingsCard>
                </SettingsSection>

                <SettingsSection title={t('settings.account.sessions')} description={t('settings.account.sessionsDesc')}>
                  <SettingsCard divided>
                    {sessions?.sessions.length ? sessions.sessions.map((session) => (
                      <SettingsRow
                        key={session.id}
                        label={session.id === sessions.currentSessionId ? t('settings.account.currentSession') : t('settings.account.session')}
                        description={`${t('settings.account.sessionDescription', {
                          authMethod: session.authMethod,
                          created: formatDate(session.createdAt),
                          expires: formatDate(session.expiresAt),
                        })}${session.userAgent ? t('settings.account.sessionUserAgent', { userAgent: session.userAgent }) : ''}`}
                        action={<Button size="sm" variant="outline" onClick={() => revokeSession(session.id)} disabled={saving}>{t('settings.account.revoke')}</Button>}
                      />
                    )) : (
                      <SettingsRow label={t('settings.account.sessions')} description={t('settings.account.noActiveSessions')} />
                    )}
                    <SettingsRow
                      label={t('settings.account.otherDevices')}
                      description={t('settings.account.otherDevicesDesc')}
                      action={<Button size="sm" variant="outline" onClick={revokeOtherSessions} disabled={saving}>{t('settings.account.revokeOthers')}</Button>}
                    />
                  </SettingsCard>
                </SettingsSection>

                <SettingsSection title={t('settings.account.session')} description={t('settings.account.logoutDesc')}>
                  <SettingsCard>
                    <SettingsRow label={t('settings.account.logout')} action={<Button size="sm" variant="destructive" onClick={logout}>{t('settings.account.logout')}</Button>} />
                  </SettingsCard>
                </SettingsSection>
              </>
            ) : (
              <SettingsSection title={t('settings.account.desktopAuthTitle')} description="После входа данные аккаунта появятся здесь, внутри приложения. Browser используется только для формы входа и подтверждения, не как личный кабинет.">
                <SettingsCard>
                  <SettingsRow label={t('settings.account.status')} description={error ?? t('settings.account.desktopAuthStatus')} />
                  <SettingsRow
                    label={t('settings.account.authActions')}
                    description="Войдите или зарегистрируйтесь, затем нажмите «Обновить кабинет»."
                    action={(
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button size="sm" onClick={() => { void openAccountPath(ACCOUNT_LOGIN_PATH) }}>{t('settings.account.signIn')}</Button>
                        <Button size="sm" variant="outline" onClick={() => { void openAccountPath(ACCOUNT_SIGNUP_PATH) }}>{t('settings.account.createAccount')}</Button>
                        <Button size="sm" variant="outline" onClick={() => { void openAccountPath(ACCOUNT_RESET_PATH) }}>{t('settings.account.resetPassword')}</Button>
                        <Button size="sm" variant="outline" onClick={() => { setLoading(true); void loadAccount() }}>Обновить кабинет</Button>
                      </div>
                    )}
                  />
                </SettingsCard>
              </SettingsSection>
            )}
            {saved && <p className="text-sm text-muted-foreground px-1">{saved}</p>}
            {error && accountUser && <p className="text-sm text-destructive px-1">{error}</p>}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
