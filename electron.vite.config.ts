import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'electron-vite';
import { resolve } from 'node:path';

export default defineConfig({
  main: {},
  preload: {
    build: {
      rollupOptions: {
        input: { index: resolve('src/preload/index.ts'), controls: resolve('src/preload/controls.ts') },
        output: { format: 'cjs', entryFileNames: '[name].cjs' },
      },
    },
  },
  renderer: {
    build: { rollupOptions: { input: { index: resolve('src/renderer/index.html'), controls: resolve('src/renderer/controls.html') } } },
    plugins: [react(), tailwindcss()],
    server: { host: '127.0.0.1' },
  },
});
