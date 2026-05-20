import { contextBridge, ipcRenderer } from 'electron'
import type { OpenDesignRequest, OpenDesignResult } from '@rox-one/design-contract'

const desktopApi = {
  pickFolder: () => ipcRenderer.invoke('rox-design-bridge:pick-folder'),
  pickAndImport: (init?: unknown) => ipcRenderer.invoke('rox-design-bridge:pick-and-import', init),
  openExternal: (url: string) => ipcRenderer.invoke('rox-design-bridge:open-external', url),
  openPath: (projectId: string) => ipcRenderer.invoke('rox-design-bridge:open-path', projectId),
  printPdf: (html: string, nonce?: string) => ipcRenderer.invoke('rox-design-bridge:print-pdf', html, nonce),
  printPDF: (html: string, nonce?: string) => ipcRenderer.invoke('rox-design-bridge:print-pdf', html, nonce),
  /**
   * Narrowly-scoped filesystem access for the Design embed surface (T537 PR #5b).
   * Paths are validated on the main-process side against an explicit allowlist:
   *   - ~/.rox/storage/artifacts/design/
   *   - ~/.rox/storage/workspaces/<id>/files/
   */
  fs: {
    readSelected: (filePath: string): Promise<string> =>
      ipcRenderer.invoke('design:fs:readSelected', filePath),
    writeArtifact: (filePath: string, content: string): Promise<{ sha256: string; path: string }> =>
      ipcRenderer.invoke('design:fs:writeArtifact', filePath, content),
  },
  /**
   * Register a listener for theme snapshot updates pushed from the host bridge
   * (T537 PR #2). The listener receives a `{ name: value }` map of --rox-*
   * CSS variables that the Design surface can apply to its document root.
   * Returns an unsubscribe function.
   */
  onThemeSnapshot: (cb: (snapshot: Record<string, string>) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, snapshot: Record<string, string>) => cb(snapshot)
    ipcRenderer.on('rox-design:theme-snapshot', handler)
    return () => ipcRenderer.removeListener('rox-design:theme-snapshot', handler)
  },
  /**
   * Register a listener for locale updates pushed from the i18n bridge.
   * Returns an unsubscribe function.
   */
  onLocaleChange: (cb: (locale: string) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, locale: string) => cb(locale)
    ipcRenderer.on('rox-design:locale-change', handler)
    return () => ipcRenderer.removeListener('rox-design:locale-change', handler)
  },
  openWithContext: (req: OpenDesignRequest): Promise<OpenDesignResult> =>
    ipcRenderer.invoke('design:openWithContext', req),
}

contextBridge.exposeInMainWorld('__OD_CLIENT_TYPE__', 'desktop')
contextBridge.exposeInMainWorld('electronAPI', desktopApi)
contextBridge.exposeInMainWorld('__odDesktop', {
  printPdf: desktopApi.printPdf,
  printPDF: desktopApi.printPDF,
})
