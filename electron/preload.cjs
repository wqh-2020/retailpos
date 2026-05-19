'use strict'

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  exportFile: (opts) => ipcRenderer.invoke('export:file', opts),
  backupSave: (opts) => ipcRenderer.invoke('backup:save', opts),
  backupLoad: () => ipcRenderer.invoke('backup:load'),
  printReceipt: () => ipcRenderer.invoke('print:receipt'),
  openPath: (opts) => ipcRenderer.invoke('shell:openPath', opts),
  isElectron: true,
})
