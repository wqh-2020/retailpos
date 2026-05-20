module.exports = {
  appId: 'com.retailpos.app',
  productName: '聚买买零售收银系统',
  copyright: 'Copyright © 2026',
  directories: {
    output: 'dist_electron',
    buildResources: 'build',
  },
  icon: 'build/app-icon.ico',
  files: [
    'dist/**/*',
    'electron/**/*',
  ],
  extraMetadata: {
    main: 'electron/main.cjs',
  },
  win: {
    icon: 'build/app-icon.ico',
    target: [
      { target: 'nsis', arch: ['x64'] },
      { target: 'portable', arch: ['x64'] },
    ],
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    shortcutName: '聚买买零售收银系统',
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    // 安装器图标
    installerIcon: 'build/app-icon.ico',
    uninstallerIcon: 'build/app-icon.ico',
    // 安装器头部图片（可选，提升视觉效果）
    // installerHeaderIcon: 'build/app-icon.ico',
    // 安装器侧边图（可选）
    // installerSidebar: 'build/installer-sidebar.bmp',
    // uninstallerSidebar: 'build/uninstaller-sidebar.bmp',
  },
  portable: {
    artifactName: '聚买买零售收银系统-便携版-${version}.exe',
  },
}
