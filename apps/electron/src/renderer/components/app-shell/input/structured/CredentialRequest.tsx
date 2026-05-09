import { useState, useCallback, useId } from 'react'
import { Key, User, Lock, Eye, EyeOff, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { CredentialRequest as CredentialRequestType, CredentialResponse } from '../../../../../shared/types'
import { validateBasicAuthCredentials, getPasswordValue, getPasswordLabel, getPasswordPlaceholder } from '@/utils/auth-validation'

interface CredentialRequestProps {
  request: CredentialRequestType
  onResponse: (response: CredentialResponse) => void
  /** When true, removes container styling (shadow, rounded) - used when wrapped by InputContainer */
  unstyled?: boolean
}

/**
 * CredentialRequest - Secure input UI for authentication credentials
 *
 * Supports multiple auth modes:
 * - bearer: Single token field (Bearer Token, API Key)
 * - basic: Username + Password fields
 * - header: API Key with custom header name shown
 * - query: API Key for query parameter auth
 */
export function CredentialRequest({ request, onResponse, unstyled = false }: CredentialRequestProps) {
  const [value, setValue] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  // Multi-header state: { "DD-API-KEY": "", "DD-APPLICATION-KEY": "" }
  const [headerValues, setHeaderValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    if (request.headerNames) {
      for (const name of request.headerNames) {
        initial[name] = ''
      }
    }
    return initial
  })

  // Touched state — per-field, set on blur so errors only appear after interaction
  const [touchedUsername, setTouchedUsername] = useState(false)
  const [touchedPassword, setTouchedPassword] = useState(false)
  const [touchedValue, setTouchedValue] = useState(false)
  const [touchedHeaders, setTouchedHeaders] = useState<Record<string, boolean>>({})

  // Stable IDs for aria-errormessage linkage
  const baseId = useId()
  const usernameErrorId = `${baseId}-username-error`
  const passwordErrorId = `${baseId}-password-error`
  const valueErrorId = `${baseId}-value-error`
  const headerErrorId = (index: number) => `${baseId}-header-${index}-error`

  const isBasicAuth = request.mode === 'basic'
  const isMultiHeader = request.mode === 'multi-header'
  const passwordRequired = request.passwordRequired ?? true  // default true for backward compatibility

  // Validation logic
  const isValid = isBasicAuth
    ? validateBasicAuthCredentials(username, password, passwordRequired)
    : isMultiHeader
    ? request.headerNames?.every(name => headerValues[name]?.trim().length > 0) ?? false
    : value.trim().length > 0

  // Per-field invalid flags (only shown after the field has been touched)
  const usernameInvalid = touchedUsername && username.trim().length === 0
  const passwordInvalid = touchedPassword && passwordRequired && password.trim().length === 0
  const valueInvalid = touchedValue && value.trim().length === 0
  const headerInvalid = (headerName: string) =>
    !!(touchedHeaders[headerName] ?? false) && (headerValues[headerName]?.trim().length === 0)

  const handleSubmit = useCallback(() => {
    if (!isValid) return

    if (isBasicAuth) {
      onResponse({
        type: 'credential',
        username: username.trim(),
        password: getPasswordValue(password, passwordRequired),
        cancelled: false
      })
    } else if (isMultiHeader) {
      // Trim all header values
      const trimmedHeaders: Record<string, string> = {}
      for (const [key, val] of Object.entries(headerValues)) {
        trimmedHeaders[key] = val.trim()
      }
      onResponse({
        type: 'credential',
        headers: trimmedHeaders,
        cancelled: false
      })
    } else {
      onResponse({
        type: 'credential',
        value: value.trim(),
        cancelled: false
      })
    }
  }, [isBasicAuth, isMultiHeader, username, password, value, headerValues, isValid, onResponse, passwordRequired])

  const handleCancel = useCallback(() => {
    onResponse({ type: 'credential', cancelled: true })
  }, [onResponse])

  const handleFormSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    handleSubmit()
  }, [handleSubmit])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && isValid) {
      handleSubmit()
    } else if (e.key === 'Escape') {
      handleCancel()
    }
  }, [isValid, handleSubmit, handleCancel])

  // Get field labels
  const credentialLabel = request.labels?.credential ||
    (request.mode === 'bearer' ? 'Bearer Token' : 'API Key')
  const usernameLabel = request.labels?.username || 'Username'
  const basePasswordLabel = request.labels?.password || 'Password'
  const passwordLabel = getPasswordLabel(basePasswordLabel, passwordRequired)
  const passwordPlaceholder = getPasswordPlaceholder(basePasswordLabel, passwordRequired)

  return (
    <div className={cn(
      'bg-background overflow-hidden h-full flex flex-col',
      unstyled ? 'border-0' : 'border border-border rounded-[8px] shadow-middle'
    )}>
      {/* Form wraps the entire card so password managers (1Password) can detect fields.
          action points to the source URL for domain-based credential matching. */}
      <form
        onSubmit={handleFormSubmit}
        action={request.sourceUrl || undefined}
        method="post"
        className="flex flex-col flex-1 min-h-0"
      >
        {/* Content */}
        <div className="p-4 space-y-4 flex-1 min-h-0 flex flex-col overflow-y-auto">
          {/* Header */}
          <div className="flex items-start gap-3">
            <div className="shrink-0 mt-0.5">
              <Key className="h-5 w-5 text-foreground" />
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">
                  Authentication Required
                </span>
                <span className="text-xs text-muted-foreground">
                  ({request.sourceName})
                </span>
              </div>
              {request.description && (
                <p className="text-xs text-muted-foreground">{request.description}</p>
              )}
            </div>
          </div>

          {/* Input fields */}
          <div className="space-y-3">
            {isBasicAuth ? (
              <>
                {/* Username field */}
                <div className="space-y-1.5">
                  <Label htmlFor="credential-username" className="text-xs">
                    {usernameLabel}
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="credential-username"
                      name="username"
                      autoComplete="username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      onBlur={() => setTouchedUsername(true)}
                      onKeyDown={handleKeyDown}
                      className="pl-9 aria-invalid:border-destructive aria-invalid:bg-destructive/5 aria-invalid:focus-visible:ring-destructive/20"
                      placeholder={`Enter ${usernameLabel.toLowerCase()}`}
                      autoFocus
                      aria-invalid={usernameInvalid || undefined}
                      aria-errormessage={usernameInvalid ? usernameErrorId : undefined}
                    />
                  </div>
                  <div id={usernameErrorId} role="status" aria-live="polite" className="text-[11px] text-destructive">
                    {usernameInvalid ? `${usernameLabel} is required` : ''}
                  </div>
                </div>
                {/* Password field */}
                <div className="space-y-1.5">
                  <Label htmlFor="credential-password" className="text-xs">
                    {passwordLabel}
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="credential-password"
                      name="password"
                      autoComplete="current-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onBlur={() => setTouchedPassword(true)}
                      onKeyDown={handleKeyDown}
                      className="pl-9 pr-9 aria-invalid:border-destructive aria-invalid:bg-destructive/5 aria-invalid:focus-visible:ring-destructive/20"
                      placeholder={passwordPlaceholder}
                      aria-invalid={passwordInvalid || undefined}
                      aria-errormessage={passwordInvalid ? passwordErrorId : undefined}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <div id={passwordErrorId} role="status" aria-live="polite" className="text-[11px] text-destructive">
                    {passwordInvalid ? `${passwordLabel} is required` : ''}
                  </div>
                </div>
              </>
            ) : isMultiHeader && request.headerNames ? (
              /* Multi-header fields (e.g., Datadog DD-API-KEY + DD-APPLICATION-KEY) */
              <>
                {request.headerNames.map((headerName, index) => {
                  const isHeaderInvalid = headerInvalid(headerName)
                  const errId = headerErrorId(index)
                  return (
                    <div key={headerName} className="space-y-1.5">
                      <Label htmlFor={`credential-header-${index}`} className="text-xs">
                        {headerName}
                      </Label>
                      <div className="relative">
                        <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id={`credential-header-${index}`}
                          name={headerName}
                          autoComplete="off"
                          type={showPassword ? 'text' : 'password'}
                          value={headerValues[headerName] || ''}
                          onChange={(e) => setHeaderValues(prev => ({
                            ...prev,
                            [headerName]: e.target.value
                          }))}
                          onBlur={() => setTouchedHeaders(prev => ({ ...prev, [headerName]: true }))}
                          onKeyDown={handleKeyDown}
                          className="pl-9 pr-9 aria-invalid:border-destructive aria-invalid:bg-destructive/5 aria-invalid:focus-visible:ring-destructive/20"
                          placeholder={`Enter ${headerName}`}
                          autoFocus={index === 0}
                          aria-invalid={isHeaderInvalid || undefined}
                          aria-errormessage={isHeaderInvalid ? errId : undefined}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          tabIndex={-1}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <div id={errId} role="status" aria-live="polite" className="text-[11px] text-destructive">
                        {isHeaderInvalid ? `${headerName} is required` : ''}
                      </div>
                    </div>
                  )
                })}
              </>
            ) : (
              /* Single credential field (API key, bearer token) */
              <div className="space-y-1.5">
                <Label htmlFor="credential-value" className="text-xs">
                  {credentialLabel}
                  {request.mode === 'header' && request.headerName && (
                    <span className="text-muted-foreground ml-1">
                      ({request.headerName})
                    </span>
                  )}
                </Label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="credential-value"
                    name="credential"
                    autoComplete="current-password"
                    type={showPassword ? 'text' : 'password'}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onBlur={() => setTouchedValue(true)}
                    onKeyDown={handleKeyDown}
                    className="pl-9 pr-9 aria-invalid:border-destructive aria-invalid:bg-destructive/5 aria-invalid:focus-visible:ring-destructive/20"
                    placeholder={`Enter ${credentialLabel.toLowerCase()}`}
                    autoFocus
                    aria-invalid={valueInvalid || undefined}
                    aria-errormessage={valueInvalid ? valueErrorId : undefined}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <div id={valueErrorId} role="status" aria-live="polite" className="text-[11px] text-destructive">
                  {valueInvalid ? `${credentialLabel} is required` : ''}
                </div>
              </div>
            )}

            {/* Hint */}
            {request.hint && (
              <p className="text-[11px] text-muted-foreground">
                {request.hint}
              </p>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="shrink-0 flex flex-wrap items-center gap-2 px-3 py-2 border-t border-border/50">
          <Button
            type="submit"
            size="sm"
            variant="default"
            className="h-7 gap-1.5"
            disabled={!isValid}
          >
            <Check className="h-3.5 w-3.5" />
            Save
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 gap-1.5 text-muted-foreground hover:text-foreground"
            onClick={handleCancel}
          >
            <X className="h-3.5 w-3.5" />
            Cancel
          </Button>

          <span className="min-w-0 flex-1 basis-full text-[10px] text-muted-foreground sm:basis-auto sm:text-right">
            Credentials are encrypted at rest
          </span>
        </div>
      </form>
    </div>
  )
}
