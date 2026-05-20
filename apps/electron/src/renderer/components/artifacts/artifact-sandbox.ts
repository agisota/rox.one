interface ArtifactSandboxOptions {
  interactive: boolean
  title?: string
}

const INTERACTIVE_CSP = [
  "default-src 'none'",
  "style-src 'unsafe-inline'",
  "img-src data: blob:",
  "media-src data: blob:",
  "font-src data:",
  "script-src 'unsafe-inline'",
  "connect-src 'none'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "worker-src 'none'",
].join('; ')

const STATIC_CSP = INTERACTIVE_CSP.replace("script-src 'unsafe-inline'", "script-src 'none'")

export function getArtifactIframeSandbox(options: ArtifactSandboxOptions): string {
  return options.interactive ? 'allow-scripts' : ''
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function stripExecutableHtml(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '')
    .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '')
    .replace(/javascript:/gi, '')
}

export function buildArtifactSandboxSrcDoc(html: string, options: ArtifactSandboxOptions): string {
  const csp = options.interactive ? INTERACTIVE_CSP : STATIC_CSP
  const body = options.interactive ? html : stripExecutableHtml(html)
  const title = escapeHtml(options.title ?? 'Artifact')

  return [
    '<!doctype html>',
    '<html>',
    '<head>',
    '<meta charset="utf-8">',
    `<meta http-equiv="Content-Security-Policy" content="${csp}">`,
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${title}</title>`,
    '<style>html,body{min-height:100%;margin:0;background:Canvas;color:CanvasText;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;}</style>',
    '</head>',
    '<body>',
    body,
    '</body>',
    '</html>',
  ].join('')
}
