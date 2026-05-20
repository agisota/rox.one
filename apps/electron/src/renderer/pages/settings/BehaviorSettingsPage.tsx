/**
 * BehaviorSettingsPage
 *
 * Settings → Behavior — contains the Auto-launch Rox Design 3-radio toggle.
 *
 * Phase D / T537 PR #4
 */

import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { PanelHeader } from '@/components/app-shell/PanelHeader'
import { ScrollArea } from '@/components/ui/scroll-area'
import { HeaderMenu } from '@/components/ui/HeaderMenu'
import { routes } from '@/lib/navigate'
import {
  SettingsSection,
  SettingsCard,
  SettingsRadioGroup,
  SettingsRadioCard,
} from '@/components/settings'
import type { DetailsPageMeta } from '@/lib/navigation-registry'
import type { AutoLaunchDesignChoice } from '@/hooks/useAutoLaunchDecision'

export const meta: DetailsPageMeta = {
  navigator: 'settings',
  slug: 'behavior',
}

export default function BehaviorSettingsPage() {
  const { t } = useTranslation()

  const [autoLaunchChoice, setAutoLaunchChoice] = useState<AutoLaunchDesignChoice>('ask')

  // Load preference from main process on mount
  useEffect(() => {
    window.electronAPI?.getAutoLaunchDesign?.().then((choice) => {
      if (choice) setAutoLaunchChoice(choice)
    })
  }, [])

  const handleAutoLaunchChange = useCallback(async (value: string) => {
    const choice = value as AutoLaunchDesignChoice
    setAutoLaunchChoice(choice)
    await window.electronAPI?.setAutoLaunchDesign?.(choice)
  }, [])

  return (
    <div className="h-full flex flex-col">
      <PanelHeader
        title={t('settings.behavior.title')}
        actions={<HeaderMenu route={routes.view.settings('behavior')} />}
      />
      <div className="flex-1 min-h-0 mask-fade-y">
        <ScrollArea className="h-full">
          <div className="px-5 py-7 max-w-3xl mx-auto space-y-8">

            {/* Auto-launch Rox Design */}
            <SettingsSection
              title={t('settings.behavior.autoLaunchDesign')}
              description={t('settings.behavior.autoLaunchDesignDesc')}
            >
              <SettingsRadioGroup
                value={autoLaunchChoice}
                onValueChange={handleAutoLaunchChange}
              >
                <SettingsRadioCard
                  value="always"
                  label={t('settings.behavior.autoLaunchAlways')}
                  description={t('settings.behavior.autoLaunchAlwaysDesc')}
                />
                <SettingsRadioCard
                  value="ask"
                  label={t('settings.behavior.autoLaunchAsk')}
                  description={t('settings.behavior.autoLaunchAskDesc')}
                />
                <SettingsRadioCard
                  value="never"
                  label={t('settings.behavior.autoLaunchNever')}
                  description={t('settings.behavior.autoLaunchNeverDesc')}
                />
              </SettingsRadioGroup>
            </SettingsSection>

          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
