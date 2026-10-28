const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const fs = require('node:fs');
const { parse } = require('yaml');
const { CancellationToken } = require('builder-util-runtime');
const { autoUpdater } = require('electron-updater');
const { UpdateController } = require('./update-controller.cjs');
const { updatePolicy } = require('./update-policy.cjs');

app.setName('Pulse Analytics');
app.setAppUserModelId('com.pulseanalytics.desktop');
const entryFile = path.join(__dirname, '..', 'dist', 'index.html');
const entryURL = pathToFileURL(entryFile).href;
let window;
let updates;
function currentUpdatePolicy() {
  let config;
  if (app.isPackaged && process.platform === 'win32') {
    try { config = parse(fs.readFileSync(path.join(process.resourcesPath, 'app-update.yml'), 'utf8')); }
    catch { /* A missing or malformed feed keeps updates disabled. */ }
  }
  return updatePolicy({ packaged: app.isPackaged, platform: process.platform, config });
}
function createWindow() {
  window = new BrowserWindow({ title: 'Pulse Analytics', width: 1366, height: 800,
    minWidth: 960, minHeight: 640, backgroundColor: '#f7f6f4', autoHideMenuBar: true,
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true }
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => { if (url !== entryURL) event.preventDefault(); });
  window.loadFile(entryFile);
  window.once('ready-to-show', () => updates.start());
  window.on('closed', () => { window = null; });
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (window) { if (window.isMinimized()) window.restore(); window.focus(); } });
  app.whenReady().then(() => {
    // No remote scripts, navigation, permission prompts, or arbitrary IPC are exposed.
    session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
    session.defaultSession.setPermissionCheckHandler(() => false);
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => callback({ responseHeaders: {
      ...details.responseHeaders,
      'Content-Security-Policy': ["default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-src 'none'"]
    } }));
    updates = new UpdateController(autoUpdater, { version: app.getVersion(), ...currentUpdatePolicy(), tokenFactory: () => new CancellationToken() });
    updates.on('state', state => { if (window && !window.isDestroyed()) window.webContents.send('updates:changed', state); });
    const handlers = { state: () => updates.snapshot(), check: () => updates.check(), download: () => updates.download(), cancel: () => updates.cancel(), install: () => updates.install() };
    for (const [action, handler] of Object.entries(handlers)) ipcMain.handle(`updates:${action}`, event => {
      if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame || event.senderFrame.url !== entryURL) throw new Error('Unauthorized update request');
      return handler();
    });
    createWindow();
    app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
  });
  app.on('before-quit', () => updates?.stop());
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
}
