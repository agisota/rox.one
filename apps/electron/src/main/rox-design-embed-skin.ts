import type { RoxDesignRectangle } from "./rox-design-view-policy";

const ROX_DESIGN_SMALL_SURFACE_ZOOM = 0.6;
const ROX_DESIGN_MEDIUM_SURFACE_ZOOM = 0.64;
const ROX_DESIGN_WIDE_SURFACE_ZOOM = 0.68;

export function resolveRoxDesignContentZoomFactor(
  bounds: Pick<RoxDesignRectangle, "width">,
): number {
  if (!Number.isFinite(bounds.width) || bounds.width <= 0)
    return ROX_DESIGN_SMALL_SURFACE_ZOOM;
  if (bounds.width < 1500) return ROX_DESIGN_SMALL_SURFACE_ZOOM;
  if (bounds.width < 1900) return ROX_DESIGN_MEDIUM_SURFACE_ZOOM;
  return ROX_DESIGN_WIDE_SURFACE_ZOOM;
}

export const ROX_DESIGN_EMBED_CSS = `
:root,
html,
html[data-theme='dark'] {
  color-scheme: dark !important;
  --bg: #05070d !important;
  --bg-app: #05070d !important;
  --bg-panel: #090d15 !important;
  --bg-subtle: #0f1622 !important;
  --bg-muted: #151e2b !important;
  --bg-elevated: #0d131d !important;
  --border: rgba(148, 163, 184, 0.14) !important;
  --border-strong: rgba(148, 163, 184, 0.26) !important;
  --border-soft: rgba(148, 163, 184, 0.09) !important;
  --text: #d8dee9 !important;
  --text-strong: #f4f7fb !important;
  --text-muted: #8a94a6 !important;
  --text-soft: #657184 !important;
  --text-faint: #465165 !important;
  --accent: #22d3ee !important;
  --accent-strong: #67e8f9 !important;
  --accent-soft: rgba(34, 211, 238, 0.18) !important;
  --accent-tint: rgba(34, 211, 238, 0.09) !important;
  --accent-hover: #2dd4bf !important;
  --green: #34d399 !important;
  --green-bg: rgba(52, 211, 153, 0.11) !important;
  --green-border: rgba(52, 211, 153, 0.23) !important;
  --blue: #60a5fa !important;
  --blue-bg: rgba(96, 165, 250, 0.12) !important;
  --blue-border: rgba(96, 165, 250, 0.24) !important;
  --purple: #a78bfa !important;
  --purple-bg: rgba(167, 139, 250, 0.12) !important;
  --purple-border: rgba(167, 139, 250, 0.24) !important;
  --red: #fb7185 !important;
  --red-bg: rgba(251, 113, 133, 0.12) !important;
  --red-border: rgba(251, 113, 133, 0.24) !important;
  --amber: #f59e0b !important;
  --amber-bg: rgba(245, 158, 11, 0.12) !important;
  --selected: #22d3ee !important;
  --selected-soft: rgba(34, 211, 238, 0.24) !important;
  --radius-sm: 10px !important;
  --radius: 14px !important;
  --radius-lg: 18px !important;
  --radius-pill: 999px !important;
  --shadow-xs: 0 1px 0 rgba(255, 255, 255, 0.035) inset !important;
  --shadow-sm: 0 1px 0 rgba(255, 255, 255, 0.04) inset, 0 14px 32px rgba(0, 0, 0, 0.22) !important;
  --shadow-md: 0 1px 0 rgba(255, 255, 255, 0.04) inset, 0 20px 48px rgba(0, 0, 0, 0.32) !important;
  --shadow-lg: 0 1px 0 rgba(255, 255, 255, 0.05) inset, 0 28px 70px rgba(0, 0, 0, 0.44) !important;
  --sans: -apple-system, BlinkMacSystemFont, "Inter", "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
  --mono: ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace !important;
}

html[data-rox-embedded='true'],
html[data-rox-embedded='true'] body {
  min-width: 0 !important;
  background:
    radial-gradient(circle at 12% -12%, rgba(34, 211, 238, 0.13), transparent 28rem),
    radial-gradient(circle at 100% 0%, rgba(99, 102, 241, 0.11), transparent 26rem),
    linear-gradient(180deg, #060912 0%, #03050b 100%) !important;
}

html[data-rox-embedded='true'] body {
  color: var(--text) !important;
  font-family: var(--sans) !important;
  font-size: 13px !important;
  line-height: 1.45 !important;
  letter-spacing: -0.006em !important;
  overflow: hidden !important;
}

html[data-rox-embedded='true'] *,
html[data-rox-embedded='true'] *::before,
html[data-rox-embedded='true'] *::after {
  scrollbar-color: rgba(148, 163, 184, 0.35) transparent !important;
}

html[data-rox-embedded='true'] ::selection {
  background: rgba(34, 211, 238, 0.28) !important;
  color: var(--text-strong) !important;
}

html[data-rox-embedded='true'] #root,
html[data-rox-embedded='true'] .app,
html[data-rox-embedded='true'] .entry-shell,
html[data-rox-embedded='true'] .workspace {
  background: transparent !important;
  color: var(--text) !important;
  height: 100vh !important;
  min-width: 0 !important;
  min-height: 0 !important;
}

html[data-rox-embedded='true'] .app {
  grid-template-rows: auto minmax(0, 1fr) !important;
}

html[data-rox-embedded='true'] .app > .split {
  grid-row: 2 !important;
}

html[data-rox-embedded='true'] .app-chrome-header {
  min-height: 38px !important;
  padding: 4px 12px !important;
  gap: 10px !important;
  background: rgba(5, 7, 13, 0.94) !important;
  border-bottom: 1px solid var(--border) !important;
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.035) inset !important;
  backdrop-filter: blur(18px) saturate(130%) !important;
}

html[data-rox-embedded='true'] .app-chrome-brand {
  gap: 8px !important;
}

html[data-rox-embedded='true'] .app-chrome-mark,
html[data-rox-embedded='true'] .topbar .brand-mark {
  width: 24px !important;
  height: 24px !important;
  border: 1px solid rgba(34, 211, 238, 0.45) !important;
  border-radius: 9px !important;
  background: rgba(34, 211, 238, 0.1) !important;
  box-shadow: 0 0 0 3px rgba(34, 211, 238, 0.08) !important;
}

html[data-rox-embedded='true'] .app-chrome-name {
  color: var(--text-strong) !important;
  font-size: 0 !important;
  letter-spacing: -0.018em !important;
}

html[data-rox-embedded='true'] .app-chrome-name::after {
  content: 'Rox Design';
  font-size: 14px !important;
  font-weight: 650 !important;
}

html[data-rox-embedded='true'] .chrome-action,
html[data-rox-embedded='true'] .settings-icon-btn,
html[data-rox-embedded='true'] .app-chrome-back {
  height: 28px !important;
  color: var(--text-muted) !important;
  background: transparent !important;
  border-color: transparent !important;
  border-radius: 9px !important;
}

html[data-rox-embedded='true'] .chrome-action:hover,
html[data-rox-embedded='true'] .settings-icon-btn:hover,
html[data-rox-embedded='true'] .app-chrome-back:hover {
  color: var(--text) !important;
  background: rgba(15, 23, 42, 0.84) !important;
  border-color: var(--border) !important;
}

html[data-rox-embedded='true'] .entry-shell {
  grid-template-rows: minmax(0, 1fr) !important;
}

html[data-rox-embedded='true'] .entry {
  grid-template-columns: minmax(300px, 340px) minmax(0, 1fr) !important;
  background: transparent !important;
  height: 100% !important;
  min-width: 0 !important;
}

html[data-rox-embedded='true'] .entry-side {
  background: rgba(5, 9, 16, 0.72) !important;
  border-right: 1px solid var(--border) !important;
  box-shadow: 1px 0 0 rgba(255, 255, 255, 0.025) inset !important;
}

html[data-rox-embedded='true'] .entry-side-resizer {
  background: transparent !important;
}

html[data-rox-embedded='true'] .newproj {
  padding-top: 14px !important;
  overflow: auto !important;
}

html[data-rox-embedded='true'] .newproj-tabs-shell,
html[data-rox-embedded='true'] .entry-header-tabs-row {
  padding: 0 14px !important;
  margin-bottom: 0 !important;
}

html[data-rox-embedded='true'] .newproj-tabs,
html[data-rox-embedded='true'] .entry-tabs,
html[data-rox-embedded='true'] .ws-tabs-bar {
  gap: 4px !important;
}

html[data-rox-embedded='true'] .newproj-tab,
html[data-rox-embedded='true'] .entry-tab,
html[data-rox-embedded='true'] .ws-tab {
  border-radius: 10px !important;
  padding: 6px 11px !important;
  color: var(--text-muted) !important;
  background: transparent !important;
  border: 1px solid transparent !important;
  font-weight: 550 !important;
}

html[data-rox-embedded='true'] .newproj-tab.active,
html[data-rox-embedded='true'] .entry-tab.active,
html[data-rox-embedded='true'] .ws-tab.active,
html[data-rox-embedded='true'] .newproj-media-surface.active,
html[data-rox-embedded='true'] .ds-picker-mode-btn.active {
  color: var(--text-strong) !important;
  background: rgba(34, 211, 238, 0.12) !important;
  border-color: rgba(34, 211, 238, 0.34) !important;
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.045) inset !important;
}

html[data-rox-embedded='true'] .newproj-tab:hover:not(:disabled),
html[data-rox-embedded='true'] .entry-tab:hover:not(:disabled),
html[data-rox-embedded='true'] .ws-tab:hover,
html[data-rox-embedded='true'] .newproj-media-surface:hover:not(.active),
html[data-rox-embedded='true'] .ds-picker-mode-btn:hover:not(.active) {
  color: var(--text) !important;
  background: rgba(15, 23, 42, 0.78) !important;
  border-color: var(--border) !important;
}

html[data-rox-embedded='true'] .newproj-body,
html[data-rox-embedded='true'] .entry-main,
html[data-rox-embedded='true'] .workspace,
html[data-rox-embedded='true'] .pane,
html[data-rox-embedded='true'] .settings-content {
  background: transparent !important;
}

html[data-rox-embedded='true'] .newproj-card,
html[data-rox-embedded='true'] .newproj-option-card,
html[data-rox-embedded='true'] .newproj-model-card,
html[data-rox-embedded='true'] .example-card,
html[data-rox-embedded='true'] .library-card,
html[data-rox-embedded='true'] .library-ds-card,
html[data-rox-embedded='true'] .template-option,
html[data-rox-embedded='true'] .settings-section,
html[data-rox-embedded='true'] .modal,
html[data-rox-embedded='true'] .modal-settings,
html[data-rox-embedded='true'] .ds-picker-popover,
html[data-rox-embedded='true'] .avatar-popover,
html[data-rox-embedded='true'] .composer-shell,
html[data-rox-embedded='true'] .manual-edit-canvas,
html[data-rox-embedded='true'] .manual-edit-layers,
html[data-rox-embedded='true'] .manual-edit-modal,
html[data-rox-embedded='true'] .manual-edit-changes,
html[data-rox-embedded='true'] .routines-card,
html[data-rox-embedded='true'] .library-import-form,
html[data-rox-embedded='true'] .mcp-row,
html[data-rox-embedded='true'] .mcp-picker,
html[data-rox-embedded='true'] .privacy-consent-banner {
  background: rgba(9, 13, 21, 0.82) !important;
  border-color: var(--border) !important;
  box-shadow: var(--shadow-sm) !important;
  backdrop-filter: blur(18px) saturate(130%) !important;
}

html[data-rox-embedded='true'] .newproj-card:hover,
html[data-rox-embedded='true'] .newproj-option-card:hover,
html[data-rox-embedded='true'] .newproj-model-card:hover,
html[data-rox-embedded='true'] .example-card:hover,
html[data-rox-embedded='true'] .library-card:hover,
html[data-rox-embedded='true'] .library-ds-card:hover,
html[data-rox-embedded='true'] .template-option:hover,
html[data-rox-embedded='true'] .ds-picker-item:hover {
  border-color: rgba(34, 211, 238, 0.28) !important;
  background: rgba(15, 23, 42, 0.9) !important;
}

html[data-rox-embedded='true'] .newproj-card.active,
html[data-rox-embedded='true'] .newproj-option-card.active,
html[data-rox-embedded='true'] .template-option.active,
html[data-rox-embedded='true'] .ds-picker-item.active,
html[data-rox-embedded='true'] .manual-edit-layer-row.selected {
  border-color: rgba(34, 211, 238, 0.62) !important;
  background: rgba(34, 211, 238, 0.12) !important;
  box-shadow: 0 0 0 1px rgba(34, 211, 238, 0.18) inset !important;
}

html[data-rox-embedded='true'] .workspace,
html[data-rox-embedded='true'] .ws-tabs-shell,
html[data-rox-embedded='true'] .topbar,
html[data-rox-embedded='true'] .chat-header,
html[data-rox-embedded='true'] .composer,
html[data-rox-embedded='true'] .project-actions-toolbar,
html[data-rox-embedded='true'] .settings-sidebar,
html[data-rox-embedded='true'] .manual-edit-actions {
  background: rgba(5, 7, 13, 0.78) !important;
  border-color: var(--border) !important;
}

html[data-rox-embedded='true'] .split {
  grid-template-columns: minmax(320px, 420px) 8px minmax(360px, 1fr) !important;
  background: transparent !important;
}

html[data-rox-embedded='true'] .split-resize-handle {
  background: linear-gradient(90deg, transparent 0, transparent 3px, rgba(148, 163, 184, 0.18) 3px, rgba(148, 163, 184, 0.18) 5px, transparent 5px) !important;
}

html[data-rox-embedded='true'] .settings-sidebar {
  border-right: 1px solid var(--border) !important;
}

html[data-rox-embedded='true'] .settings-nav-item.active,
html[data-rox-embedded='true'] .settings-nav-item.active:hover,
html[data-rox-embedded='true'] .qs-row-active {
  background: rgba(34, 211, 238, 0.12) !important;
  border-color: rgba(34, 211, 238, 0.38) !important;
  color: var(--text-strong) !important;
}

html[data-rox-embedded='true'] .seg-control,
html[data-rox-embedded='true'] .newproj-media-segmented,
html[data-rox-embedded='true'] .ds-picker-mode,
html[data-rox-embedded='true'] .privacy-consent-actions {
  background: rgba(15, 23, 42, 0.72) !important;
  border: 1px solid var(--border) !important;
  border-radius: var(--radius) !important;
}

html[data-rox-embedded='true'] .library-search,
html[data-rox-embedded='true'] .examples-search,
html[data-rox-embedded='true'] .ds-picker-search,
html[data-rox-embedded='true'] .qs-shell,
html[data-rox-embedded='true'] input,
html[data-rox-embedded='true'] textarea,
html[data-rox-embedded='true'] select {
  background: rgba(3, 7, 18, 0.72) !important;
  border-color: var(--border) !important;
  color: var(--text) !important;
}

html[data-rox-embedded='true'] input::placeholder,
html[data-rox-embedded='true'] textarea::placeholder,
html[data-rox-embedded='true'] .library-search::placeholder {
  color: var(--text-faint) !important;
}

html[data-rox-embedded='true'] input:focus,
html[data-rox-embedded='true'] textarea:focus,
html[data-rox-embedded='true'] select:focus,
html[data-rox-embedded='true'] .library-search:focus,
html[data-rox-embedded='true'] .ds-picker-search:focus {
  border-color: rgba(34, 211, 238, 0.72) !important;
  box-shadow: 0 0 0 3px rgba(34, 211, 238, 0.16) !important;
}

html[data-rox-embedded='true'] h1,
html[data-rox-embedded='true'] h2,
html[data-rox-embedded='true'] h3,
html[data-rox-embedded='true'] h4,
html[data-rox-embedded='true'] strong,
html[data-rox-embedded='true'] label,
html[data-rox-embedded='true'] .title,
html[data-rox-embedded='true'] .topbar .title,
html[data-rox-embedded='true'] .newproj-name,
html[data-rox-embedded='true'] .library-card-name,
html[data-rox-embedded='true'] .settings-section h3,
html[data-rox-embedded='true'] .ds-picker-title,
html[data-rox-embedded='true'] .project-actions-label {
  color: var(--text-strong) !important;
  letter-spacing: -0.018em !important;
}

html[data-rox-embedded='true'] p,
html[data-rox-embedded='true'] small,
html[data-rox-embedded='true'] span,
html[data-rox-embedded='true'] .meta,
html[data-rox-embedded='true'] .library-card-desc,
html[data-rox-embedded='true'] .newproj-label,
html[data-rox-embedded='true'] .newproj-model-hint,
html[data-rox-embedded='true'] .settings-section p,
html[data-rox-embedded='true'] .ds-picker-sub,
html[data-rox-embedded='true'] .ds-picker-item-sub,
html[data-rox-embedded='true'] .composer-hint {
  border-color: var(--border) !important;
}

html[data-rox-embedded='true'] button,
html[data-rox-embedded='true'] [role='button'],
html[data-rox-embedded='true'] [role='combobox'] {
  background: rgba(9, 13, 21, 0.88) !important;
  border-color: var(--border) !important;
  color: var(--text) !important;
  border-radius: 12px !important;
  box-shadow: var(--shadow-xs) !important;
}

html[data-rox-embedded='true'] button:hover:not(:disabled),
html[data-rox-embedded='true'] [role='button']:hover {
  background: rgba(15, 23, 42, 0.96) !important;
  border-color: var(--border-strong) !important;
}

html[data-rox-embedded='true'] button.primary,
html[data-rox-embedded='true'] button[data-primary='true'],
html[data-rox-embedded='true'] .newproj-create,
html[data-rox-embedded='true'] .composer-send,
html[data-rox-embedded='true'] .project-actions-button-primary,
html[data-rox-embedded='true'] .library-install-submit,
html[data-rox-embedded='true'] .privacy-consent-action.primary,
html[data-rox-embedded='true'] [class*='primary' i] {
  background: linear-gradient(135deg, #22d3ee 0%, #2dd4bf 100%) !important;
  border-color: rgba(103, 232, 249, 0.55) !important;
  color: #031018 !important;
  font-weight: 700 !important;
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.34) inset, 0 14px 34px rgba(34, 211, 238, 0.18) !important;
}

html[data-rox-embedded='true'] .newproj-import,
html[data-rox-embedded='true'] .newproj-open-folder,
html[data-rox-embedded='true'] .project-actions-button,
html[data-rox-embedded='true'] .library-install-btn,
html[data-rox-embedded='true'] .newproj-connectors-empty {
  background: rgba(9, 13, 21, 0.74) !important;
  border-color: var(--border) !important;
  color: var(--text) !important;
}

html[data-rox-embedded='true'] .newproj-import:hover,
html[data-rox-embedded='true'] .newproj-open-folder:hover,
html[data-rox-embedded='true'] .project-actions-button:hover,
html[data-rox-embedded='true'] .library-install-btn:hover,
html[data-rox-embedded='true'] .newproj-connectors-empty:hover {
  background: rgba(15, 23, 42, 0.92) !important;
  border-color: rgba(34, 211, 238, 0.32) !important;
}

html[data-rox-embedded='true'] [aria-selected='true'],
html[data-rox-embedded='true'] [data-state='active'],
html[data-rox-embedded='true'] [class*='selected' i] {
  border-color: rgba(34, 211, 238, 0.52) !important;
  color: var(--text-strong) !important;
}

html[data-rox-embedded='true'] .design-card-tag,
html[data-rox-embedded='true'] .library-card-badge,
html[data-rox-embedded='true'] .newproj-provider-badge,
html[data-rox-embedded='true'] .media-provider-badge,
html[data-rox-embedded='true'] .routines-tag,
html[data-rox-embedded='true'] .project-actions-chip,
html[data-rox-embedded='true'] .newproj-connector-chip,
html[data-rox-embedded='true'] .ds-picker-item-badge {
  background: rgba(34, 211, 238, 0.1) !important;
  color: #67e8f9 !important;
  border-color: rgba(34, 211, 238, 0.24) !important;
}

html[data-rox-embedded='true'] .newproj-footer,
html[data-rox-embedded='true'] .entry-side-foot,
html[data-rox-embedded='true'] .modal-foot,
html[data-rox-embedded='true'] .qs-footer,
html[data-rox-embedded='true'] .library-preview,
html[data-rox-embedded='true'] .manual-edit-panel-head,
html[data-rox-embedded='true'] .manual-edit-modal-head,
html[data-rox-embedded='true'] .routines-form-actions {
  border-color: var(--border) !important;
}

html[data-rox-embedded='true'] .example-preview,
html[data-rox-embedded='true'] .newproj-option-card img,
html[data-rox-embedded='true'] .live-artifact-preview-frame-host,
html[data-rox-embedded='true'] img,
html[data-rox-embedded='true'] video,
html[data-rox-embedded='true'] canvas,
html[data-rox-embedded='true'] iframe {
  border-radius: 12px !important;
}

html[data-rox-embedded='true'] a,
html[data-rox-embedded='true'] .project-actions-link,
html[data-rox-embedded='true'] .md-link {
  color: #67e8f9 !important;
}

html[data-rox-embedded='true'] svg {
  color: currentColor !important;
}

html[data-rox-embedded='true'] .od-loading-shell {
  background: transparent !important;
  color: var(--text-muted) !important;
}

html[data-rox-embedded='true'] .privacy-consent-banner {
  display: none !important;
  pointer-events: none !important;
  visibility: hidden !important;
}



/* ROX native embed mode: Open Design runs inside the ROX shell, so its own
   desktop chrome and non-essential side rails are removed. This keeps the
   managed Electron view feeling like a native ROX panel instead of a nested app. */
html[data-rox-embedded='true'] .app {
  grid-template-rows: minmax(0, 1fr) !important;
  height: 100vh !important;
  max-height: 100vh !important;
  overflow: hidden !important;
}

html[data-rox-embedded='true'] .app > .entry-shell,
html[data-rox-embedded='true'] .app > .split,
html[data-rox-embedded='true'] .app > .settings,
html[data-rox-embedded='true'] .app > main {
  grid-row: 1 !important;
  min-height: 0 !important;
}

html[data-rox-embedded='true'] .app-chrome-header {
  display: none !important;
}

html[data-rox-embedded='true'] .entry-shell,
html[data-rox-embedded='true'] .entry,
html[data-rox-embedded='true'] .split,
html[data-rox-embedded='true'] .settings,
html[data-rox-embedded='true'] .workspace {
  height: 100vh !important;
  max-height: 100vh !important;
  overflow: hidden !important;
}

html[data-rox-embedded='true'] .entry {
  grid-template-columns: minmax(292px, 324px) minmax(0, 1fr) !important;
  border-radius: 0 !important;
}

html[data-rox-embedded='true'] .entry-side {
  background:
    linear-gradient(180deg, rgba(10, 15, 25, 0.92), rgba(5, 9, 16, 0.9)) !important;
}

html[data-rox-embedded='true'] .newproj {
  padding-top: 10px !important;
  gap: 0 !important;
}

html[data-rox-embedded='true'] .newproj-tabs-shell {
  padding: 0 12px !important;
}

html[data-rox-embedded='true'] .newproj-body {
  flex: 1 1 auto !important;
  margin: 0 12px 10px !important;
  padding: 13px !important;
  border-radius: 14px !important;
  gap: 10px !important;
  background: rgba(8, 12, 20, 0.82) !important;
  overflow-y: auto !important;
}

html[data-rox-embedded='true'] .newproj-title {
  font-size: 12.5px !important;
}

html[data-rox-embedded='true'] .newproj-name,
html[data-rox-embedded='true'] .ds-picker-trigger,
html[data-rox-embedded='true'] select {
  min-height: 30px !important;
  background: rgba(3, 7, 18, 0.78) !important;
  border: 1px solid var(--border) !important;
  color: var(--text) !important;
}

html[data-rox-embedded='true'] .ds-picker-trigger {
  align-items: center !important;
  gap: 10px !important;
  width: 100% !important;
  padding: 8px 10px !important;
  border-radius: 12px !important;
}

html[data-rox-embedded='true'] .ds-picker-trigger .ds-picker-title,
html[data-rox-embedded='true'] .ds-picker-trigger .ds-picker-item-title,
html[data-rox-embedded='true'] .ds-picker-trigger strong {
  color: var(--text-strong) !important;
}

html[data-rox-embedded='true'] .newproj-section {
  gap: 5px !important;
}

html[data-rox-embedded='true'] .newproj-model-grid,
html[data-rox-embedded='true'] .newproj-option-grid {
  gap: 7px !important;
}

html[data-rox-embedded='true'] .newproj-model-card {
  min-height: 58px !important;
  padding: 9px !important;
}

html[data-rox-embedded='true'] .newproj-option-card {
  min-height: 52px !important;
  padding: 8px !important;
}

html[data-rox-embedded='true'] .newproj-create,
html[data-rox-embedded='true'] .newproj-import,
html[data-rox-embedded='true'] .newproj-open-folder {
  min-height: 34px !important;
}

html[data-rox-embedded='true'] .newproj-create {
  background: linear-gradient(135deg, #0ea5b7 0%, #14b8a6 100%) !important;
  border-color: rgba(103, 232, 249, 0.42) !important;
  color: #021014 !important;
}

html[data-rox-embedded='true'] .entry-side-foot,
html[data-rox-embedded='true'] .pet-rail,
html[data-rox-embedded='true'] .pet-overlay,
html[data-rox-embedded='true'] .welcome-pet-teaser,
html[data-rox-embedded='true'] .composer-pet-menu,
html[data-rox-embedded='true'] .composer-pet-wrap,
html[data-rox-embedded='true'] .pet-bubble {
  display: none !important;
}

html[data-rox-embedded='true'] .entry-main {
  background:
    radial-gradient(circle at 18% -18%, rgba(34, 211, 238, 0.08), transparent 26rem),
    linear-gradient(180deg, rgba(5, 8, 14, 0.94), rgba(3, 5, 11, 0.98)) !important;
}

html[data-rox-embedded='true'] .entry-header {
  min-height: 42px !important;
  padding: 10px 16px 0 !important;
  gap: 10px !important;
  background: rgba(5, 7, 13, 0.76) !important;
  border-bottom: 1px solid var(--border) !important;
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.035) inset !important;
  backdrop-filter: blur(18px) saturate(130%) !important;
}

html[data-rox-embedded='true'] .entry-header-tabs-row,
html[data-rox-embedded='true'] .entry-tabs {
  gap: 6px !important;
}

html[data-rox-embedded='true'] .entry-tab {
  border: 1px solid transparent !important;
  border-radius: 999px !important;
  padding: 7px 12px !important;
  font-size: 12px !important;
}

html[data-rox-embedded='true'] .entry-tab.active,
html[data-rox-embedded='true'] .entry-tab.active:hover:not(:disabled),
html[data-rox-embedded='true'] .entry-tab.active:focus,
html[data-rox-embedded='true'] .entry-tab.active:focus-visible {
  color: var(--text-strong) !important;
  background: rgba(34, 211, 238, 0.12) !important;
  border-color: rgba(34, 211, 238, 0.34) !important;
  box-shadow: 0 0 0 1px rgba(34, 211, 238, 0.08) inset !important;
}

html[data-rox-embedded='true'] .entry-tab-content {
  padding: 16px !important;
  background: transparent !important;
}

html[data-rox-embedded='true'] .tab-panel,
html[data-rox-embedded='true'] .library-content,
html[data-rox-embedded='true'] .prompt-templates-panel {
  gap: 12px !important;
}

html[data-rox-embedded='true'] .library-toolbar,
html[data-rox-embedded='true'] .tab-panel-toolbar {
  margin-bottom: 8px !important;
  gap: 8px !important;
}

html[data-rox-embedded='true'] .library-empty,
html[data-rox-embedded='true'] .newproj-empty,
html[data-rox-embedded='true'] .prompt-template-empty-hint,
html[data-rox-embedded='true'] .newproj-connectors-empty {
  border: 1px solid var(--border) !important;
  border-radius: 16px !important;
  background: rgba(9, 13, 21, 0.64) !important;
  color: var(--text-muted) !important;
  box-shadow: var(--shadow-xs) !important;
}

html[data-rox-embedded='true'] .library-empty,
html[data-rox-embedded='true'] .newproj-empty,
html[data-rox-embedded='true'] .prompt-template-empty-hint {
  min-height: 180px !important;
  display: grid !important;
  place-items: center !important;
  text-align: center !important;
}

html[data-rox-embedded='true'] .library-card,
html[data-rox-embedded='true'] .library-ds-card,
html[data-rox-embedded='true'] .prompt-template-card,
html[data-rox-embedded='true'] .template-option,
html[data-rox-embedded='true'] .settings-section,
html[data-rox-embedded='true'] .newproj-card,
html[data-rox-embedded='true'] .newproj-option-card,
html[data-rox-embedded='true'] .newproj-model-card {
  border-radius: 14px !important;
  background: rgba(9, 13, 21, 0.72) !important;
  border-color: var(--border) !important;
}

html[data-rox-embedded='true'] .prompt-templates-grid {
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)) !important;
  gap: 12px !important;
}

html[data-rox-embedded='true'] .prompt-template-thumb {
  background: rgba(15, 23, 42, 0.78) !important;
}

html[data-rox-embedded='true'] .settings {
  background: transparent !important;
}

html[data-rox-embedded='true'] .settings-sidebar {
  width: 220px !important;
  background: rgba(5, 9, 16, 0.9) !important;
}

html[data-rox-embedded='true'] .settings-content {
  padding: 18px !important;
}

html[data-rox-embedded='true'] .split {
  grid-template-columns: minmax(300px, 380px) 8px minmax(0, 1fr) !important;
}

html[data-rox-embedded='true'] .topbar,
html[data-rox-embedded='true'] .chat-header,
html[data-rox-embedded='true'] .composer,
html[data-rox-embedded='true'] .project-actions-toolbar {
  background: rgba(5, 7, 13, 0.84) !important;
  backdrop-filter: blur(18px) saturate(130%) !important;
}

html[data-rox-embedded='true'] [data-rox-embed-polished='true'] {
  color: var(--text) !important;
}

@media (max-width: 1180px) {
  html[data-rox-embedded='true'] .entry {
    grid-template-columns: minmax(280px, 320px) minmax(0, 1fr) !important;
  }

  html[data-rox-embedded='true'] .split {
    grid-template-columns: minmax(300px, 380px) 8px minmax(320px, 1fr) !important;
  }
}
`;

