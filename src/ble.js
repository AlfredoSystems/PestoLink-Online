// BLE platform detection and native adapter.
//
// Returns one of:
//   'native'               – running inside Capacitor (iOS or Android app)
//   'web-bluetooth'        – Chrome/Edge on desktop or Android
//   'unsupported-safari'   – Safari on any platform
//   'unsupported-ios-pwa'  – iOS home-screen PWA (WebKit, no BLE)
//   'unsupported-browser'  – any other browser without Web Bluetooth

export function getBleMode() {
  if (window.Capacitor?.isNativePlatform()) return 'native';
  if (window.electronBLE) return 'electron';

  const ua = navigator.userAgent;
  // iPad on iOS 13+ reports as MacIntel with touch support
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
  const isPWA =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  if (isIOS && isPWA) return 'unsupported-ios-pwa';
  if (isSafari) return 'unsupported-safari';
  if ('bluetooth' in navigator) return 'web-bluetooth';
  return 'unsupported-browser';
}

export const BLE_WARNINGS = {
  'unsupported-safari': {
    message: 'Safari does not support Bluetooth.',
    detail: 'Use Chrome on Android, or install the PestoLink iOS app.',
  },
  'unsupported-ios-pwa': {
    message: 'iOS home screen apps do not support Bluetooth.',
    detail: 'Install the PestoLink iOS app for full Bluetooth support.',
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
