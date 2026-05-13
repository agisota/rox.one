import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { RPC_CHANNELS } from '../../../shared/types'
import { DEFAULT_LOCAL_SCOPE } from '../../../../../../packages/shared/src/config/storage-scope.ts'
import {
  __resetMultiTenantForTests,
  __setMultiTenantForTests,
} from '../../../../../../packages/shared/src/config/storage-scope-runtime.ts'
import {
  ELECTRON_GLOBAL_STORAGE_SCOPE,
  ELECTRON_GLOBAL_STORAGE_SCOPE_REASON,
} from '../storage-scope'
import type { RpcServer } from '@craft-agent/server-core/transport'
import type { HandlerDeps } from '../handler-deps'

mock.module('electron', () => ({
  app: {
    isPackaged: false,
    getAppPath: () => '/',
    quit: () => {},
    dock: { setIcon: () => {}, setBadge: () => {} },
  },
  nativeTheme: { shouldUseDarkColors: false },
  nativeImage: {
    createFromPath: () => ({ isEmpty: () => true }),
    createFromDataURL: () => ({}),
  },
  dialog: {
    showOpenDialog: async () => ({ canceled: true, filePaths: [] }),
    showMessageBox: async () => ({ response: 0 }),
  },
  shell: {
    openExternal: async () => {},
    openPath: async () => '',
    showItemInFolder: () => {},
  },
  powerSaveBlocker: {
    start: () => 1,
    stop: () => {},
    isStarted: () => false,
  },
  BrowserWindow: {
    fromWebContents: () => null,
    getFocusedWindow: () => null,
    getAllWindows: () => [],
  },
  screen: {
    getDisplayMatching: () => ({ workArea: { x: 0, y: 0, width: 1440, height: 900 } }),
  },
  BrowserView: class {},
  Menu: {
    buildFromTemplate: () => ({ popup: () => {} }),
  },
  session: {},
}))

mock.module('../../power-manager', () => ({
  setKeepAwakeSetting: () => {},
}))

type HandlerFn = (ctx: {
  clientId: string
  workspaceId: string | null
  webContentsId: number | null
  userId?: string | null
  sessionId?: string | null
}, ...args: any[]) => Promise<any> | any

const testDir = dirname(fileURLToPath(import.meta.url))
const handlersDir = resolve(testDir, '..')

const expectedGlobalStorageCalls = [
  'system.ts:getGitBashPath(ELECTRON_GLOBAL_STORAGE_SCOPE)',
  'system.ts:clearGitBashPath(ELECTRON_GLOBAL_STORAGE_SCOPE)',
  'system.ts:setGitBashPath(bashPath, ELECTRON_GLOBAL_STORAGE_SCOPE)',
  'system.ts:setGitBashPath(firstPath, ELECTRON_GLOBAL_STORAGE_SCOPE)',
  'system.ts:setGitBashPath(validation.path, ELECTRON_GLOBAL_STORAGE_SCOPE)',
  'system.ts:setDismissedUpdateVersion(version, ELECTRON_GLOBAL_STORAGE_SCOPE)',
  'system.ts:getDismissedUpdateVersion(ELECTRON_GLOBAL_STORAGE_SCOPE)',
  'system.ts:getNotificationsEnabled(ELECTRON_GLOBAL_STORAGE_SCOPE)',
  'system.ts:setNotificationsEnabled(enabled, ELECTRON_GLOBAL_STORAGE_SCOPE)',
  'settings.ts:setKeepAwakeWhileRunning(enabled, ELECTRON_GLOBAL_STORAGE_SCOPE)',
]

function source(relativePath: string): string {
  return readFileSync(join(handlersDir, relativePath), 'utf8')
}

function createServer(): { server: RpcServer; handlers: Map<string, HandlerFn> } {
  const handlers = new Map<string, HandlerFn>()
  return {
    handlers,
    server: {
      handle(channel, handler) {
        handlers.set(channel, handler as HandlerFn)
      },
      push() {},
      async invokeClient() {
        return undefined
      },
    },
  }
}

function createDeps(): HandlerDeps {
  return {
    sessionManager: {
      waitForInit: async () => {},
      refreshBadge: () => {},
    } as unknown as HandlerDeps['sessionManager'],
    platform: {
      appRootPath: '',
      resourcesPath: '',
      isPackaged: false,
      appVersion: '0.0.0-test',
      isDebugMode: true,
      logger: {
        info: () => {},
        warn: () => {},
        error: () => {},
        debug: () => {},
      },
      quit: () => {},
      imageProcessor: {
        getMetadata: async () => null,
        process: async () => Buffer.from(''),
      },
    },
    windowManager: {
      getWorkspaceForWindow: () => 'W42',
      getWindowByWebContentsId: () => null,
      createWindow: () => {},
    } as unknown as HandlerDeps['windowManager'],
    oauthFlowStore: {
      store: () => {},
      getByState: () => null,
      remove: () => {},
      cleanup: () => {},
      dispose: () => {},
      get size() { return 0 },
    } as unknown as HandlerDeps['oauthFlowStore'],
  }
}

