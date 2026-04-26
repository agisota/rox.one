/**
 * Centralized branding assets for ROX
 * Used by OAuth callback pages
 */

export const ROX_LOGO = [
  '  ██████   ██████   ██  ██       ██████   ███ ██  ██████',
  '  ██   ██  ██  ██    ████        ██  ██   █████  ██     ',
  '  ██████   ██  ██     ██        ██   ██   ██ ██  ██████ ',
  '  ██  ██   ██  ██   ████        ██   ██   ██ ███  ██    ',
  '  ██   ██  ██████  ██  ██  █     ██████   ██  ██  ██████',
] as const;

/** Logo as a single string for HTML templates */
export const ROX_LOGO_HTML = ROX_LOGO.map((line) => line.trimEnd()).join('\n');

/** Session viewer base URL */
export const VIEWER_URL = 'https://app.rox.one';
