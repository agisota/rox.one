#!/usr/bin/env bun
/**
 * win-codesign.ts — Windows Authenticode certificate setup for electron-builder.
 *
 * Behaviour:
 *   1. If WIN_CSC_LINK + WIN_CSC_KEY_PASSWORD are set → decode the base64 PFX
 *      and re-export CSC_LINK / CSC_KEY_PASSWORD for electron-builder.
 *   2. If those env vars are ABSENT and we are NOT on main/master (i.e. a PR /
 *      smoke branch) → generate a self-signed test certificate via PowerShell's
 *      New-SelfSignedCertificate cmdlet, export it as a PFX, and wire it up.
 *      The resulting installer is intentionally TEST-SIGNED only.
 *   3. If env vars are absent and we ARE on main/master → exit 0 (unsigned,
 *      let CI handle it gracefully).
 *
 * This script NEVER commits cert files. All temp files live in $RUNNER_TEMP or
 * os.tmpdir() and are cleaned up after the electron-builder invocation.
 *
 * Usage: bun run scripts/win-codesign.ts
 *        (called as a step before electron-builder in win-sign-smoke.yml)
 */

import { execSync, spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync, existsSync, appendFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

function log(msg: string): void {
  process.stdout.write(`[win-codesign] ${msg}\n`)
}

function warn(msg: string): void {
  process.stderr.write(`[win-codesign] WARNING: ${msg}\n`)
}

function appendGithubEnv(key: string, value: string): void {
  const envFile = process.env['GITHUB_ENV']
  if (envFile) {
    appendFileSync(envFile, `${key}=${value}\n`, 'utf8')
  }
  // Also set in current process so child steps inherit it in the same shell
  process.env[key] = value
}

function isMainBranch(): boolean {
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim()
    return branch === 'main' || branch === 'master'
  } catch {
    return false
  }
}

function ensureTempDir(): string {
  const base = process.env['RUNNER_TEMP'] ?? tmpdir()
  const dir = join(base, 'rox-win-codesign')
  mkdirSync(dir, { recursive: true })
  return dir
}

function setupFromBase64Pfx(base64Pfx: string, password: string): void {
  log('WIN_CSC_LINK detected — decoding PFX from base64.')
  const tempDir = ensureTempDir()
  const pfxPath = join(tempDir, 'signing.pfx')
  const pfxBuffer = Buffer.from(base64Pfx, 'base64')
  writeFileSync(pfxPath, pfxBuffer)
  log(`PFX written to temp: ${pfxPath} (${pfxBuffer.length} bytes)`)
  appendGithubEnv('CSC_LINK', pfxPath)
  appendGithubEnv('CSC_KEY_PASSWORD', password)
  log('CSC_LINK and CSC_KEY_PASSWORD exported for electron-builder.')
}

function generateSelfSignedCert(): void {
  if (process.platform !== 'win32') {
    warn('Self-signed cert generation requires PowerShell (Windows only). Skipping.')
    return
  }
  log('##[warning] WIN_CSC_LINK not set on non-main branch.')
  log('##[warning] Generating a SELF-SIGNED TEST certificate for smoke verification.')
  log('##[warning] This installer is NOT trusted by Windows SmartScreen — for CI smoke only.')

  const tempDir = ensureTempDir()
  const pfxPath = join(tempDir, 'test-signing.pfx')
  const certPassword = 'rox-test-smoke-only'

  // PowerShell script: create cert in CurrentUser\My, export to PFX.
  // All values are hardcoded (no external input interpolation).
  const psArgs = [
    '-NonInteractive',
    '-Command',
    [
      `$ErrorActionPreference = 'Stop'`,
      `$cert = New-SelfSignedCertificate -Subject 'CN=ROX.ONE TEST SIGNING - NOT TRUSTED' -Type CodeSigning -CertStoreLocation Cert:\\CurrentUser\\My -HashAlgorithm SHA256 -NotAfter (Get-Date).AddDays(1)`,
      `$pwd = ConvertTo-SecureString -String '${certPassword}' -Force -AsPlainText`,
      `Export-PfxCertificate -Cert $cert -FilePath '${pfxPath.replace(/\\/g, '\\\\')}' -Password $pwd | Out-Null`,
      `Write-Host "Test cert exported: $($cert.Thumbprint)"`,
    ].join('; '),
  ]

  // spawnSync with array args — no shell injection risk
  const result = spawnSync('powershell.exe', psArgs, {
    encoding: 'utf8',
    stdio: 'pipe',
  })

  if (result.status !== 0) {
    warn(`PowerShell cert generation failed (exit ${result.status}):`)
    warn(result.stderr || '(no stderr)')
    warn('Proceeding unsigned — smoke will report NotSigned status.')
    return
  }

  log(result.stdout.trim())

  if (!existsSync(pfxPath)) {
    warn('PFX file not found after cert generation. Proceeding unsigned.')
    return
  }

  log(`TEST PFX written: ${pfxPath}`)
  appendGithubEnv('CSC_LINK', pfxPath)
  appendGithubEnv('CSC_KEY_PASSWORD', certPassword)
  log('TEST CSC_LINK and CSC_KEY_PASSWORD exported for electron-builder.')
}

// ── Main ──────────────────────────────────────────────────────────────────────

const winCscLink = process.env['WIN_CSC_LINK'] ?? ''
const winCscKeyPassword = process.env['WIN_CSC_KEY_PASSWORD'] ?? ''

if (winCscLink && winCscKeyPassword) {
  setupFromBase64Pfx(winCscLink, winCscKeyPassword)
} else if (winCscLink && !winCscKeyPassword) {
  warn('WIN_CSC_LINK is set but WIN_CSC_KEY_PASSWORD is missing. Proceeding unsigned.')
} else if (isMainBranch()) {
  log('No WIN_CSC_LINK on main branch — proceeding unsigned (expected for release-all-platforms).')
} else {
  generateSelfSignedCert()
}
