'use strict'

const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron')
const path = require('path')
const fs = require('fs')
const os = require('os')
const crypto = require('crypto')

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
    title: '聚买买零售收银系统',
    backgroundColor: '#f5f7fa',
    autoHideMenuBar: true,
    icon: path.join(__dirname, '../build/app-icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    // 生产环境：先检查文件是否存在，再加载
    const indexPath = path.join(__dirname, '../dist/index.html')
    console.log('[main] Loading:', indexPath)
    console.log('[main] File exists:', fs.existsSync(indexPath))

    if (!fs.existsSync(indexPath)) {
      // 如果找不到，尝试其他路径（兼容不同打包方式）
      const altPath = path.join(process.resourcesPath, 'app.asar/dist/index.html')
      console.log('[main] Trying alt:', altPath)
      console.log('[main] Alt exists:', fs.existsSync(altPath))
      mainWindow.loadFile(altPath)
    } else {
      mainWindow.loadFile(indexPath)
    }
  }

  // ─── 错误处理 ──────────────────────────────────────────
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error('[main] did-fail-load:', errorCode, errorDescription)
    if (!isDev) {
      // 显示错误页面
      const errHtml = `
        <html><body style="font-family:sans-serif;padding:40px;color:#333">
          <h1>页面加载失败</h1>
          <p>错误码: ${errorCode}</p>
          <p>错误描述: ${errorDescription}</p>
          <p>请尝试重新安装软件。</p>
        </body></html>`
      mainWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(errHtml))
    }
  })

  mainWindow.webContents.on('console-message', (_event, level, message) => {
    const levelMap = ['verbose', 'info', 'warning', 'error']
    console.log(`[renderer][${levelMap[level] || level}]`, message)
  })

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

// ─── IPC: 获取机器指纹 ──────────────────────────────────
ipcMain.handle('get-machine-id', async () => {
  try {
    const hostname = os.hostname()
    const cpus = os.cpus().length
    // 取第一块非内部网卡的 MAC 地址
    const nets = os.networkInterfaces()
    let mac = '00:00:00:00:00:00'
    for (const name of Object.keys(nets)) {
      for (const iface of nets[name]) {
        if (!iface.internal && iface.mac && iface.mac !== '00:00:00:00:00:00') {
          mac = iface.mac
          break
        }
      }
      if (mac !== '00:00:00:00:00:00') break
    }
    // 拼接指纹并哈希
    const fingerprint = `${hostname}|${cpus}|${mac}`
    const hash = crypto.createHash('sha256').update(fingerprint).digest()
    // Base32 编码前 10 字节 → 16 字符
    const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
    let bits = ''
    for (let i = 0; i < 10; i++) bits += hash[i].toString(2).padStart(8, '0')
    let b32 = ''
    for (let i = 0; i + 5 <= bits.length; i += 5) b32 += BASE32[parseInt(bits.slice(i, i + 5), 2)]
    // 格式化为 XXXX-XXXX-XXXX-XXXX
    const formatted = b32.slice(0, 16).toUpperCase().replace(/(.{4})/g, '$1-').replace(/-$/, '')
    return { ok: true, machineId: formatted, fingerprint }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

// ─── IPC: 打开文件夹 ─────────────────────────────────────
ipcMain.handle('shell:openPath', async (_event, { filePath }) => {
  shell.showItemInFolder(filePath)
  return { ok: true }
})
