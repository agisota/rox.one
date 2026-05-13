/**
 * RolesPanelContext — minimal RPC bridge for the RBAC admin panel.
 *
 * The panel components are transport-agnostic. They receive a tiny
 * `{invoke(channel, ...args)}` shim through context, which keeps unit
 * tests free of any `window.electronAPI` mock and lets the settings
 * page wrapper supply the real adapter at render time.
 *
 * `initialState` is an optional pre-seeded reducer state used by tests
 * and by the page wrapper when it has already loaded roles eagerly.
 * Production renderers usually omit it and let `RolesPanel` issue the
 * `roles.list` call on mount.
 */

import * as React from 'react'
import type { Role, RoleGrant } from '@rox-one/shared/auth'

export interface RolesPanelRpcClient {
  invoke(channel: string, ...args: unknown[]): Promise<unknown>
}

export interface RolesPanelInitialState {
  status?: 'loading' | 'ready' | 'error'
  roles?: Role[]
  grants?: RoleGrant[]
  error?: string | null
}

export interface RolesPanelContextValue {
  rpcClient: RolesPanelRpcClient
  callerUserId: string | null
  initialState?: RolesPanelInitialState
}

export const RolesPanelContext = React.createContext<RolesPanelContextValue | null>(null)

export function useRolesPanelContext(): RolesPanelContextValue {
  const value = React.useContext(RolesPanelContext)
  if (!value) {
    throw new Error('RolesPanelContext is missing — wrap RolesPanel in a RolesPanelContext.Provider')
  }
  return value
}
