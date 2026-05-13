import { describe, expect, test } from 'bun:test'
import { SETTINGS_ICONS } from '../../../components/icons/SettingsIcons'
import { SETTINGS_ITEMS } from '../../../../shared/menu-schema'
import { parseCompoundRoute } from '../../../../shared/route-parser'
import { routes } from '../../../../shared/routes'
import { SETTINGS_PAGES, isValidSettingsSubpage } from '../../../../shared/settings-registry'

describe('Team permissions settings page registration', () => {
  test('registers the RBAC admin page across settings surfaces', () => {
    const definition = SETTINGS_PAGES.find((page) => page.id === 'team-permissions')

    expect(definition).toEqual({
      id: 'team-permissions',
      labelKey: 'settings.teamPermissions.title',
      descriptionKey: 'settings.teamPermissions.description',
    })
    expect(isValidSettingsSubpage('team-permissions')).toBe(true)
    expect(SETTINGS_ITEMS.find((item) => item.id === 'team-permissions')).toMatchObject({
      id: 'team-permissions',
      labelKey: 'settings.teamPermissions.title',
      descriptionKey: 'settings.teamPermissions.description',
      icon: 'ShieldCheck',
    })
    expect(SETTINGS_ICONS['team-permissions']).toBe(SETTINGS_ICONS.permissions)
    expect(routes.view.settings('team-permissions')).toBe('settings/team-permissions')
    expect(parseCompoundRoute('settings/team-permissions')).toEqual({
      navigator: 'settings',
      details: { type: 'team-permissions', id: 'team-permissions' },
    })
  })
})
