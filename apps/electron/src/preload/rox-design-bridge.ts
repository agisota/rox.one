import { contextBridge, ipcRenderer } from 'electron'

const desktopApi = {
  pickFolder: () => ipcRenderer.invoke('rox-design-bridge:pick-folder'),
  pickAndImport: (init?: unknown) => ipcRenderer.invoke('rox-design-bridge:pick-and-import', init),
  openExternal: (url: string) => ipcRenderer.invoke('rox-design-bridge:open-external', url),
  openPath: (projectId: string) => ipcRenderer.invoke('rox-design-bridge:open-path', projectId),
  printPdf: (html: string, nonce?: string) => ipcRenderer.invoke('rox-design-bridge:print-pdf', html, nonce),
  printPDF: (html: string, nonce?: string) => ipcRenderer.invoke('rox-design-bridge:print-pdf', html, nonce),
}

contextBridge.exposeInMainWorld('__OD_CLIENT_TYPE__', 'desktop')
contextBridge.exposeInMainWorld('electronAPI', desktopApi)
contextBridge.exposeInMainWorld('__odDesktop', {
  printPdf: desktopApi.printPdf,
  printPDF: desktopApi.printPDF,
})
