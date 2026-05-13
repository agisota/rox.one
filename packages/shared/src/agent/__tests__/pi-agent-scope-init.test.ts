import { afterEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { PiAgent } from '../pi-agent.ts'
import { createMockBackendConfig, createMockSession, createMockWorkspace } from './test-utils.ts'

function createFakePiServer(tempDir: string): { scriptPath: string; outputPath: string } {
  const scriptPath = join(tempDir, 'fake-pi-server.cjs')
  const outputPath = join(tempDir, 'init-payload.json')
  writeFileSync(
    scriptPath,
    `
const fs = require('node:fs');
const readline = require('node:readline');

const outputPath = process.env.ROX_PI_INIT_CAPTURE_PATH;
const rl = readline.createInterface({ input: process.stdin });

rl.on('line', (line) => {
  const message = JSON.parse(line);
  if (message.type === 'init') {
    fs.writeFileSync(outputPath, JSON.stringify({
      init: message,
      tokenEnv: process.env.CRAFT_PI_SCOPE_IPC_TOKEN || null,
    }));
    process.stdout.write(JSON.stringify({ type: 'ready', sessionId: null, callbackPort: 0 }) + '\\n');
    return;
  }
  if (message.type === 'set_auto_compaction') {
    process.stdout.write(JSON.stringify({
      type: 'set_auto_compaction_result',
      id: message.id,
      success: true,
      enabled: message.enabled,
    }) + '\\n');
    return;
  }
  if (message.type === 'shutdown') {
    process.exit(0);
  }
});
`,
  )

  return { scriptPath, outputPath }
}

describe('PiAgent scope init payload', () => {
  const previousCapturePath = process.env.ROX_PI_INIT_CAPTURE_PATH
  let tempDir: string | null = null

  afterEach(() => {
    if (previousCapturePath === undefined) delete process.env.ROX_PI_INIT_CAPTURE_PATH
    else process.env.ROX_PI_INIT_CAPTURE_PATH = previousCapturePath
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true })
      tempDir = null
    }
  })

  it('sends storage-scope auth inputs and a matching one-time token in init', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'pi-agent-scope-init-'))
    const { scriptPath, outputPath } = createFakePiServer(tempDir)
    process.env.ROX_PI_INIT_CAPTURE_PATH = outputPath

    const workspaceRoot = join(tempDir, 'workspace')
    mkdirSync(workspaceRoot, { recursive: true })
    const agent = new PiAgent(createMockBackendConfig({
      provider: 'pi',
      workspace: createMockWorkspace({
        id: 'W42',
        rootPath: workspaceRoot,
      }),
      session: createMockSession({
        id: 'session-1',
        workspaceRootPath: workspaceRoot,
      }),
      runtime: {
        paths: {
          node: Bun.which('node') ?? process.execPath,
          piServer: scriptPath,
        },
        dependencyRiskMode: 'private-local',
        customEndpoint: { api: 'anthropic-messages' },
        storageScopeAuth: {
          requestedWorkspaceId: 'W42',
          permittedWorkspaces: ['W42'],
          userId: 'u1',
          reqId: 'session-1',
        },
      },
    }))

    try {
      await (agent as any).spawnSubprocess()

      expect(existsSync(outputPath)).toBe(true)
      const captured = JSON.parse(readFileSync(outputPath, 'utf8'))

      expect(captured.init.storageScopeAuth).toMatchObject({
        requestedWorkspaceId: 'W42',
        permittedWorkspaces: ['W42'],
        userId: 'u1',
        reqId: 'session-1',
      })
      expect(typeof captured.init.storageScopeAuth.integrityToken).toBe('string')
      expect(captured.init.storageScopeAuth.integrityToken.length).toBeGreaterThan(0)
      expect(captured.tokenEnv).toBe(captured.init.storageScopeAuth.integrityToken)
    } finally {
      agent.destroy()
    }
  })
})
