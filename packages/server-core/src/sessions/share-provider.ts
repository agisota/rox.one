import { VIEWER_URL } from '@rox-agent/shared/branding'
import type { ShareResult } from '@rox-agent/shared/protocol'

import { createViewerShareFailureResult } from './share-errors'

export type ShareProviderFailureCode = NonNullable<ShareResult['code']>

export interface ShareProviderFailure {
  success: false
  code: ShareProviderFailureCode
  error: string
  retryable: boolean
  status?: number
}

export interface ShareUploadInput {
  sessionId: string
  bundle: unknown
}

export type ShareUploadResult =
  | { success: true; uploadId: string; proposedUrl?: string }
  | ShareProviderFailure

export interface ShareShortlinkInput {
  sessionId: string
  uploadId: string
  proposedUrl?: string
}

export type ShareShortlinkResult =
  | { success: true; shareId: string; url: string }
  | ShareProviderFailure

export interface ShareUpdateInput {
  sessionId: string
  shareId: string
  currentUrl?: string
  bundle: unknown
}

export type ShareUpdateResult =
  | { success: true; url?: string }
  | ShareProviderFailure

export interface ShareStatusInput {
  sessionId: string
  shareId: string
}

export type ShareStatusResult =
  | { success: true; shareId: string; status: 'active' | 'expired' | 'revoked' }
  | ShareProviderFailure

export interface ShareRevokeInput {
  sessionId: string
  shareId: string
}

export type ShareRevokeResult =
  | { success: true }
  | ShareProviderFailure

export interface ShareProvider {
  uploadBundle(input: ShareUploadInput): Promise<ShareUploadResult>
  createShortlink(input: ShareShortlinkInput): Promise<ShareShortlinkResult>
  updateBundle(input: ShareUpdateInput): Promise<ShareUpdateResult>
  getShareStatus(input: ShareStatusInput): Promise<ShareStatusResult>
  revokeShare(input: ShareRevokeInput): Promise<ShareRevokeResult>
}

const SECRET_FIELD_PATTERN = /^(authorization|cookie|set-cookie|x-api-key|api[-_]?key|access[-_]?token|refresh[-_]?token|id[-_]?token|bearer|password|secret|rox_session|session[-_]?cookie|session[-_]?token)$/i

export function sanitizeShareBundleForPublicViewer<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(item => sanitizeShareBundleForPublicViewer(item)) as T
  }

  if (!value || typeof value !== 'object') {
    return value
  }

  const output: Record<string, unknown> = {}
  for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
    if (SECRET_FIELD_PATTERN.test(key)) continue
    output[key] = sanitizeShareBundleForPublicViewer(nestedValue)
  }

  return output as T
}

function isPrivateHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (host === 'localhost' || host === '::1' || host === '0.0.0.0') return true
  if (host.startsWith('127.')) return true
  if (host.startsWith('10.')) return true
  if (host.startsWith('192.168.')) return true
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return true
  if (host.endsWith('.local') || host.endsWith('.t')) return true
  return false
}

export function assertPublicShareUrl(url: string): { success: true } | ShareProviderFailure {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' || isPrivateHostname(parsed.hostname)) {
      return {
        success: false,
        code: 'invalid_public_url',
        error: 'Share provider returned a non-public shortlink URL.',
        retryable: false,
      }
    }
    return { success: true }
  } catch {
    return {
      success: false,
      code: 'invalid_public_url',
      error: 'Share provider returned a non-public shortlink URL.',
      retryable: false,
    }
  }
}

function providerFailureFromShareResult(result: ShareResult): ShareProviderFailure {
  const code = result.code ?? 'viewer_unavailable'
  return {
    success: false,
    code,
    error: result.error ?? 'Share provider failed.',
    retryable: code === 'viewer_unavailable' || code === 'expired',
    status: result.status,
  }
}

export function mapShareProviderFailureToShareResult(result: ShareProviderFailure): ShareResult {
  return {
    success: false,
    code: result.code,
    error: result.error,
    status: result.status,
  }
}

export interface ViewerShareProviderOptions {
  viewerUrl?: string
  fetchFn?: typeof fetch
}

