function normalizeModuleId(id: string): string {
  return id.replace(/\\/g, '/')
}

function hasNodePackage(id: string, packageName: string): boolean {
  return normalizeModuleId(id).includes(`/node_modules/${packageName}/`)
}

export function getElectronRendererManualChunk(id: string): string | undefined {
  const normalizedId = normalizeModuleId(id)

  if (normalizedId.includes('node_modules')) {
    if (hasNodePackage(normalizedId, 'sonner')) return 'sonner'
    if (hasNodePackage(normalizedId, '@sentry')) return 'sentry'
    if (
      hasNodePackage(normalizedId, 'i18next') ||
      hasNodePackage(normalizedId, 'react-i18next') ||
      hasNodePackage(normalizedId, 'i18next-browser-languagedetector')
    ) {
      return 'i18n'
    }
    if (
      hasNodePackage(normalizedId, 'react') ||
      hasNodePackage(normalizedId, 'react-dom') ||
      hasNodePackage(normalizedId, 'scheduler')
    ) {
      return 'index-react'
    }
    if (hasNodePackage(normalizedId, '@radix-ui')) return 'index-radix'
    if (hasNodePackage(normalizedId, 'jotai')) return 'index-jotai'
  }
  if (normalizedId.includes('/packages/ui/')) return 'index-ui'
  if (normalizedId.includes('/packages/shared/')) return 'index-shared'
  return undefined
}
