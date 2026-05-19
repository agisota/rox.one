#!/usr/bin/env bun
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { valid as isValidSemver } from 'semver'

type PackageJson = {
  name?: string
  version?: string
  [key: string]: unknown
}

const TAG_PATTERN = /^v\d+\.\d+\.\d+(-(rc|beta)\.\d+)?$/
const packageFiles = [
  '../package.json',
  '../apps/electron/package.json',
]

function fail(message: string): never {
  console.error(`[stamp-release-version] ${message}`)
  process.exit(1)
}

function packagePath(relativePath: string): string {
  return fileURLToPath(new URL(relativePath, import.meta.url))
}

function readPackage(path: string): PackageJson {
  return JSON.parse(readFileSync(path, 'utf8')) as PackageJson
}

function writePackage(path: string, pkg: PackageJson): void {
  writeFileSync(path, `${JSON.stringify(pkg, null, 2)}\n`)
}

function resolveVersion(rawTag: string | undefined): string {
  if (!rawTag) {
    fail('usage: bun run release:stamp-version <vX.Y.Z|vX.Y.Z-beta.N|vX.Y.Z-rc.N>')
  }

  const tag = rawTag.replace(/^refs\/tags\//, '')
  if (!TAG_PATTERN.test(tag)) {
    fail(`release tag '${rawTag}' does not match vX.Y.Z, vX.Y.Z-beta.N, or vX.Y.Z-rc.N`)
  }

  const version = tag.slice(1)
  if (!isValidSemver(version)) {
    fail(`release tag '${rawTag}' resolves to invalid semver '${version}'`)
  }

  return version
}

async function main(): Promise<void> {
  const version = resolveVersion(process.argv[2])

  for (const relativePath of packageFiles) {
    const path = packagePath(relativePath)
    const pkg = readPackage(path)
    const previous = pkg.version
    pkg.version = version
    writePackage(path, pkg)
    console.log(`[stamp-release-version] ${relativePath.replace('../', '')}: ${previous ?? '<missing>'} -> ${version}`)
  }
}

await main()
