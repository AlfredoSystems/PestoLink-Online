const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronBLE', {
    onDeviceList: (cb) => ipcRenderer.on('ble-device-list', (_, devices) => cb(devices)),
    selectDevice: (id) => ipcRenderer.send('ble-select-device', id),
    cancel: () => ipcRenderer.send('ble-cancel-picker'),
    removeListeners: () => ipcRenderer.removeAllListeners('ble-device-list'),
});
