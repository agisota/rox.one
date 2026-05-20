import { contextBridge, ipcRenderer } from 'electron'

const desktopApi = {
  pickFolder: () => ipcRenderer.invoke('rox-design-bridge:pick-folder'),
  pickAndImport: (init?: unknown) => ipcRenderer.invoke('rox-design-bridge:pick-and-import', init),
  openExternal: (url: string) => ipcRenderer.invoke('rox-design-bridge:open-external', url),
  openPath: (projectId: string) => ipcRenderer.invoke('rox-design-bridge:open-path', projectId),
  printPdf: (html: string, nonce?: string) => ipcRenderer.invoke('rox-design-bridge:print-pdf', html, nonce),
  printPDF: (html: string, nonce?: string) => ipcRenderer.invoke('rox-design-bridge:print-pdf', html, nonce),
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
}

contextBridge.exposeInMainWorld('__OD_CLIENT_TYPE__', 'desktop')
contextBridge.exposeInMainWorld('electronAPI', desktopApi)
contextBridge.exposeInMainWorld('__odDesktop', {
  printPdf: desktopApi.printPdf,
  printPDF: desktopApi.printPDF,
})
