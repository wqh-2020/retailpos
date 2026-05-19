module.exports = {
  appId: 'com.retailpos.app',
  productName: '零售收银系统',
  copyright: 'Copyright © 2026',
  directories: {
    output: 'dist_electron',
    buildResources: 'build',
  },
  files: [
    'dist/**/*',
    'electron/**/*',
  ],
  extraMetadata: {
    main: 'electron/main.cjs',
  },
  win: {
    target: [
      { target: 'nsis', arch: ['x64'] },
      { target: 'portable', arch: ['x64'] },
    ],
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    shortcutName: '零售收银系统',
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
  },
  portable: {
    artifactName: '零售收银系统-便携版-${version}.exe',
  },
}
