import { describe, expect, it } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const rootDir = join(import.meta.dir, '..', '..')

function readRepoFile(relativePath: string): string {
  return readFileSync(join(rootDir, relativePath), 'utf8')
}

function listFiles(relativeDir: string, suffix: string): string[] {
  return readdirSync(join(rootDir, relativeDir))
    .filter(file => file.endsWith(suffix))
    .map(file => join(relativeDir, file))
}

describe('R.1 surface text rebrand', () => {
  it('renames legacy i18n keys and consumers', () => {
    const localeFiles = listFiles('packages/shared/src/i18n/locales', '.json')
    for (const relativePath of localeFiles) {
      const content = readRepoFile(relativePath)
      expect(content).not.toContain('"menu.craftMenu"')
      expect(content).not.toContain('"onboarding.apiSetup.craftAgentsBackend"')
      expect(content).toContain('"menu.appMenu"')
      expect(content).toContain('"onboarding.apiSetup.roxBackend"')
    }

    const consumerFiles = [
      'apps/electron/src/renderer/components/onboarding/APISetupStep.tsx',
      'apps/electron/src/renderer/components/app-shell/TopBar.tsx',
    ]
    for (const relativePath of consumerFiles) {
      const content = readRepoFile(relativePath)
      expect(content).not.toContain('menu.craftMenu')
      expect(content).not.toContain('onboarding.apiSetup.craftAgentsBackend')
    }
    expect(readRepoFile(consumerFiles[0])).toContain('onboarding.apiSetup.roxBackend')
    expect(readRepoFile(consumerFiles[1])).toContain('menu.appMenu')
  })

  it('keeps active README body copy free of legacy product prose', () => {
    const readme = readRepoFile('README.md')
    const activeBody = readme.split(/^## License$/m)[0] ?? readme
    expect(activeBody).not.toContain('Craft Agents')
    expect(activeBody).not.toContain('Craft Agent')
  })

  it('uses the ROX log path in active automations docs', () => {
    const automations = readRepoFile('apps/electron/resources/docs/automations.md')
    expect(automations).not.toContain('~/.craft-agent/logs/messaging-gateway.log')
    expect(automations).toContain('~/.rox/logs/messaging-gateway.log')
  })

  it('uses ROX.ONE title and application-name metadata in HTML entrypoints', () => {
    const htmlFiles = [
      ...listFiles('apps/electron/src/renderer', '.html'),
      ...listFiles('apps/webui/src', '.html'),
    ]

    for (const relativePath of htmlFiles) {
      const content = readRepoFile(relativePath)
      expect(content).toContain('<title>ROX.ONE</title>')
      expect(content).toContain('<meta name="application-name" content="ROX.ONE"')
    }
  })

  it('uses ROX.ONE in messaging playground demo labels', () => {
    const demoFiles = listFiles('apps/electron/src/renderer/playground/demos/messaging', '.tsx')
    for (const relativePath of demoFiles) {
      const content = readRepoFile(relativePath)
      expect(content).not.toContain('Craft Agents')
      expect(content).not.toContain('Craft Agent')
    }
    expect(demoFiles.some(file => readRepoFile(file).includes('ROX.ONE'))).toBe(true)
  })
})
