const publisherName = process.env.PULSE_PUBLISHER_NAME?.trim();
module.exports = {
  appId: 'com.pulseanalytics.desktop', productName: 'Pulse Analytics',
  directories: { output: 'release', buildResources: 'build' },
  files: ['dist/**/*', 'electron/**/*', 'build/icon.png', 'package.json'],
  asar: true,
  electronLanguages: ['pt-BR', 'en-US'],
  compression: 'maximum',
  forceCodeSigning: Boolean(publisherName),
  publish: [{ provider: 'github', owner: 'maumau1902-bit', repo: 'app-mrj', releaseType: 'release' }],
  win: { target: [{ target: 'nsis', arch: ['x64'] }], icon: 'build/icon.ico',
    ...(publisherName ? { publisherName } : {}),
    verifyUpdateCodeSignature: true,
    artifactName: 'Pulse-Analytics-Setup-${version}-${arch}.${ext}' },
  nsis: { oneClick: true, perMachine: false, runAfterFinish: true,
    createDesktopShortcut: true, createStartMenuShortcut: true,
    shortcutName: 'Pulse Analytics', uninstallDisplayName: 'Pulse Analytics',
    installerIcon: 'build/icon.ico', uninstallerIcon: 'build/icon.ico',
    differentialPackage: true, deleteAppDataOnUninstall: false,
    include: 'build/installer.nsh' }
};
