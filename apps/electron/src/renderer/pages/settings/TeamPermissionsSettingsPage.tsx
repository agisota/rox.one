/**
 * TeamPermissionsSettingsPage
 *
 * Settings page wrapper for the M.2 T228 RBAC admin UI. Bridges the
 * transport-agnostic `RolesPanel` (under
 * `@/components/settings/rbac`) to the renderer's electronAPI surface.
 *
 * The adapter calls the four `roles.*` RPCs declared in
 * `RPC_CHANNELS.roles`. We treat any non-electronAPI host (e.g. the
 * test environment) as missing and let the panel surface a
 * `rbac-not-configured` style error.
 */

import * as React from 'react'
import { PanelHeader } from '@/components/app-shell/PanelHeader'
import { HeaderMenu } from '@/components/ui/HeaderMenu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { routes } from '@/lib/navigate'
import type { DetailsPageMeta } from '@/lib/navigation-registry'
import { RolesPanel, RolesPanelContext, type RolesPanelRpcClient } from '@/components/settings/rbac'

export const meta: DetailsPageMeta = {
  navigator: 'settings',
  slug: 'team-permissions',
}

/**
 * Build the RPC adapter for the renderer host. We deliberately keep
 * this thin so the panel stays portable — the panel asks for
 * `invoke(channel, ...args)` and nothing else.
 */
function useRolesRpcClient(): RolesPanelRpcClient {
  return React.useMemo<RolesPanelRpcClient>(() => ({
    invoke: async (channel: string, ...args: unknown[]) => {
      const api = typeof window !== 'undefined' ? window.electronAPI : undefined
      const invokeOnServer = (api as unknown as { invokeOnServer?: (url: string, token: string, channel: string, ...args: unknown[]) => Promise<unknown> } | undefined)?.invokeOnServer
      if (!invokeOnServer) {
        return { error: 'rbac-not-configured', reason: 'no-renderer-transport' }
      }
      // The RolesPanel only needs the channel name; the renderer
      // transport resolves the active workspace's server itself when
      // url/token are empty strings.
      return await invokeOnServer('', '', channel, ...args)
    },
  }), [])
}

export default function TeamPermissionsSettingsPage() {
  const rpcClient = useRolesRpcClient()

  return (
    <div className="h-full flex flex-col">
      <PanelHeader title="Team & permissions" actions={<HeaderMenu route={routes.view.settings('team-permissions')} />} />
      <div className="flex-1 min-h-0 mask-fade-y">
        <ScrollArea className="h-full">
          <div className="px-5 py-7 max-w-3xl mx-auto">
            <RolesPanelContext.Provider
              value={{
                rpcClient,
                callerUserId: null,
              }}
            >
              <RolesPanel />
            </RolesPanelContext.Provider>
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
