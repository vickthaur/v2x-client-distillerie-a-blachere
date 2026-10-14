import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  server: { port: 5173 },
  preview: { port: 4173 },
  build: {
    target: 'es2020',
    outDir: 'dist',
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        mentions: resolve(__dirname, 'mentions-legales.html'),
        introuvable: resolve(__dirname, '404.html'),
      },
      output: {
        // Three.js dans son propre fichier : mis en cache séparément, chargé après le reste de la page.
        manualChunks: { three: ['three'] },
      },
    },
  },
});
