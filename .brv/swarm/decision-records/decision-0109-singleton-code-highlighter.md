# Decision 0109: Singleton Code Highlighter

- Status: accepted
- Date: 2026-05-14

## Canonical
```text
all renderer code-highlighting call sites use:
  getSingletonHighlighter() from @rox-one/shared/highlight
  resolveLanguage(lang) ?? 'text' for language resolution

not:
  direct codeToHtml from shiki
  per-component createHighlighter calls
  local LANGUAGE_ALIASES tables

TiptapCodeBlockView is deferred (T174b):
  tiptap-extension-code-block-shiki constructs its own highlighter
  exposes no injection API
  migration requires forking or replacing the extension

shiki peerDependency in packages/ui remains until T174b:
  removing it now would break TiptapCodeBlockView language picker
  and extension-internal highlighter construction

unknown languages resolve to 'text':
  not to an error
  not to an empty render
```

## Why
- A shared singleton avoids repeated grammar and theme loading across components, reducing memory pressure and startup latency for the renderer.
- The `resolveLanguage` adapter normalises aliases (e.g., `objc` → `objective-c`) centrally; local alias tables in individual components diverge over time and miss new entries.
- The `'text'` fallback for unknown languages matches the pre-migration `isValidLanguage` else-branch behaviour, so no observable regression occurs at the viewer panel.
- T174b is tracked separately because the upstream `tiptap-extension-code-block-shiki` offers no highlighter-injection API; attempting a partial migration in T174 would silently reduce the authoring language set from ~280 to ~21.
