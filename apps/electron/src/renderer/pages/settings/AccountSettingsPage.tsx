import * as React from 'react'
import { useCallback, useEffect, useState } from 'react'
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
import { getAccountBrandSummaryRows } from './account-brand-summary'
import {
  AccountAuthPanel,
  isAllowedAccountExternalUrl,
  type AccountAuthTab,
  type NativeAccountAuthRequest,
} from './AccountAuthPanel'
import {
  summarizeAccountStorage,
  type AccountStorageResponse,
} from './account-storage-summary'
import {
  buildAcceptInvitePath,
  buildCreateInvitePath,
  buildTeamSpacesPath,
  summarizeAccountTeams,
  type AccountTeam,
  type AccountTeamSpace,
} from './account-teams-summary'

const ACCOUNT_WEB_ORIGIN = 'https://rox.one'

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

interface AccountResponse {
  mode: 'account' | 'legacy'
  user: AccountUser | null
  currentSessionId?: string
}

interface SessionsResponse {
  currentSessionId: string
  sessions: AccountSession[]
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

function detailsText(value: unknown): string {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (typeof value !== 'object') return String(value)
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== null && item !== undefined && String(item).length > 0)
    .slice(0, 4)
  return entries.map(([key, item]) => `${key}: ${String(item)}`).join(' / ')
}

