import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        upload: resolve(__dirname, 'upload.html'),
        live: resolve(__dirname, 'live.html'),
      },
    },
  },
  server: {
    port: 5173,
    open: true
  }
});
