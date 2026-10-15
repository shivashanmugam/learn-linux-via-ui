import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  // Served from https://shivashanmugam.github.io/linux-as-ui/ on GitHub Pages.
  base: '/linux-as-ui/',
  plugins: [react()],
  build: {
    rolldownOptions: {
      input: {
        home: resolve(import.meta.dirname, 'index.html'),
        'big-picture': resolve(import.meta.dirname, 'big-picture/index.html'),
        processor: resolve(import.meta.dirname, 'processor/index.html'),
      },
    },
  },
});
