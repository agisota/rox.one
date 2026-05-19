# T536 — Автообновления ROX.ONE: stable/beta, живой release-feed, кнопка обновления

Status: IN_PROGRESS

## Цель

Довести контур обновлений ROX.ONE до рабочего состояния: приложение должно проверять выбранный канал обновлений, автоматически скачивать обновление по умолчанию, показывать ненавязчивую кнопку установки, поддерживать ручную проверку/загрузку, beta-канал, удалённые заметки «Что нового», а публичный `app.rox.one` должен отдавать корректные файлы `latest*.yml` и `beta*.yml` рядом со сборками.

## Обязательные изменения

- Electron: настройки `autoDownloadUpdates` и `updateChannel`, IPC для загрузки и настроек, feed URL для stable/beta, ручной download, ручной fallback URL.
- UI: кнопка обновления в `TopBar`, настройки автозагрузки и beta-канала, локализация.
- «Что нового»: удалённая `release-notes.json` с fallback на встроенные заметки.
- Cloudflare Worker: `/electron/latest` как stable alias, `/electron/stable`, `/electron/beta`, `/electron/{version}`, `release-notes.json`, install scripts.
- GitHub Actions: beta tags, проверка обязательных YAML/assets, публикация `release-notes.json`.
- `rox.one`: настоящая production-страница загрузки должна читать manifest/release-notes, а не хранить захардкоженные версии.

## Проверки

- Targeted unit tests for Worker, IPC, auto-update behavior/settings, release-feed metadata validation.
- `bun run lint:i18n:parity`
- `bun run lint:i18n:sorted`
- `bun run typecheck:electron`
- `bun run typecheck:all` when feasible.
- Live checks after release/deploy: `app.rox.one` stable/beta/latest URLs and install scripts.

## Риски

- Без Apple Developer ID macOS может требовать ручного подтверждения запуска/обновления.
- Полная живая проверка старой установленной версии зависит от наличия опубликованного нового выпуска и поведения macOS Gatekeeper.
