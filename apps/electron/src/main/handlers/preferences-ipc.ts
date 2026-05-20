/**
 * preferences-ipc.ts
 *
 * IPC handlers for the auto-launch-design preference.
 * Exposes get/set endpoints consumed by the renderer via window.electronAPI.
 *
 * Phase D / T537 PR #4
 */

import { app } from 'electron'
import type { RpcServer } from '@rox-one/server-core/transport'
import { RPC_CHANNELS } from '../../shared/types'
import type { HandlerDeps } from './handler-deps'
import { createAutoLaunchDesignPrefs, type AutoLaunchDesignChoice } from '../preferences/auto-launch-design'

export function registerPreferencesIpcHandlers(server: RpcServer, _deps: HandlerDeps): void {
  const prefs = createAutoLaunchDesignPrefs(app.getPath('userData'))

  server.handle(RPC_CHANNELS.preferences.GET_AUTO_LAUNCH_DESIGN, async () => {
    return prefs.readAutoLaunchDesignChoice()
  })

  server.handle(RPC_CHANNELS.preferences.SET_AUTO_LAUNCH_DESIGN, async (_ctx, choice: AutoLaunchDesignChoice) => {
    await prefs.writeAutoLaunchDesignChoice(choice)
    return { success: true }
  })
}
