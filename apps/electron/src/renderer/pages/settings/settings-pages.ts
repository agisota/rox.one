/**
 * Settings Page Components Registry
 *
 * Maps settings subpage IDs to their React components.
 * TypeScript enforces that all pages defined in settings-registry have a component here.
 *
 * All settings pages are lazy-loaded (T132) — they are never rendered on cold start.
 * The call site in MainContentPanel wraps them in a <React.Suspense> boundary.
 *
 * To add a new settings page:
 * 1. Add to SETTINGS_PAGES in shared/settings-registry.ts
 * 2. Create the page component (e.g., NewSettingsPage.tsx)
 * 3. Add to SETTINGS_PAGE_COMPONENTS below
 * 4. Add icon to SETTINGS_ICONS in components/icons/SettingsIcons.tsx
 */

import { lazy, type LazyExoticComponent } from 'react'
import type { SettingsSubpage } from '../../../shared/settings-registry'

// T132: all settings pages are lazy-loaded — navigating to Settings is always user-initiated
const AppSettingsPage = lazy(() => import('./AppSettingsPage'))
const AiSettingsPage = lazy(() => import('./AiSettingsPage'))
const AppearanceSettingsPage = lazy(() => import('./AppearanceSettingsPage'))
const InputSettingsPage = lazy(() => import('./InputSettingsPage'))
const WorkspaceSettingsPage = lazy(() => import('./WorkspaceSettingsPage'))
const PermissionsSettingsPage = lazy(() => import('./PermissionsSettingsPage'))
const TeamManagementSettingsPage = lazy(() => import('./TeamManagementSettingsPage'))
const TeamPermissionsSettingsPage = lazy(() => import('./TeamPermissionsSettingsPage'))
const AuditLogSettingsPage = lazy(() => import('./AuditLogSettingsPage'))
const LabelsSettingsPage = lazy(() => import('./LabelsSettingsPage'))
const MessagingSettingsPage = lazy(() => import('./MessagingSettingsPage'))
const ServerSettingsPage = lazy(() => import('./ServerSettingsPage'))
const ShortcutsPage = lazy(() => import('./ShortcutsPage'))
const PreferencesPage = lazy(() => import('./PreferencesPage'))
const AccountSettingsPage = lazy(() => import('./AccountSettingsPage'))

/**
 * Map of settings subpage IDs to their lazy page components.
 * TypeScript will error if a page from SETTINGS_PAGES is missing here.
 * Caller must wrap in <React.Suspense fallback={...}>.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const SETTINGS_PAGE_COMPONENTS: Record<SettingsSubpage, LazyExoticComponent<any>> = {
  app: AppSettingsPage,
  ai: AiSettingsPage,
  appearance: AppearanceSettingsPage,
  input: InputSettingsPage,
  workspace: WorkspaceSettingsPage,
  permissions: PermissionsSettingsPage,
  'team-management': TeamManagementSettingsPage,
  'team-permissions': TeamPermissionsSettingsPage,
  'audit-log': AuditLogSettingsPage,
  labels: LabelsSettingsPage,
  messaging: MessagingSettingsPage,
  server: ServerSettingsPage,
  shortcuts: ShortcutsPage,
  preferences: PreferencesPage,
  account: AccountSettingsPage,
}

/**
 * Get the lazy component for a settings subpage.
 * Caller must wrap usage in <React.Suspense fallback={...}>.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getSettingsPageComponent(subpage: SettingsSubpage): LazyExoticComponent<any> {
  return SETTINGS_PAGE_COMPONENTS[subpage]
}
