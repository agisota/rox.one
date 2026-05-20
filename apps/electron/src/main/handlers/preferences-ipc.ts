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
import type { HandlerDeps } from './handler-deps'
import { createAutoLaunchDesignPrefs, type AutoLaunchDesignChoice } from '../preferences/auto-launch-design'

export const PREFERENCES_IPC_CHANNELS = {
  GET_AUTO_LAUNCH_DESIGN: 'preferences:get-auto-launch-design',
  SET_AUTO_LAUNCH_DESIGN: 'preferences:set-auto-launch-design',
} as const

export function registerPreferencesIpcHandlers(server: RpcServer, _deps: HandlerDeps): void {
  const prefs = createAutoLaunchDesignPrefs(app.getPath('userData'))

  server.handle(PREFERENCES_IPC_CHANNELS.GET_AUTO_LAUNCH_DESIGN, async () => {
    return prefs.readAutoLaunchDesignChoice()
  })

  server.handle(PREFERENCES_IPC_CHANNELS.SET_AUTO_LAUNCH_DESIGN, async (_ctx, choice: AutoLaunchDesignChoice) => {
    await prefs.writeAutoLaunchDesignChoice(choice)
    return { success: true }
  })
}
