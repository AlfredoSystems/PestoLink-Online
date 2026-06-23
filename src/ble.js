// BLE platform detection and native adapter.
//
// Returns one of:
//   'native'             – running inside Capacitor (iOS or Android app)
//   'electron'           – running inside Electron
//   'web-bluetooth'      – Chrome/Edge on desktop or Android
//   'unsupported-safari' – Safari on any platform
//   'unsupported-browser'– any other browser without Web Bluetooth

export function getBleMode() {
  if (window.Capacitor?.isNativePlatform()) return 'native';
  if (window.electronBLE) return 'electron';

  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  if (isSafari) return 'unsupported-safari';
  if ('bluetooth' in navigator) return 'web-bluetooth';
  return 'unsupported-browser';
}

export const BLE_WARNINGS = {
  'unsupported-safari': {
    message: 'Safari does not support Bluetooth.',
    detail: 'Use Chrome on Android, or install the PestoLink iOS app.',
  },
  'unsupported-browser': {
    message: 'Your browser does not support Web Bluetooth.',
    detail: 'Try Chrome on Android or desktop. On iOS, use the PestoLink app.',
  },
};

// Lazily loads and initialises the Capacitor BLE client.
// Only call this when getBleMode() === 'native'.
export async function getNativeBleClient() {
  const { BleClient } = await import('@capacitor-community/bluetooth-le');
  await BleClient.initialize();
  return BleClient;
}
