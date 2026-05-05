const { app, BrowserWindow, ipcMain, protocol, net } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');

app.commandLine.appendSwitch('enable-experimental-web-platform-features');

// Register the custom scheme BEFORE app is ready (Electron requirement).
// Serving from app://app/ instead of file:// gives the renderer a real
// secure origin, so Chromium's CORS/CSP rules that block null-origin
// file:// requests don't apply.
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { secure: true, standard: true, supportFetchAPI: true } },
]);

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: '#4dae50',
    icon: path.join(__dirname, '..', 'dist', 'favicon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  win.webContents.session.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(permission === 'bluetooth');
  });

  // Each time Electron discovers (more) devices, send the updated list to the
  // renderer so the custom picker can populate. The renderer sends back the
  // chosen deviceId via IPC; we store the latest callback so we always resolve
  // with the most-recent scan results.
  let pendingPickerCallback = null;

  win.webContents.on('select-bluetooth-device', (event, deviceList, callback) => {
    event.preventDefault();
    pendingPickerCallback = callback;
    win.webContents.send('ble-device-list', deviceList.map(d => ({
      deviceId: d.deviceId,
      deviceName: d.deviceName,
    })));
  });

  ipcMain.on('ble-select-device', (_, deviceId) => {
    if (pendingPickerCallback) {
      pendingPickerCallback(deviceId);
      pendingPickerCallback = null;
    }
  });

  ipcMain.on('ble-cancel-picker', () => {
    if (pendingPickerCallback) {
      pendingPickerCallback('');
      pendingPickerCallback = null;
    }
  });

  win.loadURL('app://app/');
}

app.whenReady().then(() => {
  const distDir = path.resolve(__dirname, '..', 'dist');

  // Serve every app://app/<path> request from the dist/ folder.
  protocol.handle('app', (req) => {
    const { pathname } = new URL(req.url);
    const rel = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
    return net.fetch(pathToFileURL(path.join(distDir, rel)).toString());
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