function writeConfig(scopeRoot: string): void {
  mkdirSync(scopeRoot, { recursive: true })
  writeFileSync(
    join(scopeRoot, 'config.json'),
    JSON.stringify({
      workspaces: [],
      activeWorkspaceId: null,
      activeSessionId: null,
      notificationsEnabled: true,
      keepAwakeWhileRunning: false,
    }, null, 2),
    'utf8',
  )
}

function readConfig(scopeRoot: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(scopeRoot, 'config.json'), 'utf8')) as Record<string, unknown>
}

describe('Electron main handler storage scope contract (C4)', () => {
  let previousConfigDir: string | undefined
  let configRoot: string

  beforeEach(() => {
    previousConfigDir = process.env.CRAFT_CONFIG_DIR
    configRoot = mkdtempSync(join(tmpdir(), 'rox-electron-global-scope-'))
    process.env.CRAFT_CONFIG_DIR = configRoot
    writeConfig(configRoot)
    writeConfig(join(configRoot, 'tenants', 'W42'))
    __resetMultiTenantForTests()
  })

  afterEach(() => {
    __resetMultiTenantForTests()
    if (previousConfigDir === undefined) delete process.env.CRAFT_CONFIG_DIR
    else process.env.CRAFT_CONFIG_DIR = previousConfigDir
    rmSync(configRoot, { recursive: true, force: true })
  })

  it('documents Electron headless/global settings with a named storage scope', () => {
    expect(ELECTRON_GLOBAL_STORAGE_SCOPE).toBe(DEFAULT_LOCAL_SCOPE)
    expect(ELECTRON_GLOBAL_STORAGE_SCOPE.kind).toBe('local-single-user')
    expect(ELECTRON_GLOBAL_STORAGE_SCOPE_REASON).toContain('machine-wide')
  })

  it('centralizes direct DEFAULT_LOCAL_SCOPE usage away from Electron handler files', () => {
    for (const relativePath of ['system.ts', 'settings.ts', 'workspace.ts', 'browser.ts']) {
      expect(source(relativePath)).not.toContain('DEFAULT_LOCAL_SCOPE')
    }
  })

  it('keeps the global storage callsite inventory exact', () => {
    const matches = ['system.ts', 'settings.ts'].flatMap((relativePath) => {
      const content = source(relativePath)
      return [...content.matchAll(/\b(?:getGitBashPath|setGitBashPath|clearGitBashPath|setDismissedUpdateVersion|getDismissedUpdateVersion|getNotificationsEnabled|setNotificationsEnabled|setKeepAwakeWhileRunning)\([^)]*ELECTRON_GLOBAL_STORAGE_SCOPE\)/g)]
        .map((match) => `${relativePath}:${match[0]}`)
    })

    expect(matches).toEqual(expectedGlobalStorageCalls)
  })

  it('keeps documented global settings in flat storage under multi-tenant runtime', async () => {
    __setMultiTenantForTests(true)
    const { server, handlers } = createServer()
    const deps = createDeps()
    const { registerSystemGuiHandlers } = await import('../system')
    const { registerSettingsGuiHandlers } = await import('../settings')
    registerSystemGuiHandlers(server, deps)
    registerSettingsGuiHandlers(server, deps)

    const ctx = {
      clientId: 'client-electron-global-scope',
      workspaceId: 'W42',
      webContentsId: 1,
      userId: 'u1',
      sessionId: 's1',
    }

    await handlers.get(RPC_CHANNELS.update.DISMISS)!(ctx, '9.9.9-test')
    await handlers.get(RPC_CHANNELS.notification.SET_ENABLED)!(ctx, false)
    await handlers.get(RPC_CHANNELS.power.SET_KEEP_AWAKE)!(ctx, true)

    const flatConfig = readConfig(configRoot)
    const tenantConfig = readConfig(join(configRoot, 'tenants', 'W42'))

    expect(flatConfig.dismissedUpdateVersion).toBe('9.9.9-test')
    expect(flatConfig.notificationsEnabled).toBe(false)
    expect(flatConfig.keepAwakeWhileRunning).toBe(true)
    expect(tenantConfig.dismissedUpdateVersion).toBeUndefined()
    expect(tenantConfig.notificationsEnabled).toBe(true)
    expect(tenantConfig.keepAwakeWhileRunning).toBe(false)
  })
})
