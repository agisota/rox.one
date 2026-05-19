// win-smoke-launch.cjs — Playwright-Electron smoke for Windows CI
// Usage: node scripts/win-smoke-launch.cjs <exePath> <screenshotPath>
// Exits 0 on success, 1 on failure.
'use strict'

const { _electron: electron } = require('playwright')
const path = require('path')

const exePath = process.argv[2]
const screenshotPath = process.argv[3]

if (!exePath || !screenshotPath) {
  console.error('Usage: node win-smoke-launch.cjs <exePath> <screenshotPath>')
  process.exit(1)
}

;(async () => {
  const app = await electron.launch({
    executablePath: exePath,
    args: ['--no-sandbox', '--headless=new'],
  })
  const win = await app.firstWindow()
  await win.waitForLoadState('domcontentloaded')
  const title = await win.title()
  console.log('window-title:' + title)
  await win.screenshot({ path: screenshotPath })
  await app.close()
  if (!title.toLowerCase().includes('rox')) {
    console.error('Title does not contain "rox": ' + title)
    process.exit(1)
  }
  console.log('smoke ok')
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
