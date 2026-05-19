'use strict'

const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron')
const path = require('path')
const fs = require('fs')

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

let mainWindow = null

// ─── 去掉菜单栏 ──────────────────────────────────────────
function buildMenu() {
  Menu.setApplicationMenu(null)
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 680,
    title: '聚财收银系统',
    backgroundColor: '#f5f7fa',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  buildMenu()
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

// ─── IPC: 导出文件 ───────────────────────────────────────
ipcMain.handle('export:file', async (_event, { defaultName, buffer }) => {
  const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultName,
    filters: [{ name: 'Excel', extensions: ['xlsx'] }],
  })
  if (canceled || !filePath) return { ok: false }
  try {
    fs.writeFileSync(filePath, Buffer.from(buffer))
    return { ok: true, filePath }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

// ─── IPC: 备份数据 ───────────────────────────────────────
ipcMain.handle('backup:save', async (_event, { jsonStr }) => {
  const now = new Date()
  const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
  const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
    defaultPath: `retailpos_backup_${ts}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  })
  if (canceled || !filePath) return { ok: false }
  try {
    fs.writeFileSync(filePath, jsonStr, 'utf-8')
    return { ok: true, filePath }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

// ─── IPC: 恢复数据 ───────────────────────────────────────
ipcMain.handle('backup:load', async () => {
  const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow, {
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile'],
  })
  if (canceled || !filePaths.length) return { ok: false }
  try {
    const content = fs.readFileSync(filePaths[0], 'utf-8')
    return { ok: true, content }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

// ─── IPC: 打印小票 ───────────────────────────────────────
ipcMain.handle('print:receipt', async () => {
  if (!mainWindow) return { ok: false }
  return new Promise((resolve) => {
    mainWindow.webContents.print(
      { silent: false, printBackground: true },
      (success, reason) => resolve({ ok: success, reason })
    )
  })
})

// ─── IPC: 打开文件夹 ─────────────────────────────────────
ipcMain.handle('shell:openPath', async (_event, { filePath }) => {
  shell.showItemInFolder(filePath)
  return { ok: true }
})