export default function AccountSettingsPage() {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [account, setAccount] = useState<AccountResponse | null>(null)
  const [billing, setBilling] = useState<BillingResponse | null>(null)
  const [storage, setStorage] = useState<AccountStorageResponse | null>(null)
  const [sessions, setSessions] = useState<SessionsResponse | null>(null)
  const [events, setEvents] = useState<AccountEvent[]>([])
  const [teams, setTeams] = useState<AccountTeam[]>([])
  const [teamSpaces, setTeamSpaces] = useState<Record<string, AccountTeamSpace[]>>({})
  const [teamsError, setTeamsError] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newTeamName, setNewTeamName] = useState('')
  const [selectedTeamId, setSelectedTeamId] = useState('')
  const [newSpaceName, setNewSpaceName] = useState('')
  const [inviteTeamId, setInviteTeamId] = useState('')
  const [joinCode, setJoinCode] = useState('')

  const isHostedHttp = window.location.protocol === 'http:' || window.location.protocol === 'https:'

  const formatDate = (value?: string | null): string => {
    if (!value) return t('settings.account.never')
    return new Date(value).toLocaleString()
  }

  const formatBalance = (value?: AccountBalance | null): string => {
    if (!value) return '0 USDT'
    return `${Number(value.balanceUnits || 0).toLocaleString('ru-RU')} ${value.currency || 'USDT'}`
  }

  const openExternalCheckoutUrl = useCallback(async (url: string) => {
    if (!isAllowedAccountExternalUrl(url)) {
      throw new Error('External account navigation is allowed only for DV.net checkout URLs')
    }
    if (isHostedHttp) {
      window.location.href = url
      return
    }
    await window.electronAPI.openUrl(url)
  }, [isHostedHttp])

  const accountApi = useCallback(async <T,>(path: string, init: AccountApiInit = {}): Promise<T> => {
    const requestUrl = isHostedHttp ? path : `${ACCOUNT_WEB_ORIGIN}${path}`
    const res = await fetch(requestUrl, {
      method: init.method || 'GET',
      headers: init.headers,
      body: init.body ?? undefined,
      credentials: isHostedHttp ? 'same-origin' : 'include',
    })
    if (!res.ok) throw new Error(await readError(res))
    return await res.json() as T
  }, [isHostedHttp])

  const loadAccount = useCallback(async () => {
    setError(null)
    try {
      const accountData = await accountApi<AccountResponse>('/api/account/me')
      setAccount(accountData)
      setDisplayName(accountData.user?.displayName ?? '')

      if (accountData.mode === 'account' && accountData.user) {
        const [billingResult, storageResult, sessionsResult, eventsResult, teamsResult] = await Promise.allSettled([
          accountApi<BillingResponse>('/api/account/billing'),
          accountApi<AccountStorageResponse>('/api/account/storage'),
          accountApi<SessionsResponse>('/api/account/sessions'),
          accountApi<{ events: AccountEvent[] }>('/api/account/events'),
          accountApi<{ teams: AccountTeam[] }>('/api/account/teams'),
        ])

        setBilling(billingResult.status === 'fulfilled' ? billingResult.value : null)
        setStorage(storageResult.status === 'fulfilled' ? storageResult.value : null)
        setSessions(sessionsResult.status === 'fulfilled' ? sessionsResult.value : null)
        setEvents(eventsResult.status === 'fulfilled' ? eventsResult.value.events : [])
        if (teamsResult.status === 'fulfilled') {
          setTeams(teamsResult.value.teams)
          setTeamsError(null)
          const spaceEntries = await Promise.allSettled(teamsResult.value.teams.map(async (team) => {
            const data = await accountApi<{ spaces: AccountTeamSpace[] }>(buildTeamSpacesPath(team.id))
            return [team.id, data.spaces] as const
          }))
          const nextSpaces: Record<string, AccountTeamSpace[]> = {}
          for (const entry of spaceEntries) {
            if (entry.status === 'fulfilled') nextSpaces[entry.value[0]] = entry.value[1]
          }
          setTeamSpaces(nextSpaces)
        } else {
          setTeams([])
          setTeamSpaces({})
          setTeamsError(teamsResult.reason instanceof Error ? teamsResult.reason.message : String(teamsResult.reason))
        }
      }
    } catch (err) {
      setAccount(null)
      setBilling(null)
      setStorage(null)
      setSessions(null)
      setEvents([])
      setTeams([])
      setTeamSpaces({})
      setTeamsError(null)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [accountApi])

  useEffect(() => {
    void loadAccount()
  }, [loadAccount])

  async function submitNativeAuth(tab: AccountAuthTab, request: NativeAccountAuthRequest) {
    setSaving(true)
    setError(null)
    setSaved(null)
    try {
      await accountApi(request.path, {
        method: request.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request.body),
      })
      if (tab === 'reset') {
        setSaved(t('settings.account.passwordResetSent'))
        return
      }
      setSaved(tab === 'register' ? 'Аккаунт создан. Кабинет обновлен.' : 'Вход выполнен. Кабинет обновлен.')
      await loadAccount()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

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
        await openExternalCheckoutUrl(data.redirectUrl)
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

  async function createTeam() {
    setSaving(true)
    setError(null)
    setSaved(null)
    try {
      const data = await accountApi<{ teams: AccountTeam[] }>('/api/account/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTeamName }),
      })
      setTeams(data.teams)
      const newestTeam = data.teams.at(-1)
      if (newestTeam) {
        setSelectedTeamId(newestTeam.id)
        setInviteTeamId(newestTeam.id)
      }
      setNewTeamName('')
      setSaved('Команда создана.')
      await loadAccount()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  async function acceptTeamInvite() {
    setSaving(true)
    setError(null)
    setSaved(null)
    try {
      const data = await accountApi<{ teams: AccountTeam[] }>(buildAcceptInvitePath(joinCode), {
        method: 'POST',
      })
      setTeams(data.teams)
      setJoinCode('')
      setSaved('Вы присоединились к команде.')
      await loadAccount()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  async function createTeamSpace() {
    if (!selectedTeamId) return
    setSaving(true)
    setError(null)
    setSaved(null)
    try {
      const data = await accountApi<{ spaces: AccountTeamSpace[] }>(buildTeamSpacesPath(selectedTeamId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newSpaceName }),
      })
      setTeamSpaces(prev => ({ ...prev, [selectedTeamId]: data.spaces }))
      setNewSpaceName('')
      setSaved('Space создан.')
      await loadAccount()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  async function createTeamInvite() {
    if (!inviteTeamId) return
    setSaving(true)
    setError(null)
    setSaved(null)
    try {
      const data = await accountApi<{ invite: { code: string; role: string } }>(buildCreateInvitePath(inviteTeamId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'member' }),
      })
      setSaved(`Инвайт создан: ${data.invite.code} (${data.invite.role})`)
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
    setStorage(null)
    setSessions(null)
    setEvents([])
    setTeams([])
    setTeamSpaces({})
    setTeamsError(null)
    if (isHostedHttp) window.location.href = '/login'
  }

  if (loading) {
    return <div className="h-full flex items-center justify-center"><Spinner className="text-lg text-muted-foreground" /></div>
  }

  const accountUser = account?.mode === 'account' ? account.user : null
  const brandSummaryRows = getAccountBrandSummaryRows(undefined, t)
  const storageSummary = summarizeAccountStorage(storage)
  const teamsSummary = summarizeAccountTeams({ teams, spacesByTeamId: teamSpaces, error: teamsError })
  const manageableTeams = teamsSummary.rows.filter(row => row.canCreateInvite || row.canCreateSpace)

  return (
    <div className="h-full flex flex-col">
      <PanelHeader title={t('settings.account.title')} actions={<HeaderMenu route={routes.view.settings('account')} />} />
      <div className="flex-1 min-h-0 mask-fade-y">
        <ScrollArea className="h-full">
          <div className="px-5 py-7 max-w-5xl mx-auto space-y-8">
            <SettingsSection title={t("workbench.brand.section")} description="White-label сведения, которые используются в shell, меню, документации и поддержке.">
              <SettingsCard divided>
                {brandSummaryRows.map((row) => (
                  <SettingsRow key={row.label} label={row.label} description={row.description} />
                ))}
              </SettingsCard>
            </SettingsSection>
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
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Storage</div>
                    <div className="mt-2 text-2xl font-semibold text-foreground">{storageSummary.totalUsedLabel.replace(' used', '')}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{storageSummary.endpointLabel}</div>
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

                <SettingsSection title="Хранилище" description="User/team buckets, quotas and S3-compatible backend health stay inside the app UI. Credentials are server-side only.">
                  <SettingsCard divided>
                    <SettingsRow label="S3 backend" description={`${storageSummary.endpointLabel} / ${storageSummary.totalQuotaLabel}`} />
                    {storageSummary.rows.map((row) => (
                      <SettingsRow key={`${row.label}:${row.description}`} label={row.label} description={row.description} />
                    ))}
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

                <SettingsSection title="Команды и Spaces" description="Команда владеет collaborative spaces, storage prefixes and invite flow. Legacy organizations stay behind the same compatibility layer.">
                  <SettingsCard divided>
                    <SettingsRow label="Подключено" description={`${teamsSummary.totalTeamsLabel} / ${teamsSummary.totalSpacesLabel}`} />
                    <SettingsInput label="Название новой команды" value={newTeamName} onChange={setNewTeamName} placeholder="например, ROX Ops" inCard />
                    <SettingsRow
                      label="Создать команду"
                      description="Вы станете владельцем команды. Инвайты создаются отдельно и принимаются одноразовым кодом."
                      action={<Button size="sm" onClick={createTeam} disabled={saving || newTeamName.trim().length < 2}>Создать команду</Button>}
                    />
                    <SettingsInput label="Код приглашения" value={joinCode} onChange={setJoinCode} placeholder="например, dv7Z... одноразовый invite code" inCard />
                    <SettingsRow
                      label="Принять приглашение"
                      description="Invite code принимается через team endpoint и больше не используется повторно."
                      action={<Button size="sm" variant="outline" onClick={acceptTeamInvite} disabled={saving || !joinCode.trim()}>Присоединиться</Button>}
                    />
                    {manageableTeams.length ? (
                      <>
                        <SettingsInput label="ID команды для space/invite" value={selectedTeamId} onChange={setSelectedTeamId} placeholder={manageableTeams[0]?.id || 'team id'} inCard />
                        <SettingsInput label="Название нового Space" value={newSpaceName} onChange={setNewSpaceName} placeholder="например, Release Room" inCard />
                        <SettingsRow
                          label="Создать Space"
                          description="Space получает отдельный prefix внутри team bucket."
                          action={<Button size="sm" onClick={createTeamSpace} disabled={saving || !selectedTeamId || newSpaceName.trim().length < 2}>Создать Space</Button>}
                        />
                        <SettingsInput label="ID команды для invite" value={inviteTeamId} onChange={setInviteTeamId} placeholder={manageableTeams[0]?.id || 'team id'} inCard />
                        <SettingsRow
                          label="Создать invite"
                          description="Создает одноразовое приглашение с ролью member."
                          action={<Button size="sm" variant="outline" onClick={createTeamInvite} disabled={saving || !inviteTeamId}>Создать invite</Button>}
                        />
                      </>
                    ) : null}
                    {teamsSummary.rows.length ? teamsSummary.rows.map((team) => (
                      <SettingsRow
                        key={team.id}
                        label={team.label}
                        description={team.description}
                      />
                    )) : (
                      <SettingsRow label={teamsSummary.emptyLabel} description="Создайте команду или примите одноразовое приглашение." />
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
              <SettingsSection title={t('settings.account.desktopAuthTitle')} description="Вход, регистрация и сброс пароля выполняются внутри ROX ONE. После успешного входа кабинет обновится автоматически.">
                <AccountAuthPanel
                  error={error}
                  saving={saving}
                  onSubmit={submitNativeAuth}
                  onRefresh={() => { setLoading(true); void loadAccount() }}
                />
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
