# T536 — Автообновления ROX.ONE: stable/beta, живой release-feed, кнопка обновления

Status: IN_PROGRESS — stable live, beta follow-up in progress

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
- Stable `v1.0.0` опубликован и живой; beta feed требует свежий prerelease tag после фикса Worker, потому что старый `v1.0.0-rc.7` не содержит `beta*.yml`.
- Полная живая проверка старой установленной версии зависит от наличия опубликованного нового выпуска и поведения macOS Gatekeeper.
- Follow-up PR #258 также чинит hosted CircleCI `validate`: `transform_data` теперь запускает дочерний процесс через native `Bun.spawn` под Bun, чтобы обходить intermittent `node:child_process.spawn` EBADF на Linux runner.
- Fresh beta tag `v1.0.1-beta.1` exposed a release finalization bug: the aggregate manifest job must publish the existing draft by release id instead of using `softprops/action-gh-release` with `draft:false`, otherwise GitHub can create a duplicate published release and leave the asset-filled draft unpublished.
