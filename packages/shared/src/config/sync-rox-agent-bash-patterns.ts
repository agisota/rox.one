#!/usr/bin/env bun

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { getRoxAgentReadOnlyBashPatterns } from './cli-domains.ts'

interface AllowedBashEntry {
  pattern: string
  comment?: string
}

interface PermissionsConfig {
  version?: string
  allowedBashPatterns?: AllowedBashEntry[]
  [key: string]: unknown
}

function isRoxAgentPattern(entry: AllowedBashEntry): boolean {
  return typeof entry.pattern === 'string' && entry.pattern.startsWith('^rox-agent\\s')
}

function syncRoxAgentPatterns(config: PermissionsConfig): PermissionsConfig {
  const patterns = config.allowedBashPatterns ?? []
  const firstRoxIndex = patterns.findIndex(isRoxAgentPattern)

  const withoutRox = patterns.filter(entry => !isRoxAgentPattern(entry))
  const generated = getRoxAgentReadOnlyBashPatterns()

  const insertAt = firstRoxIndex >= 0 ? firstRoxIndex : withoutRox.length
  const nextAllowedBashPatterns = [
    ...withoutRox.slice(0, insertAt),
    ...generated,
    ...withoutRox.slice(insertAt),
  ]

  return {
    ...config,
    allowedBashPatterns: nextAllowedBashPatterns,
  }
}

function main() {
  const targetPath = process.argv[2]
    ? resolve(process.argv[2])
    : resolve(process.cwd(), 'apps/electron/resources/permissions/default.json')

  const config = JSON.parse(readFileSync(targetPath, 'utf-8')) as PermissionsConfig
  const nextConfig = syncRoxAgentPatterns(config)

  writeFileSync(targetPath, `${JSON.stringify(nextConfig, null, 2)}\n`, 'utf-8')
  process.stdout.write(`Synced rox-agent bash patterns in ${targetPath}\n`)
}

if (import.meta.main) {
  main()
}
