import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.alfredosystems.pestolink',
  appName: 'PestoLink',
  webDir: 'dist',
  plugins: {
    BluetoothLe: {
      displayStrings: {
        scanning: 'Scanning for PestoLink...',
        cancel: 'Cancel',
        availableDevices: 'Available devices',
        noDeviceFound: 'No PestoLink device found',
      },
    },
  },
};

export default config;