export function createViewerShareProvider(options: ViewerShareProviderOptions = {}): ShareProvider {
  const viewerUrl = options.viewerUrl ?? VIEWER_URL
  const fetchFn = options.fetchFn ?? fetch

  return {
    async uploadBundle(input) {
      const response = await fetchFn(`${viewerUrl}/s/api`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input.bundle),
      })

      if (!response.ok) {
        return providerFailureFromShareResult(createViewerShareFailureResult(response.status, response.statusText))
      }

      const data = await response.json() as { id: string; url?: string }
      return { success: true, uploadId: data.id, proposedUrl: data.url }
    },

    async createShortlink(input) {
      const url = input.proposedUrl ?? `${viewerUrl}/s/${input.uploadId}`
      const publicUrl = assertPublicShareUrl(url)
      if (!publicUrl.success) return publicUrl
      return { success: true, shareId: input.uploadId, url }
    },

    async updateBundle(input) {
      const response = await fetchFn(`${viewerUrl}/s/api/${input.shareId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input.bundle),
      })

      if (!response.ok) {
        return providerFailureFromShareResult(createViewerShareFailureResult(response.status, response.statusText))
      }

      if (input.currentUrl) {
        const publicUrl = assertPublicShareUrl(input.currentUrl)
        if (!publicUrl.success) return publicUrl
      }

      return { success: true, url: input.currentUrl }
    },

    async getShareStatus(input) {
      const response = await fetchFn(`${viewerUrl}/s/api/${input.shareId}`, { method: 'HEAD' })
      if (!response.ok) {
        return providerFailureFromShareResult(createViewerShareFailureResult(response.status, response.statusText))
      }
      return { success: true, shareId: input.shareId, status: 'active' }
    },

    async revokeShare(input) {
      const response = await fetchFn(`${viewerUrl}/s/api/${input.shareId}`, { method: 'DELETE' })
      if (!response.ok) {
        return providerFailureFromShareResult(createViewerShareFailureResult(response.status, response.statusText))
      }
      return { success: true }
    },
  }
}

export interface FakeShareProviderOptions {
  baseUrl: string
  uploadFailure?: ShareProviderFailure
  shortlinkFailure?: ShareProviderFailure
  updateFailure?: ShareProviderFailure
  revokeFailure?: ShareProviderFailure
}

export interface FakeShareProvider extends ShareProvider {
  listUploads(): Array<{ uploadId: string; sessionId: string; bundle: unknown }>
  listUpdates(): Array<{ shareId: string; sessionId: string }>
  listRevocations(): Array<{ shareId: string; sessionId: string }>
}

export function createFakeShareProvider(options: FakeShareProviderOptions): FakeShareProvider {
  const uploads: Array<{ uploadId: string; sessionId: string; bundle: unknown }> = []
  const updates: Array<{ shareId: string; sessionId: string }> = []
  const revocations: Array<{ shareId: string; sessionId: string }> = []

  return {
    async uploadBundle(input) {
      if (options.uploadFailure) return options.uploadFailure
      const uploadId = `upload_${input.sessionId}`
      uploads.push({ uploadId, sessionId: input.sessionId, bundle: input.bundle })
      return { success: true, uploadId }
    },

    async createShortlink(input) {
      if (options.shortlinkFailure) return options.shortlinkFailure
      if (!uploads.some(upload => upload.uploadId === input.uploadId)) {
        return {
          success: false,
          code: 'viewer_unavailable',
          error: 'Upload not found for shortlink creation.',
          retryable: true,
          status: 404,
        }
      }
      const shareId = `share_${input.sessionId}`
      const url = `${options.baseUrl}/s/${shareId}`
      const publicUrl = assertPublicShareUrl(url)
      if (!publicUrl.success) return publicUrl
      return { success: true, shareId, url }
    },

    async updateBundle(input) {
      if (options.updateFailure) return options.updateFailure
      updates.push({ shareId: input.shareId, sessionId: input.sessionId })
      return { success: true, url: input.currentUrl }
    },

    async getShareStatus(input) {
      return { success: true, shareId: input.shareId, status: 'active' }
    },

    async revokeShare(input) {
      if (options.revokeFailure) return options.revokeFailure
      revocations.push({ shareId: input.shareId, sessionId: input.sessionId })
      return { success: true }
    },

    listUploads() {
      return uploads.slice()
    },

    listUpdates() {
      return updates.slice()
    },

    listRevocations() {
      return revocations.slice()
    },
  }
}

let sessionShareProviderForTests: ShareProvider | null = null

export function getSessionShareProvider(): ShareProvider {
  return sessionShareProviderForTests ?? createViewerShareProvider()
}

export function setSessionShareProviderForTests(provider: ShareProvider | null): void {
  sessionShareProviderForTests = provider
}
