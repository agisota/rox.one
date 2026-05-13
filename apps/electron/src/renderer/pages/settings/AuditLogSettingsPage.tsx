/**
 * AuditLogSettingsPage
 *
 * Settings page wrapper for the M.2 T232 audit-log surface. Mounts the
 * `AuditLogPanel` under `/settings/audit-log` and supplies an
 * `AuditEventSource` backed by the renderer transport.
 *
 * T232 deliberately stops at the source interface — the RPC handler
 * that materialises events for the renderer is tracked separately as
 * T232b. Until that lands, the source returns an empty list and the
 * panel renders its empty state cleanly.
 */

import * as React from 'react'
import { PanelHeader } from '@/components/app-shell/PanelHeader'
import { HeaderMenu } from '@/components/ui/HeaderMenu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { routes } from '@/lib/navigate'
import type { DetailsPageMeta } from '@/lib/navigation-registry'
import type { AuditEvent } from '@rox-one/shared/observability'
import {
  AuditLogPanel,
  AuditLogPanelContext,
  type AuditEventSource,
} from '@/components/settings/rbac'

export const meta: DetailsPageMeta = {
  navigator: 'settings',
  slug: 'audit-log',
}

/**
 * Renderer-transport-backed audit source.
 *
 * Calls `audit.list` over the shared `invokeOnServer('', '', ...)`
 * shim used by the other RBAC settings pages. Until T232b lands the
 * matching server handler the call returns an `error` object; we
 * detect that and resolve to an empty list so the panel still
 * renders the empty state instead of bubbling a transport error.
 */
function useAuditEventSource(): AuditEventSource {
  return React.useMemo<AuditEventSource>(() => ({
    async list(): Promise<AuditEvent[]> {
      const api = typeof window !== 'undefined' ? window.electronAPI : undefined
      const invokeOnServer = (api as unknown as {
        invokeOnServer?: (
          url: string,
          token: string,
          channel: string,
          ...args: unknown[]
        ) => Promise<unknown>
      } | undefined)?.invokeOnServer
      if (!invokeOnServer) {
        return []
      }
      const raw = await invokeOnServer('', '', 'audit.list')
      if (Array.isArray(raw)) return raw as AuditEvent[]
      // An `{ error: ... }` envelope means the server handler is not
      // wired yet (T232b) or the caller lacks permission. Either way
      // the read-only panel should degrade to an empty state, not
      // throw.
      return []
    },
  }), [])
}

export default function AuditLogSettingsPage(): React.ReactElement {
  const source = useAuditEventSource()

  return (
    <div className="h-full flex flex-col">
      <PanelHeader
        title="Audit log"
        actions={<HeaderMenu route={routes.view.settings('audit-log')} />}
      />
      <div className="flex-1 min-h-0 mask-fade-y">
        <ScrollArea className="h-full">
          <div className="px-5 py-7 max-w-3xl mx-auto">
            <AuditLogPanelContext.Provider value={{ source }}>
              <AuditLogPanel />
            </AuditLogPanelContext.Provider>
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
