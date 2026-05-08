import type { Message } from '../../../shared/types'

export interface ErrorMessagePresentation {
  title?: string
  content: string
  details?: string[]
  original?: string
  actions?: Message['errorActions']
}

const PI_RUNTIME_NOT_CONFIGURED_PATTERN =
  /piServerPath not configured\. Cannot spawn Pi subprocess\./i

export function createErrorMessagePresentation(
  message: Message,
  t: (key: string) => string,
): ErrorMessagePresentation {
  if (isPiRuntimeNotConfiguredMessage(message)) {
    const details = message.errorDetails?.length
      ? message.errorDetails
      : [`Raw error: ${message.errorOriginal || message.content}`]

    return {
      title: t('errors.piRuntimeNotConfigured.title'),
      content: t('errors.piRuntimeNotConfigured.message'),
      details,
      original: message.errorOriginal,
      actions: ensureSettingsAction(message.errorActions, t),
    }
  }

  return {
    title: message.errorTitle,
    content: message.content,
    details: message.errorDetails,
    original: message.errorOriginal,
    actions: message.errorActions,
  }
}

function isPiRuntimeNotConfiguredMessage(message: Message): boolean {
  return [message.content, message.errorOriginal, ...(message.errorDetails ?? [])]
    .filter((value): value is string => Boolean(value))
    .some((value) => PI_RUNTIME_NOT_CONFIGURED_PATTERN.test(value))
}

function ensureSettingsAction(
  actions: Message['errorActions'],
  t: (key: string) => string,
): Message['errorActions'] {
  if (actions?.some((action) => action.action === 'settings')) {
    return actions
  }

  return [
    ...(actions ?? []),
    {
      key: 'pi-runtime-settings',
      label: t('errors.piRuntimeNotConfigured.settingsAction'),
      action: 'settings',
    },
  ]
}
