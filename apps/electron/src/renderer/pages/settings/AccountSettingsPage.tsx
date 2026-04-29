import * as React from 'react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PanelHeader } from '@/components/app-shell/PanelHeader'
import { HeaderMenu } from '@/components/ui/HeaderMenu'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { routes } from '@/lib/navigate'
import { Spinner } from '@craft-agent/ui'
import { SettingsCard, SettingsInput, SettingsSection } from '@/components/settings'
import { SettingsRow } from '@/components/settings/SettingsRow'
import type { DetailsPageMeta } from '@/lib/navigation-registry'

const ACCOUNT_WEB_ORIGIN = 'https://rox.one'
const ACCOUNT_DASHBOARD_PATH = '/account'
const ACCOUNT_LOGIN_PATH = '/login'
const ACCOUNT_SIGNUP_PATH = '/login?tab=register'
const ACCOUNT_RESET_PATH = '/login?tab=reset-request'

export const meta: DetailsPageMeta = {
  navigator: 'settings',
  slug: 'account',
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

interface AccountResponse {
  mode: 'account' | 'legacy'
  user: AccountUser | null
  currentSessionId?: string
}

interface SessionsResponse {
  currentSessionId: string
  sessions: AccountSession[]
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

export default function AccountSettingsPage() {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [account, setAccount] = useState<AccountResponse | null>(null)
  const [sessions, setSessions] = useState<SessionsResponse | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')

  const isHostedHttp = window.location.protocol === 'http:' || window.location.protocol === 'https:'
  const formatDate = (value?: string | null): string => {
    if (!value) return t('settings.account.never')
    return new Date(value).toLocaleString()
  }

  const openAccountPath = useCallback(async (path: string) => {
    if (isHostedHttp) {
      window.location.href = path
      return
    }

    const url = `${ACCOUNT_WEB_ORIGIN}${path}`
    try {
      const instanceId = await window.electronAPI.browserPane.create({
        show: true,
        initialUrl: url,
        hostMode: 'embedded',
      })
      await window.electronAPI.browserPane.focus(instanceId)
    } catch (err) {
      console.error('[AccountSettings] Failed to open account browser tab:', err)
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [isHostedHttp])

  const loadAccount = useCallback(async () => {
    if (!isHostedHttp) {
      setLoading(false)
      return
    }

    setError(null)
    try {
      const accountRes = await fetch('/api/account/me', { credentials: 'same-origin' })
      if (!accountRes.ok) throw new Error(await readError(accountRes))
      const accountData = await accountRes.json() as AccountResponse
      setAccount(accountData)
      setDisplayName(accountData.user?.displayName ?? '')

      if (accountData.mode === 'account') {
        const sessionsRes = await fetch('/api/account/sessions', { credentials: 'same-origin' })
        if (sessionsRes.ok) {
          setSessions(await sessionsRes.json() as SessionsResponse)
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [isHostedHttp])

  useEffect(() => {
    void loadAccount()
  }, [loadAccount])

  async function saveProfile() {
    setSaving(true)
    setError(null)
    setSaved(null)
    try {
      const res = await fetch('/api/account/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ displayName }),
      })
      if (!res.ok) throw new Error(await readError(res))
      const data = await res.json() as { user: AccountUser }
      setAccount({ mode: 'account', user: data.user })
      setSaved(t('settings.account.profileSaved'))
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
      const res = await fetch('/api/account/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      if (!res.ok) throw new Error(await readError(res))
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
      const res = await fetch('/api/auth/password-reset/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email: account.user.email }),
      })
      if (!res.ok) throw new Error(await readError(res))
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
      const res = await fetch('/api/account/email/verify', { method: 'POST', credentials: 'same-origin' })
      if (!res.ok) throw new Error(await readError(res))
      setSaved(t('settings.account.verificationEmailSent'))
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
      const res = await fetch(`/api/account/sessions/${encodeURIComponent(sessionId)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      })
      if (!res.ok) throw new Error(await readError(res))
      if (sessionId === sessions?.currentSessionId) {
        window.location.href = '/login'
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
      const res = await fetch('/api/account/sessions/revoke-all', { method: 'POST', credentials: 'same-origin' })
      if (!res.ok) throw new Error(await readError(res))
      setSaved(t('settings.account.otherSessionsRevoked'))
      await loadAccount()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' })
    window.location.href = '/login'
  }

  if (loading) {
    return <div className="h-full flex items-center justify-center"><Spinner className="text-lg text-muted-foreground" /></div>
  }

  const accountUser = isHostedHttp && account?.mode === 'account' ? account.user : null

  return (
    <div className="h-full flex flex-col">
      <PanelHeader title={t('settings.account.title')} actions={<HeaderMenu route={routes.view.settings('account')} />} />
      <div className="flex-1 min-h-0 mask-fade-y">
        <ScrollArea className="h-full">
          <div className="px-5 py-7 max-w-3xl mx-auto space-y-8">
            {accountUser ? (
              <>
                <SettingsSection title={t('settings.account.profile')} description={t('settings.account.profileDesc')}>
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
              <SettingsSection title={t('settings.account.desktopAuthTitle')} description={t('settings.account.desktopAuthDesc')}>
                <SettingsCard>
                  <SettingsRow label={t('settings.account.status')} description={error ?? t('settings.account.desktopAuthStatus')} />
                  <SettingsRow
                    label={t('settings.account.authActions')}
                    description={t('settings.account.authActionsDesc')}
                    action={(
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => { void openAccountPath(ACCOUNT_DASHBOARD_PATH) }}>{t('settings.account.title')}</Button>
                        <Button size="sm" onClick={() => { void openAccountPath(ACCOUNT_LOGIN_PATH) }}>{t('settings.account.signIn')}</Button>
                        <Button size="sm" variant="outline" onClick={() => { void openAccountPath(ACCOUNT_SIGNUP_PATH) }}>{t('settings.account.createAccount')}</Button>
                        <Button size="sm" variant="outline" onClick={() => { void openAccountPath(ACCOUNT_RESET_PATH) }}>{t('settings.account.resetPassword')}</Button>
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
