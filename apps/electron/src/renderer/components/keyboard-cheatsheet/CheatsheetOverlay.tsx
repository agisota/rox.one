/**
 * CheatsheetOverlay.tsx (M.10 T240-cheatsheet)
 *
 * Modal overlay accessible via the global `Cmd+/` listener that ships in
 * the renderer entry point. Reads `SHORTCUT_REGISTRY` and renders one
 * section per `ShortcutSectionId`. Existing UI primitives are re-used:
 *  - `@/components/ui/dialog` (Radix Dialog wrapper) for the modal.
 *  - Local `<kbd>` styling lifted from `KeyboardShortcutsDialog` so the
 *    cheatsheet looks like a sibling, not a fork.
 *
 * The overlay deliberately does **not** depend on the legacy
 * `KeyboardShortcutsDialog` route at `settings/shortcuts` — that view is
 * still reachable via menu, and we leave it untouched. The cheatsheet is
 * a complementary, quicker surface.
 */

import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useRegisterModal } from '@/context/ModalContext'
import { isMac } from '@/lib/platform'
import {
  SHORTCUT_SECTIONS,
  groupShortcuts,
  type ShortcutEntry,
  type ShortcutSectionId,
} from './shortcut-registry'

export interface CheatsheetOverlayProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Replace platform-neutral `Cmd` tokens with `⌘` on macOS so the painted
 * keys match what users expect (and the legacy dialog already does this).
 * On non-Mac we keep `Cmd` so users see a literal modifier label; Electron
 * intercepts Cmd → Ctrl at the menu accelerator layer so the binding still
 * resolves.
 */
function renderKeys(display: string): string[] {
  const normalised = isMac
    ? display.replaceAll('Cmd', '⌘').replaceAll('Shift', '⇧').replaceAll('Alt', '⌥')
    : display
  // Split on `+` or ` / ` so chord groups paint as separate chips, mirroring
  // KeyboardShortcutsDialog's display contract.
  return normalised.split(/\s*\+\s*| \/ /).filter(Boolean)
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[11px] font-medium font-sans bg-muted border border-border rounded shadow-xs">
      {children}
    </kbd>
  )
}

function ShortcutRow({ entry }: { entry: ShortcutEntry }) {
  const { t } = useTranslation()
  const keys = renderKeys(entry.display)
  return (
    <div
      className="flex items-center justify-between py-1"
      data-testid="cheatsheet-row"
    >
      <span className="text-sm">{t(entry.descriptionKey)}</span>
      <div className="flex items-center gap-1">
        {keys.map((key, i) => (
          <Kbd key={i}>{key}</Kbd>
        ))}
      </div>
    </div>
  )
}

function Section({
  id,
  entries,
}: {
  id: ShortcutSectionId
  entries: readonly ShortcutEntry[]
}) {
  const { t } = useTranslation()
  if (entries.length === 0) return null
  return (
    <section data-testid={`cheatsheet-section-${id}`}>
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
        {t(`cheatsheet.section.${id}`)}
      </h3>
      <div className="space-y-1.5">
        {entries.map((entry, i) => (
          <ShortcutRow key={`${entry.descriptionKey}-${i}`} entry={entry} />
        ))}
      </div>
    </section>
  )
}

/**
 * Cheatsheet overlay. Renders a Dialog at top-level z-order, lists every
 * registered shortcut grouped by section, and registers with the modal
 * context so the global Esc / X-button stack closes it first.
 */
export function CheatsheetOverlay({ open, onOpenChange }: CheatsheetOverlayProps) {
  const { t } = useTranslation()
  const groups = groupShortcuts()

  useRegisterModal(open, () => onOpenChange(false))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[520px] max-h-[80vh] overflow-y-auto"
        data-testid="cheatsheet-overlay"
      >
        <DialogHeader>
          <DialogTitle>{t('cheatsheet.title')}</DialogTitle>
          <DialogDescription className="sr-only">
            {t('cheatsheet.title')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-2">
          {SHORTCUT_SECTIONS.map((id) => (
            <Section key={id} id={id} entries={groups.get(id) ?? []} />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
