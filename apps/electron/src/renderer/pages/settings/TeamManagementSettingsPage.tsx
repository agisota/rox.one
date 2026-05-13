/**
 * TeamManagementSettingsPage
 *
 * Settings page wrapper for the M.2 T231 actor-grouped view. Reuses
 * the `RolesPanelContext` from T228 so a single RPC adapter is enough
 * to drive both the role-grouped panel (Team & permissions) and this
 * actor-grouped view (Team management).
 *
 * The adapter is identical to `TeamPermissionsSettingsPage` — the
 * panel asks for `invoke(channel, ...args)` and the renderer
 * transport resolves the active workspace's server itself when the
 * URL/token are empty strings.
 */

import * as React from 'react'
import { PanelHeader } from '@/components/app-shell/PanelHeader'
import { HeaderMenu } from '@/components/ui/HeaderMenu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { routes } from '@/lib/navigate'
import type { DetailsPageMeta } from '@/lib/navigation-registry'
import {
  RolesPanelContext,
  TeamManagementPanel,
  type RolesPanelRpcClient,
} from '@/components/settings/rbac'

export const meta: DetailsPageMeta = {
  navigator: 'settings',
  slug: 'team-management',
}

function useRolesRpcClient(): RolesPanelRpcClient {
  return React.useMemo<RolesPanelRpcClient>(() => ({
    invoke: async (channel: string, ...args: unknown[]) => {
      const api = typeof window !== 'undefined' ? window.electronAPI : undefined
      const invokeOnServer = (api as unknown as {
        invokeOnServer?: (url: string, token: string, channel: string, ...args: unknown[]) => Promise<unknown>
      } | undefined)?.invokeOnServer
      if (!invokeOnServer) {
        return { error: 'rbac-not-configured', reason: 'no-renderer-transport' }
      }
      return await invokeOnServer('', '', channel, ...args)
    },
  }), [])
}

export default function TeamManagementSettingsPage() {
  const rpcClient = useRolesRpcClient()

  return (
    <div className="h-full flex flex-col">
      <PanelHeader title="Team management" actions={<HeaderMenu route={routes.view.settings('team-management')} />} />
      <div className="flex-1 min-h-0 mask-fade-y">
        <ScrollArea className="h-full">
          <div className="px-5 py-7 max-w-3xl mx-auto">
            <RolesPanelContext.Provider
              value={{
                rpcClient,
                callerUserId: null,
              }}
            >
              <TeamManagementPanel />
            </RolesPanelContext.Provider>
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
