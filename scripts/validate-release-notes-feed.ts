#!/usr/bin/env bun
const file = process.argv[2]
const expectedVersion = process.argv[3]
const expectedChannel = process.argv[4]
function fail(message: string): never {
  console.error(`[validate-release-notes-feed] ${message}`)
  process.exit(1)
}
if (!file || !expectedVersion || !expectedChannel) fail('usage: validate-release-notes-feed.ts <file> <version> <channel>')
const payload = await Bun.file(file).json().catch((error) => fail(`invalid JSON: ${error}`)) as any
if (payload.version !== expectedVersion) fail(`version mismatch: ${payload.version} !== ${expectedVersion}`)
if (payload.channel !== expectedChannel) fail(`channel mismatch: ${payload.channel} !== ${expectedChannel}`)
if (!Array.isArray(payload.releases) || payload.releases.length === 0) fail('releases[] is required')
const first = payload.releases[0]
if (first.version !== expectedVersion) fail(`first release version mismatch: ${first.version}`)
if (typeof first.content !== 'string' || first.content.trim().length < 20) fail('first release content is too short')
console.log(`[validate-release-notes-feed] ok: ${expectedVersion} (${expectedChannel})`)
