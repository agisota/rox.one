import { defineConfig, devices } from '@playwright/test'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  testDir: __dirname,
  testMatch: '**/*.spec.ts',
  outputDir: join(__dirname, '../test-results/visual-output'),
  snapshotDir: join(__dirname, '../test-results/visual-baseline'),
  snapshotPathTemplate: '{snapshotDir}/{arg}/{projectName}{ext}',
  use: {
    headless: true,
    viewport: { width: 1280, height: 800 },
    // Disable animations for deterministic screenshots
    launchOptions: {
      args: ['--force-prefers-reduced-motion'],
    },
  },
  projects: [
    {
      name: 'light',
      use: {
        ...devices['Desktop Chrome'],
        colorScheme: 'light',
      },
    },
    {
      name: 'dark',
      use: {
        ...devices['Desktop Chrome'],
        colorScheme: 'dark',
      },
    },
  ],
})
