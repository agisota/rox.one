#!/usr/bin/env bun
import { readFileSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()

function fail(message: string): never {
  console.error(`[release-all-platforms-workflow] ${message}`)
  process.exit(1)
}

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8')
}

function requireText(source: string, expected: string, description: string): void {
  if (!source.includes(expected)) fail(`missing ${description}: ${expected}`)
}

function requireAnyText(source: string, expectedOptions: string[], description: string): void {
  if (!expectedOptions.some((expected) => source.includes(expected))) {
    fail(`missing ${description}: one of ${expectedOptions.join(' | ')}`)
  }
}

function requireOrder(source: string, before: string, after: string, description: string): void {
  const beforeIndex = source.indexOf(before)
  const afterIndex = source.indexOf(after)
  if (beforeIndex < 0) fail(`missing ${description} before-token: ${before}`)
  if (afterIndex < 0) fail(`missing ${description} after-token: ${after}`)
  if (beforeIndex > afterIndex) fail(`wrong order for ${description}: ${before} must appear before ${after}`)
}

function stepBlock(source: string, stepName: string): string {
  const marker = `      - name: ${stepName}`
  const start = source.indexOf(marker)
  if (start < 0) fail(`missing step: ${stepName}`)
  const next = source.indexOf('\n      - name: ', start + marker.length)
  return source.slice(start, next < 0 ? source.length : next)
}

const workflow = read('.github/workflows/release-all-platforms.yml')
const builderConfig = read('apps/electron/electron-builder.yml')
const packageJson = JSON.parse(read('package.json'))
const scripts = packageJson.scripts ?? {}

for (const scriptName of [
  'validate:release-all-platforms-workflow',
  'validate:release-feed-assets',
  'validate:release-notes-feed',
  'release:stamp-version',
]) {
  if (typeof scripts[scriptName] !== 'string' || scripts[scriptName].length === 0) {
    fail(`package.json missing script: ${scriptName}`)
  }
}

if (!String(scripts['validate:ci'] ?? '').includes('validate:release-all-platforms-workflow')) {
  fail('validate:ci does not include validate:release-all-platforms-workflow')
}

requireText(builderConfig, 'detectUpdateChannel: true', 'electron-builder channel detection')
requireText(builderConfig, 'generateUpdatesFilesForAllChannels: true', 'electron-builder all-channel update metadata')
requireText(builderConfig, 'provider: generic', 'generic update publisher')

for (const required of [
  'RELEASE_CHANNEL=stable',
  'RELEASE_CHANNEL=beta',
  'ELECTRON_UPDATE_CHANNEL=latest',
  'ELECTRON_UPDATE_CHANNEL=beta',
  'ELECTRON_BUILDER_CHANNEL: ${{ env.ELECTRON_UPDATE_CHANNEL }}',
  'scripts/validate-release-feed-assets.ts .manifest-bin "${RELEASE_CHANNEL}"',
  'scripts/validate-release-notes-feed.ts .manifest-out/release-notes.json "$VERSION" "$RELEASE_CHANNEL"',
  '.manifest-out/release-notes.json',
  'release-notes.json',
  'https://app.rox.one/electron/${RELEASE_CHANNEL}/manifest.json',
  'bun run release:stamp-version "$RELEASE_TAG"',
  'bun run check-version',
]) {
  requireText(workflow, required, 'release-all-platforms update-feed contract')
}

for (const stepName of [
  'Publish Mac ARM64 artifacts to GitHub Release',
  'Publish Linux x64 artifacts to GitHub Release',
  'Publish Windows x64 artifacts to GitHub Release',
]) {
  const block = stepBlock(workflow, stepName)
  requireText(block, 'draft: true', `${stepName} stays draft until aggregate manifest is ready`)
  requireText(block, 'prerelease: ${{ env.RELEASE_CHANNEL == \'beta\' }}', `${stepName} prerelease flag follows channel`)
  requireText(block, 'apps/electron/release/*.yml', `${stepName} uploads electron-updater YAML metadata`)
}

const finalAttachBlock = stepBlock(workflow, 'Attach manifest.json + install scripts to GitHub Release')
requireAnyText(finalAttachBlock, ['draft: false', '-F draft=false'], 'final attach publishes release after all assets validate')
requireText(finalAttachBlock, '.manifest-out/manifest.json', 'final attach includes manifest.json')
requireText(finalAttachBlock, '.manifest-out/release-notes.json', 'final attach includes release-notes.json')
requireText(finalAttachBlock, 'scripts/install-app.sh', 'final attach includes shell installer')
requireText(finalAttachBlock, 'scripts/install-app.ps1', 'final attach includes PowerShell installer')

const publishManifestStart = workflow.indexOf('  publish-manifest:')
if (publishManifestStart < 0) fail('missing publish-manifest job')
const publishManifest = workflow.slice(publishManifestStart)
requireText(publishManifest, 'Checkout tag', 'publish-manifest source checkout')
requireText(publishManifest, 'Setup Bun 1.3.11', 'publish-manifest Bun setup')
requireOrder(publishManifest, 'Checkout tag', 'Validate release-feed assets', 'publish-manifest checkout before scripts')
requireOrder(workflow, 'Setup Bun 1.3.11', 'bun run release:stamp-version "$RELEASE_TAG"', 'build job stamps package version after Bun setup')
requireOrder(workflow, 'bun run release:stamp-version "$RELEASE_TAG"', 'Install dependencies', 'build job stamps package version before install/build')
requireOrder(workflow, 'bun run release:stamp-version "$RELEASE_TAG"', 'bun run check-version', 'version stamp before version check')
requireOrder(publishManifest, 'Setup Bun 1.3.11', 'Validate release-feed assets', 'publish-manifest Bun setup before scripts')
requireOrder(publishManifest, 'Validate release-feed assets', 'Build aggregate manifest.json', 'hard metadata gate before manifest build')
requireOrder(publishManifest, 'Build release-notes.json', 'Attach manifest.json + install scripts to GitHub Release', 'release notes before final publish')

console.log('[release-all-platforms-workflow] ok: update-feed workflow contract passed')