export function buildRoxDesignEmbedBootstrapScript(zoomFactor: number): string {
  const safeZoomFactor =
    Number.isFinite(zoomFactor) && zoomFactor > 0
      ? zoomFactor
      : ROX_DESIGN_SMALL_SURFACE_ZOOM;
  return `
(() => {
  const tokenMap = ${JSON.stringify({
    "--accent": "#22d3ee",
    "--accent-hover": "#2dd4bf",
    "--accent-soft": "rgba(34, 211, 238, 0.18)",
    "--accent-strong": "#67e8f9",
    "--accent-tint": "rgba(34, 211, 238, 0.09)",
    "--bg": "#05070d",
    "--bg-app": "#05070d",
    "--bg-elevated": "#0d131d",
    "--bg-muted": "#151e2b",
    "--bg-panel": "#090d15",
    "--bg-subtle": "#0f1622",
    "--border": "rgba(148, 163, 184, 0.14)",
    "--border-soft": "rgba(148, 163, 184, 0.09)",
    "--border-strong": "rgba(148, 163, 184, 0.26)",
    "--selected": "#22d3ee",
    "--selected-soft": "rgba(34, 211, 238, 0.24)",
    "--text": "#d8dee9",
    "--text-faint": "#465165",
    "--text-muted": "#8a94a6",
    "--text-soft": "#657184",
    "--text-strong": "#f4f7fb",
  })};
  const zoomFactor = ${JSON.stringify(safeZoomFactor.toFixed(2))};
  const brandPattern = /Open\\s+Design/g;
  const brandAttributes = ['aria-label', 'aria-description', 'title', 'alt', 'placeholder', 'value'];
  const ignoredTextParents = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA']);

  const replaceBrandText = (value) => typeof value === 'string' ? value.replace(brandPattern, 'Rox Design') : value;

  const embeddedPrivacyConfig = () => ({
    installationId: null,
    privacyDecisionAt: Date.now(),
    telemetry: { metrics: false, content: false, artifactManifest: false },
  });

  const writeConfig = () => {
    try {
      const current = JSON.parse(localStorage.getItem('open-design:config') || '{}');
      localStorage.setItem('open-design:config', JSON.stringify({
        ...current,
        ...embeddedPrivacyConfig(),
        accentColor: '#22d3ee',
        embed: 'rox',
        language: 'ru',
        theme: 'dark',
      }));
    } catch {}
  };

  const syncEmbeddedAppConfig = () => {
    if (window.__ROX_DESIGN_EMBED_CONFIG_SYNCED__) return;
    window.__ROX_DESIGN_EMBED_CONFIG_SYNCED__ = true;
    try {
      fetch('/api/app-config', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(embeddedPrivacyConfig()),
      }).catch(() => {
        window.__ROX_DESIGN_EMBED_CONFIG_SYNCED__ = false;
      });
    } catch {
      window.__ROX_DESIGN_EMBED_CONFIG_SYNCED__ = false;
    }
  };

  const dismissPrivacyConsent = () => {
    try {
      const textNeedles = ['Not now', 'Не сейчас'];
      for (const button of Array.from(document.querySelectorAll('button'))) {
        const label = (button.textContent || '').trim();
        if (textNeedles.some((needle) => label.includes(needle))) {
          button.click();
          return;
        }
      }
      document.querySelectorAll?.('.privacy-consent-banner').forEach((element) => element.remove());
    } catch {}
  };

  const applyTokens = () => {
    const root = document.documentElement;
    root.setAttribute('data-theme', 'dark');
    root.dataset.roxEmbedded = 'true';
    root.dataset.roxTheme = 'dark';
    root.dataset.roxZoomFactor = zoomFactor;
    root.dataset.roxEmbedPolished = 'true';
    document.body?.setAttribute('data-rox-embed-polished', 'true');
    root.style.colorScheme = 'dark';
    for (const [key, value] of Object.entries(tokenMap)) root.style.setProperty(key, value);
    document.title = 'Rox Design';
    if (document.head) {
      let themeColor = document.querySelector('meta[name="theme-color"]');
      if (!themeColor) {
        themeColor = document.createElement('meta');
        document.head.appendChild(themeColor);
      }
      themeColor.setAttribute('name', 'theme-color');
      themeColor.setAttribute('content', '#05070d');
    }
  };

  const relabelAttributes = (element) => {
    if (!element || typeof element.getAttribute !== 'function') return;
    for (const attr of brandAttributes) {
      if (!element.hasAttribute(attr)) continue;
      const current = element.getAttribute(attr);
      const next = replaceBrandText(current);
      if (next !== current) element.setAttribute(attr, next);
    }
  };

  const relabelTextNodes = (rootNode) => {
    if (!rootNode || typeof document.createTreeWalker !== 'function') return;
    const walker = document.createTreeWalker(rootNode, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parentName = node.parentElement?.tagName;
        return parentName && ignoredTextParents.has(parentName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      },
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      const current = node.nodeValue || '';
      const next = replaceBrandText(current);
      if (next !== current) node.nodeValue = next;
    }
  };

  const relabel = () => {
    document.title = 'Rox Design';
    const rootNode = document.body || document.documentElement;
    relabelTextNodes(rootNode);
    if (document.documentElement) relabelAttributes(document.documentElement);
    if (document.body) relabelAttributes(document.body);
    document.querySelectorAll?.('*').forEach(relabelAttributes);
    document.querySelectorAll?.('.app-chrome-name,.topbar .title,[data-brand],[data-testid*=brand i]').forEach((element) => {
      if ((element.textContent || '').match(brandPattern)) element.textContent = replaceBrandText(element.textContent || '');
    });
  };

  const applyAll = () => {
    writeConfig();
    syncEmbeddedAppConfig();
    applyTokens();
    relabel();
    dismissPrivacyConsent();
  };

  applyAll();
  window.addEventListener('DOMContentLoaded', applyAll, { once: true });
  window.addEventListener('load', applyAll, { once: true });

  if (!window.__ROX_DESIGN_EMBED_OBSERVER__) {
    let queued = false;
    window.__ROX_DESIGN_EMBED_OBSERVER__ = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        applyAll();
      });
    });
    window.__ROX_DESIGN_EMBED_OBSERVER__.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'class', 'style', 'aria-label', 'title', 'alt', 'placeholder'],
      childList: true,
      characterData: true,
      subtree: true,
    });
  }

  if (!window.__ROX_DESIGN_EMBED_INTERVAL__) {
    let ticks = 0;
    window.__ROX_DESIGN_EMBED_INTERVAL__ = setInterval(() => {
      applyAll();
      ticks += 1;
      if (ticks >= 80) {
        clearInterval(window.__ROX_DESIGN_EMBED_INTERVAL__);
        window.__ROX_DESIGN_EMBED_INTERVAL__ = undefined;
      }
    }, 250);
  }
})();
`;
}
