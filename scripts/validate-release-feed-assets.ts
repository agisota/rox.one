#!/usr/bin/env bun
import { readdirSync, statSync } from 'node:fs'
import { join, basename } from 'node:path'

type Channel = 'stable' | 'beta'

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) walk(full, out)
    else out.push(full)
  }
  return out
}

function fail(message: string): never {
  console.error(`[validate-release-feed-assets] ${message}`)
  process.exit(1)
}

const root = process.argv[2]
const channel = process.argv[3] as Channel | undefined
if (!root) fail('usage: validate-release-feed-assets.ts <artifact-root> <stable|beta>')
if (channel !== 'stable' && channel !== 'beta') fail('channel must be stable or beta')

const files = walk(root)
const names = new Set(files.map((file) => basename(file)))
const requiredMetadata = channel === 'stable'
  ? ['latest-mac.yml', 'latest.yml', 'latest-linux.yml']
  : ['beta-mac.yml', 'beta.yml', 'beta-linux.yml']

for (const name of requiredMetadata) {
  if (!names.has(name)) fail(`missing required ${channel} metadata: ${name}`)
}

const requiredPatterns = [
  /^ROX-ONE-(arm64|x64)\.zip$/,
  /^ROX-ONE-(arm64|x64)\.dmg$/,
  /^ROX-ONE-x64\.exe$/,
  /^ROX-ONE-(x64|x86_64)\.AppImage$/,
]

for (const pattern of requiredPatterns) {
  if (![...names].some((name) => pattern.test(name))) fail(`missing required artifact matching ${pattern}`)
}

console.log(`[validate-release-feed-assets] ok: ${channel}, ${files.length} files`)
