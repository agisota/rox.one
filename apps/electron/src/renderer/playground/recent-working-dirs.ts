export type RecentDirScenario = 'none' | 'few' | 'many'

const RECENT_DIR_SCENARIO_DATA: Record<RecentDirScenario, string[]> = {
  none: [],
  few: [
    '/Users/demo/projects/rox-agent',
    '/Users/demo/projects/rox-agent/apps/electron',
    '/Users/demo/projects/rox-agent/packages/shared',
  ],
  many: [
    '/Users/demo/projects/rox-agent',
    '/Users/demo/projects/rox-agent/apps/electron',
    '/Users/demo/projects/rox-agent/apps/viewer',
    '/Users/demo/projects/rox-agent/apps/cli',
    '/Users/demo/projects/rox-agent/packages/shared',
    '/Users/demo/projects/rox-agent/packages/server-core',
    '/Users/demo/projects/rox-agent/packages/pi-agent-server',
    '/Users/demo/projects/rox-agent/packages/ui',
    '/Users/demo/projects/rox-agent/scripts',
  ],
}

/** Return a copy of the fixture list for the selected scenario. */
export function getRecentDirsForScenario(scenario: RecentDirScenario): string[] {
  return [...RECENT_DIR_SCENARIO_DATA[scenario]]
}
