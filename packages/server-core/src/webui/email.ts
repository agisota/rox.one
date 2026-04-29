export interface AccountEmailInput {
  to: string
  displayName?: string | null
  url: string
  expiresAt?: string
}

export interface AccountEmailService {
  sendVerificationEmail(input: AccountEmailInput): Promise<void>
  sendPasswordResetEmail(input: AccountEmailInput): Promise<void>
  sendPasswordChangedEmail(input: { to: string; displayName?: string | null }): Promise<void>
}

interface LoggerLike {
  info: (...args: any[]) => void
  warn: (...args: any[]) => void
  error: (...args: any[]) => void
}

interface EmailMessage {
  to: string
  subject: string
  text: string
  html: string
}

const APP_NAME = 'ROX ONE'
const DEFAULT_EMAIL_FROM = `${APP_NAME} <noreply@rox.one>`

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function greeting(displayName?: string | null): string {
  return displayName?.trim() ? `Hi ${displayName.trim()},` : 'Hi,'
}

function redactAuthUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl)
    for (const key of ['token', 'code', 'state']) {
      if (url.searchParams.has(key)) url.searchParams.set(key, '[redacted]')
    }
    return url.toString()
  } catch {
    return rawUrl.replace(/([?&](?:token|code|state)=)[^&\s]+/gi, '$1[redacted]')
  }
}

class ConsoleAccountEmailService implements AccountEmailService {
  constructor(private readonly logger: LoggerLike) {}

  async sendVerificationEmail(input: AccountEmailInput): Promise<void> {
    this.logger.info(`[webui] Email verification link for ${input.to}: ${redactAuthUrl(input.url)}`)
  }

  async sendPasswordResetEmail(input: AccountEmailInput): Promise<void> {
    this.logger.info(`[webui] Password reset link for ${input.to}: ${redactAuthUrl(input.url)}`)
  }

  async sendPasswordChangedEmail(input: { to: string }): Promise<void> {
    this.logger.info(`[webui] Password changed notification for ${input.to}`)
  }
}

class ResendAccountEmailService implements AccountEmailService {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
    private readonly logger: LoggerLike,
  ) {}

  async sendVerificationEmail(input: AccountEmailInput): Promise<void> {
    await this.send({
      to: input.to,
      subject: `Verify your ${APP_NAME} account`,
      text: `${greeting(input.displayName)}\n\nVerify your ${APP_NAME} account:\n${input.url}\n\nThis link expires at ${input.expiresAt ?? 'soon'}.`,
      html: `<p>${escapeHtml(greeting(input.displayName))}</p><p>Verify your ${APP_NAME} account:</p><p><a href="${escapeHtml(input.url)}">Verify email</a></p><p>This link expires at ${escapeHtml(input.expiresAt ?? 'soon')}.</p>`,
    })
  }

  async sendPasswordResetEmail(input: AccountEmailInput): Promise<void> {
    await this.send({
      to: input.to,
      subject: `Reset your ${APP_NAME} password`,
      text: `${greeting(input.displayName)}\n\nReset your ${APP_NAME} password:\n${input.url}\n\nIf you did not request this, ignore this email.`,
      html: `<p>${escapeHtml(greeting(input.displayName))}</p><p>Reset your ${APP_NAME} password:</p><p><a href="${escapeHtml(input.url)}">Reset password</a></p><p>If you did not request this, ignore this email.</p>`,
    })
  }

  async sendPasswordChangedEmail(input: { to: string; displayName?: string | null }): Promise<void> {
    await this.send({
      to: input.to,
      subject: `Your ${APP_NAME} password was changed`,
      text: `${greeting(input.displayName)}\n\nYour ${APP_NAME} password was changed. If this was not you, reset your password immediately.`,
      html: `<p>${escapeHtml(greeting(input.displayName))}</p><p>Your ${APP_NAME} password was changed.</p><p>If this was not you, reset your password immediately.</p>`,
    })
  }

  private async send(message: EmailMessage): Promise<void> {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: this.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      this.logger.error(`[webui] Resend email failed with HTTP ${res.status}: ${body.slice(0, 500)}`)
      throw new Error('Email delivery failed')
    }
  }
}

export interface CreateAccountEmailServiceOptions {
  resendApiKey?: string
  from?: string
  logger: LoggerLike
}

export function createAccountEmailService(options: CreateAccountEmailServiceOptions): AccountEmailService {
  if (options.resendApiKey?.trim()) {
    return new ResendAccountEmailService(
      options.resendApiKey.trim(),
      options.from?.trim() || DEFAULT_EMAIL_FROM,
      options.logger,
    )
  }

  return new ConsoleAccountEmailService(options.logger)
}
