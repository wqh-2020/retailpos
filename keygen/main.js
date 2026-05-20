const { app, BrowserWindow, Menu } = require('electron')
const path = require('path')

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 520,
    height: 480,
    resizable: false,
    title: '聚买买零售收银 - 注册机',
    icon: path.join(__dirname, 'app-icon.ico'),
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: false,
    },
  })
  mainWindow.loadFile(path.join(__dirname, 'index.html'))
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)
  createWindow()
})

app.on('window-all-closed', () => app.quit())
