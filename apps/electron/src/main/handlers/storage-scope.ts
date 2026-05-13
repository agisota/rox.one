import { DEFAULT_LOCAL_SCOPE, type BrandedWorkspaceScope } from '@rox-agent/shared/config'

export const ELECTRON_GLOBAL_STORAGE_SCOPE_REASON =
  'Electron main handler storage here is machine-wide local UI/runtime preference state, not tenant or workspace content.'

export const ELECTRON_GLOBAL_STORAGE_SCOPE: BrandedWorkspaceScope = DEFAULT_LOCAL_SCOPE
