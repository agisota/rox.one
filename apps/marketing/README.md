# `apps/marketing` — internal preview stub. NOT the production site.

> **STOP.** Do NOT `wrangler pages deploy` this to the `rox-one` Cloudflare
> Pages project. The production website at https://rox.one is built and
> deployed from a SEPARATE repository (an Astro project with the wordmark
> shader, particle canvas, command palette, etc.). Deploying this Vite
> stub overwrites the real site.
>
> If you see commit subjects in the rox-one Cloudflare Pages deployment
> history mentioning `Splash.astro`, `JSON-LD`, `platform-buttons`,
> `Lighthouse`, or `WebGL shader` — that's the real site. This Vite app
> has none of those.

## What this is

A minimal Vite + React preview of the ROX.ONE Terminal download flow used
during development of the release-feed worker and the manifest schema.

- `src/App.tsx` renders one Russian-language download card per platform,
  fetched from `https://app.rox.one/electron/latest/manifest.json`.
- Useful as a local sanity check that the worker + manifest pipeline is
  serving valid data.

## What this is NOT

- It is **NOT** what `https://rox.one` serves.
- It is **NOT** deployed to any Cloudflare Pages project. It has no
  production user-facing surface.
- It is **NOT** in scope for marketing copy, SEO, branding, or design
  decisions. Those all live in the upstream Astro site repo.

## Running locally

```bash
bun run --cwd apps/marketing dev      # Vite dev server on localhost:5176
bun run --cwd apps/marketing build    # produces dist/ — DO NOT DEPLOY
```

## How a previous session broke this

A previous session ran `wrangler pages deploy apps/marketing/dist
--project-name=rox-one` and overwrote the real Astro site twice
(deployments `44dbafca` and `fdbfae8b` on 2026-05-17). It was rolled back
to the prior deployment `a6ec5979` via the Cloudflare Pages rollback API.

The lesson: this directory's name (`marketing`) makes it look load-bearing.
It isn't. Keep it as an internal preview. Source of truth for the
production site lives outside this monorepo.
