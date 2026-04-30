# Baseline Validation Commands

Discovered from root `package.json` during T000.

## Fast contract/docs gate

```sh
bun run validate:agent-contract
```

## Existing test and typecheck surfaces

```sh
bun test
bun run test
bun run typecheck
bun run typecheck:electron
bun run typecheck:all
bun run lint
bun run validate:dev
bun run validate:ci
```

## Build surfaces

```sh
bun run electron:build
bun run electron:dist:dev:mac
bun run webui:build
bun run marketing:build
bun run build
```

## Release notes

- Full `bun run validate:ci` is heavier and includes typecheck, shared tests, document tool smoke tests, and i18n parity.
- Desktop release checks should add `bun run electron:dist:dev:mac` and installed-app smoke verification.
- Local dev URLs in this workspace should use portless `.t` routes, not raw localhost URLs.
