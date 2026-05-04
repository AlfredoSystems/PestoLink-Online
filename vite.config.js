import { defineConfig } from 'vite';
import { resolve } from 'path';
import { readFileSync, writeFileSync } from 'fs';

export default defineConfig({
  // Use './' so Electron and Capacitor can load assets via file:// URLs.
  // GitHub Pages CI sets VITE_BASE_URL=/PestoLink-Online/ to override this.
  base: process.env.VITE_BASE_URL || './',
  root: resolve(__dirname, 'src'),
  publicDir: resolve(__dirname, 'public'),
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
  },
  plugins: [
    {
      name: 'sw-cache-buster',
      closeBundle() {
        const swPath = resolve(__dirname, 'dist', 'sw.js');
        const content = readFileSync(swPath, 'utf-8');
        writeFileSync(swPath, content.replace('__BUILD_DATE__', Date.now()));
      },
    },
    {
      // Vite injects `crossorigin` on <script type="module"> and <link> tags.
      // Chromium rejects these with ERR_FAILED when loading via file:// because
      // the origin is treated as `null` and CORS checks fail. Safe to remove
      // because all assets are same-origin on every deployment target.
      name: 'remove-crossorigin',
      transformIndexHtml: (html) => html.replace(/ crossorigin/g, ''),
    },
  ],
});
