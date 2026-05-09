import { atom } from 'jotai'

import type { WorkbenchScreen } from '../../../shared/types'
import type { DemoExperienceAction } from './demo-experience-sessions'

export type DemoSessionRuntime = {
  actionResult: string
  eventCount: number
  lastActionId?: DemoExperienceAction['id']
  lastMessageAt: string
  revision: number
}

export const experienceDemoSelectedSessionByScreenAtom = atom<Partial<Record<WorkbenchScreen, string>>>({})

export const experienceDemoRuntimeBySessionIdAtom = atom<Record<string, DemoSessionRuntime>>({})

