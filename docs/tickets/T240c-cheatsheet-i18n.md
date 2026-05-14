# T240c — Cheatsheet i18n (3 keys × 8 locales)
Status: DONE
Phase: M.10

## Context

Predecessor T240-cheatsheet-keyboard-overlay shipped the `CheatsheetOverlay` component
with inline English labels. The ticket explicitly deferred i18n to T240c (this ticket).
The overlay already calls `t('cheatsheet.title')` and `t('cheatsheet.section.${id}')` —
keys are wired; only the locale dictionaries were missing.

The shortcut registry defines three sections: `composer`, `navigation`, `settings`.
All three section keys plus `cheatsheet.title` are added in this ticket.

## Changes

### Locale files (`packages/shared/src/i18n/locales/`)
Added 4 keys to all 8 supported locale files (alphabetically between `chat.*` and `chatInput.*`):

| Key | Description |
|-----|-------------|
| `cheatsheet.title` | Overlay dialog title |
| `cheatsheet.section.composer` | Composer shortcuts section heading |
| `cheatsheet.section.navigation` | Navigation shortcuts section heading |
| `cheatsheet.section.settings` | Settings shortcuts section heading |

### Translations

| Locale | cheatsheet.title | cheatsheet.section.composer | cheatsheet.section.navigation | cheatsheet.section.settings |
|--------|-----------------|------------------------------|-------------------------------|------------------------------|
| en | Cheatsheet | Composer | Navigation | Settings |
| de | Spickzettel | Komponist | Navigation | Einstellungen |
| es | Chuleta | Compositor | Navegación | Ajustes |
| hu | Puska | Kompozitor | Navigáció | Beállítások |
| ja | チートシート | コンポーザー | ナビゲーション | 設定 |
| pl | Ściąga | Kompozytor | Nawigacja | Ustawienia |
| ru | Шпаргалка | Композитор | Навигация | Настройки |
| zh-Hans | 速查表 | 编辑器 | 导航 | 设置 |

### Parity test (`packages/shared/src/i18n/__tests__/cheatsheet-i18n-parity.test.ts`)
Added focused test asserting all 4 cheatsheet keys exist and are non-empty in all 8
locale files. Prevents future locale drift for this surface.

## Component wiring

No component changes required — `CheatsheetOverlay.tsx` already calls:
- `t('cheatsheet.title')` (DialogTitle + DialogDescription sr-only)
- `t('cheatsheet.section.${id}')` (section headings, resolved at render time)

## Validation

- `lint:i18n:sorted` — keys inserted in alphabetical position
- `lint:i18n:parity` — all 8 locales have all keys
- `lint:i18n:coverage` — `t('cheatsheet.title')` and `t('cheatsheet.section.${id}')` covered by en.json

## Predecessor chain
- T240-cheatsheet (provider orchestration backbone, M.7)
- T240-cheatsheet-keyboard-overlay (component + shortcut registry, M.10)
- T240c-cheatsheet-i18n (this ticket — i18n, M.10)
